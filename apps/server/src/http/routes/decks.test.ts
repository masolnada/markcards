import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
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
  const deckService = new DeckService(deckSource, cardRepo);
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

describe('DELETE /api/decks/:deckId/cards', () => {
  it('returns 400 when cardIds is missing', async () => {
    const decks = (await request(app).get('/api/decks')).body;
    const deckA = decks.find((d: { name: string }) => d.name === 'deck-a');

    const res = await request(app)
      .delete(`/api/decks/${deckA.id}/cards`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when cardIds is not an array of strings', async () => {
    const decks = (await request(app).get('/api/decks')).body;
    const deckA = decks.find((d: { name: string }) => d.name === 'deck-a');

    const res = await request(app)
      .delete(`/api/decks/${deckA.id}/cards`)
      .send({ cardIds: [42] });
    expect(res.status).toBe(400);
  });

  it('returns 204 and removes card from SQLite', async () => {
    const decks = (await request(app).get('/api/decks')).body;
    const deckA = decks.find((d: { name: string }) => d.name === 'deck-a');

    const cardsRes = await request(app).get(`/api/decks/${deckA.id}/cards`);
    const [first] = cardsRes.body.cards;

    const res = await request(app)
      .delete(`/api/decks/${deckA.id}/cards`)
      .send({ cardIds: [first.cardId] });
    expect(res.status).toBe(204);

    // Force re-sync so deck-source reloads from (now-modified) file
    await deckSource.sync(true);

    const afterRes = await request(app).get(`/api/decks/${deckA.id}/cards`);
    const remainingIds = afterRes.body.cards.map((c: { cardId: string }) => c.cardId);
    expect(remainingIds).not.toContain(first.cardId);
    expect(afterRes.body.cards).toHaveLength(1);
  });

  it('rewrites the markdown file removing the deleted card block', async () => {
    const decks = (await request(app).get('/api/decks')).body;
    const deckA = decks.find((d: { name: string }) => d.name === 'deck-a');

    const cardsRes = await request(app).get(`/api/decks/${deckA.id}/cards`);
    const cardToDelete = cardsRes.body.cards.find(
      (c: { promptHtml: string }) => c.promptHtml.includes('2+2'),
    );

    await request(app)
      .delete(`/api/decks/${deckA.id}/cards`)
      .send({ cardIds: [cardToDelete.cardId] });

    const fileContent = readFileSync(join(tmpDir, 'deck-a.md'), 'utf8');
    expect(fileContent).not.toContain('2+2');
    expect(fileContent).toContain('Capital of France');
  });

  it('deleted card does not reappear after re-sync', async () => {
    const decks = (await request(app).get('/api/decks')).body;
    const deckA = decks.find((d: { name: string }) => d.name === 'deck-a');

    const cardsRes = await request(app).get(`/api/decks/${deckA.id}/cards`);
    const [first] = cardsRes.body.cards;

    await request(app)
      .delete(`/api/decks/${deckA.id}/cards`)
      .send({ cardIds: [first.cardId] });

    // Re-sync simulates a server restart or watch event
    await deckSource.sync(true);

    const afterRes = await request(app).get(`/api/decks/${deckA.id}/cards`);
    expect(afterRes.body.cards).toHaveLength(1);
    expect(afterRes.body.cards[0].cardId).not.toBe(first.cardId);
  });

  it('deletes a cloze card block', async () => {
    const decks = (await request(app).get('/api/decks')).body;
    const deckB = decks.find((d: { name: string }) => d.name === 'deck-b');

    const cardsRes = await request(app).get(`/api/decks/${deckB.id}/cards`);
    const clozeCard = cardsRes.body.cards.find(
      (c: { type: string }) => c.type === 'cloze',
    );

    await request(app)
      .delete(`/api/decks/${deckB.id}/cards`)
      .send({ cardIds: [clozeCard.cardId] });

    const fileContent = readFileSync(join(tmpDir, 'deck-b.md'), 'utf8');
    expect(fileContent).not.toContain('sun');
    expect(fileContent).toContain('sky');
  });
});

describe('GET /api/decks — stats after reviewing', () => {
  it('reviewed cards are no longer due; unreviewed new cards remain due', async () => {
    // Review all cards from deck-a (2 cards)
    const globalQueue = await request(app).get('/api/review');
    const deckACards = globalQueue.body.cards.filter((c: { deckId: string }) => {
      const decks = deckSource.getAll();
      const deckA = decks.find(d => d.name === 'deck-a');
      return deckA && c.deckId === deckA.id;
    });
    for (const card of deckACards) {
      await request(app).post('/api/review').send({ cardId: card.cardId, pass: true });
    }

    const decks = (await request(app).get('/api/decks')).body;
    // deck-b still has all its cards as new and due
    const deckB = decks.find((d: { name: string }) => d.name === 'deck-b');
    expect(deckB.stats.newCards).toBe(3);
    expect(deckB.stats.due).toBe(3);
  });
});
