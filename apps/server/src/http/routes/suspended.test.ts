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

const DECK_CONTENT = 'Q: What is 2+2?\nA: 4\n\nQ: Capital of France?\nA: Paris\n\nQ: What color is the sky?\nA: Blue';

let tmpDir: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeEach(async () => {
  tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-suspended-test-'));
  writeFileSync(join(tmpDir, 'deck.md'), DECK_CONTENT);

  const db = new Database(join(tmpDir, 'test.db'));
  initDb(db);
  const cardRepo = new SqliteCardRepository(db);
  const deckSource = new LocalDeckSource(tmpDir, cardRepo);
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

async function getACardId(): Promise<string> {
  const res = await request(app).get('/api/review');
  return res.body.cards[0].cardId as string;
}

describe('GET /api/suspended', () => {
  it('returns empty list when nothing is suspended', async () => {
    const res = await request(app).get('/api/suspended');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(0);
  });

  it('returns suspended cards with rendered HTML', async () => {
    const cardId = await getACardId();
    await request(app).post('/api/suspended').send({ cardId });

    const res = await request(app).get('/api/suspended');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(1);
    expect(res.body.cards[0].cardId).toBe(cardId);
    expect(typeof res.body.cards[0].promptHtml).toBe('string');
    expect(res.body.cards[0].promptHtml.length).toBeGreaterThan(0);
  });
});

describe('POST /api/suspended', () => {
  it('suspends a card and returns 200', async () => {
    const cardId = await getACardId();

    const res = await request(app).post('/api/suspended').send({ cardId });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 400 when cardId is missing', async () => {
    const res = await request(app).post('/api/suspended').send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/suspended/:cardId', () => {
  it('unsuspends a card and returns 200', async () => {
    const cardId = await getACardId();
    await request(app).post('/api/suspended').send({ cardId });

    const res = await request(app).delete(`/api/suspended/${cardId}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('card disappears from GET /api/suspended after unsuspend', async () => {
    const cardId = await getACardId();
    await request(app).post('/api/suspended').send({ cardId });

    await request(app).delete(`/api/suspended/${cardId}`);

    const res = await request(app).get('/api/suspended');
    expect(res.body.cards).toHaveLength(0);
  });
});

describe('suspended cards are excluded from the review queue', () => {
  it('suspended card does not appear in GET /api/review', async () => {
    const beforeRes = await request(app).get('/api/review');
    const cardId = beforeRes.body.cards[0].cardId as string;

    await request(app).post('/api/suspended').send({ cardId });

    const afterRes = await request(app).get('/api/review');
    const ids = afterRes.body.cards.map((c: { cardId: string }) => c.cardId);
    expect(ids).not.toContain(cardId);
    expect(afterRes.body.cards).toHaveLength(beforeRes.body.cards.length - 1);
  });

  it('unsuspended card returns to the review queue', async () => {
    const cardId = await getACardId();
    await request(app).post('/api/suspended').send({ cardId });
    await request(app).delete(`/api/suspended/${cardId}`);

    const res = await request(app).get('/api/review');
    const ids = res.body.cards.map((c: { cardId: string }) => c.cardId);
    expect(ids).toContain(cardId);
  });
});

describe('GET /api/decks stats reflect suspended cards', () => {
  it('suspended count increases when a card is suspended', async () => {
    const cardId = await getACardId();
    const deckId = (await request(app).get('/api/review')).body.cards[0].deckId as string;

    const before = (await request(app).get('/api/decks')).body
      .find((d: { id: string }) => d.id === deckId);
    expect(before.stats.suspended).toBe(0);

    await request(app).post('/api/suspended').send({ cardId });

    const after = (await request(app).get('/api/decks')).body
      .find((d: { id: string }) => d.id === deckId);
    expect(after.stats.suspended).toBe(1);
  });

  it('total remains unchanged after suspending a card', async () => {
    const reviewRes = await request(app).get('/api/review');
    const { cardId, deckId } = reviewRes.body.cards[0];

    const before = (await request(app).get('/api/decks')).body
      .find((d: { id: string }) => d.id === deckId);

    await request(app).post('/api/suspended').send({ cardId });

    const after = (await request(app).get('/api/decks')).body
      .find((d: { id: string }) => d.id === deckId);
    expect(after.stats.total).toBe(before.stats.total);
  });
});
