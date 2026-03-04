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
import type { Deck } from '../../domain/card.js';

const DECK_A_CONTENT = [
  'Q: What is 2+2?',
  'A: 4',
  '',
  'Q: Capital of France?',
  'A: Paris',
].join('\n');

const DECK_B_CONTENT = [
  'Q: What color is the sky?',
  'A: Blue',
  '',
  'C: The [sun] rises in the [east]',
].join('\n');

let tmpDir: string;
let deckA: Deck;
let deckB: Deck;
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

  const decks = deckSource.getAll();
  deckA = decks.find(d => d.name === 'deck-a')!;
  deckB = decks.find(d => d.name === 'deck-b')!;

  const settingsRepo = new JsonSettingsRepository(join(tmpDir, 'settings.json'));
  const renderer = new HtmlCardRenderer({ decksDir: tmpDir, githubBranch: 'main' });
  const deckService = new DeckService(deckSource, cardRepo, settingsRepo);
  const reviewService = new ReviewService(cardRepo, deckSource, settingsRepo, renderer);
  app = createApp(deckService, reviewService, tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true });
});

describe('GET /api/review', () => {
  it('returns due cards from all decks', async () => {
    const res = await request(app).get('/api/review');
    expect(res.status).toBe(200);
    // deck-a: 2 QA, deck-b: 1 QA + 2 cloze = 5 total
    expect(res.body.cards).toHaveLength(5);
    expect(res.body.total).toBe(5);
  });
});

describe('GET /api/review/:deckId', () => {
  it('returns only cards belonging to the requested deck (deck-a)', async () => {
    const res = await request(app).get(`/api/review/${deckA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(2);
    // Every card must belong to deck-a — this is the regression test for the cross-deck bug
    for (const card of res.body.cards) {
      expect(card.deckId).toBe(deckA.id);
    }
  });

  it('returns only cards belonging to the requested deck (deck-b)', async () => {
    const res = await request(app).get(`/api/review/${deckB.id}`);
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(3);
    for (const card of res.body.cards) {
      expect(card.deckId).toBe(deckB.id);
    }
  });

  it('returns 404 for an unknown deck ID', async () => {
    const res = await request(app).get('/api/review/unknown-deck-id');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/review', () => {
  it('returns 200 and updates card state on pass', async () => {
    // Get a card to review
    const listRes = await request(app).get(`/api/review/${deckA.id}`);
    const cardId = listRes.body.cards[0].cardId;

    const res = await request(app)
      .post('/api/review')
      .send({ cardId, pass: true });

    expect(res.status).toBe(200);
    expect(res.body.cardId).toBe(cardId);
    expect(res.body.rating).toBe(3); // Good
    expect(typeof res.body.nextDue).toBe('string');
    expect(res.body.state).toBeGreaterThan(0); // No longer New
  });

  it('returns 400 when cardId or pass is missing', async () => {
    const res = await request(app).post('/api/review').send({ cardId: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown card ID', async () => {
    const res = await request(app)
      .post('/api/review')
      .send({ cardId: 'no-such-card', pass: true });
    expect(res.status).toBe(404);
  });
});
