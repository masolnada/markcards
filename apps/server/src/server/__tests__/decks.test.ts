import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { Database } from 'bun:sqlite';
import { initDb } from '../../infrastructure/db/schema.js';
import { SqliteCardRepository } from '../../infrastructure/db/sqlite-card-repository.js';
import { LocalDeckSource } from '../../infrastructure/deck-source/local-deck-source.js';
import { JsonSettingsRepository } from '../../infrastructure/json-settings-repository.js';
import { HtmlCardRenderer } from '../../infrastructure/html-card-renderer.js';
import { DeckService } from '../../application/deck-service.js';
import { ReviewService } from '../../application/review-service.js';
import { createApp } from '../../http/app.js';

const DECK_A_CONTENT = 'Q: What is 2+2?\nA: 4\n\nQ: Capital of France?\nA: Paris';
const DECK_B_CONTENT = 'Q: What color is the sky?\nA: Blue\n\nC: The [sun] rises in the [east]';

let tmpDir: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let deckSource: LocalDeckSource;

beforeEach(async () => {
  tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-test-'));

  writeFileSync(join(tmpDir, 'deck-a.md'), DECK_A_CONTENT);
  writeFileSync(join(tmpDir, 'deck-b.md'), DECK_B_CONTENT);

  const db = new Database(join(tmpDir, 'test.db'));
  initDb(db);
  const cardRepo = new SqliteCardRepository(db);
  deckSource = new LocalDeckSource(tmpDir, cardRepo);
  await deckSource.sync(true);

  const settingsRepo = new JsonSettingsRepository(join(tmpDir, 'settings.json'));
  const renderer = new HtmlCardRenderer({ decksDir: tmpDir, githubBranch: 'main' });
  const deckService = new DeckService(deckSource, cardRepo, settingsRepo);
  const reviewService = new ReviewService(cardRepo, deckSource, settingsRepo, renderer);
  app = createApp(deckService, reviewService, tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true });
});

describe('GET /api/decks', () => {
  it('returns both decks', async () => {
    const res = await request(app).get('/api/decks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('returns correct card totals per deck', async () => {
    const res = await request(app).get('/api/decks');
    const byName = Object.fromEntries(res.body.map((d: { name: string }) => [d.name, d]));

    expect(byName['deck-a'].stats.total).toBe(2); // 2 QA cards
    expect(byName['deck-b'].stats.total).toBe(3); // 1 QA + 2 cloze cards
  });

  it('reports all new cards as due', async () => {
    const res = await request(app).get('/api/decks');
    for (const deck of res.body) {
      expect(deck.stats.due).toBe(deck.stats.total);
    }
  });
});

describe('GET /api/decks — due count after completing a review session', () => {
  // Regression test: after reviewing all cards within the daily new-card limit,
  // the deck list must show due=0 even if new cards remain beyond the daily cap.
  beforeEach(() => {
    // settingsRepo uses the file path; tests write to it directly
  });

  it('shows due=0 for all decks after the daily new-card limit is exhausted', async () => {
    // 5 total new cards (deck-a: 2, deck-b: 3); cap at 2 so 3 cards are unreachable today
    writeFileSync(join(tmpDir, 'settings.json'), JSON.stringify({ maxNewPerDay: 2 }));

    // Confirm global queue is capped at 2
    const globalQueue = await request(app).get('/api/review');
    expect(globalQueue.body.cards).toHaveLength(2);

    // Review all 2 cards — daily limit is now exhausted
    for (const card of globalQueue.body.cards) {
      await request(app).post('/api/review').send({ cardId: card.cardId, pass: true });
    }

    // Every deck must show due=0: reviewed cards have future due dates,
    // and remaining new cards are beyond today's daily cap
    const decks = (await request(app).get('/api/decks')).body;
    for (const deck of decks) {
      expect(deck.stats.due).toBe(0);
    }
    // deck-b still has all 3 of its cards in the new state (none were served today)
    const deckB = decks.find((d: { name: string }) => d.name === 'deck-b');
    expect(deckB.stats.newCards).toBe(3);
  });
});
