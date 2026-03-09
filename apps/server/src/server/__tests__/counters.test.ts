/**
 * Integration tests for review counters and per-deck new-card limit logic.
 *
 * Scenarios covered:
 *  - countNewReviewedTodayForDeck: zero when nothing reviewed, 1 after first review,
 *    still 1 after card is reviewed Again→Good in the same session,
 *    0 for a card whose first review was yesterday,
 *    cross-deck isolation (other decks do not affect the count).
 *  - getStats due count: shows real count without capping.
 *  - Global review queue: unlimited by default; per-deck max_new frontmatter caps that deck.
 *  - Per-deck review queue: respects max_new from frontmatter; unlimited when absent.
 *  - Daily budget resets correctly and remaining budget is tracked per deck.
 */

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
import { schedule } from '../../domain/fsrs.js';
import type { Rating } from '../../domain/fsrs.js';
import type { Deck } from '../../domain/card.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function doReview(repo: SqliteCardRepository, cardId: string, rating: Rating, at: Date): void {
  const card = repo.findById(cardId)!;
  const result = schedule(card, rating, at);
  repo.save(cardId, result.card, rating);
}

/** a Date clearly in the past (yesterday) */
function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

// ---------------------------------------------------------------------------
// countNewReviewedTodayForDeck — direct DB-function tests
// ---------------------------------------------------------------------------

describe('countNewReviewedTodayForDeck', () => {
  let tmpDir: string;
  let cardRepo: SqliteCardRepository;
  const now = new Date();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-counters-'));
    const db = new Database(join(tmpDir, 'test.db'));
    initDb(db);
    cardRepo = new SqliteCardRepository(db);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it('returns 0 when no cards have been reviewed', () => {
    cardRepo.ensure('c1', 'deck-x', 'qa', null, now);
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(0);
  });

  it('returns 1 after a new card is reviewed once (Good)', () => {
    cardRepo.ensure('c1', 'deck-x', 'qa', null, now);
    doReview(cardRepo, 'c1', 3, now);
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(1);
  });

  it('returns 1 after a new card is reviewed once (Easy — goes straight to Review state)', () => {
    cardRepo.ensure('c1', 'deck-x', 'qa', null, now);
    doReview(cardRepo, 'c1', 4, now);
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(1);
  });

  it('still returns 1 after a card is reviewed Again then Good in the same session', () => {
    cardRepo.ensure('c1', 'deck-x', 'qa', null, now);
    doReview(cardRepo, 'c1', 1, now); // Again: New→Learning, reps=1
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(1);

    doReview(cardRepo, 'c1', 3, now); // Good: Learning→Review, reps=2
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(1);
  });

  it('returns 0 for a card whose first review was yesterday', () => {
    const yd = yesterday();
    cardRepo.ensure('c1', 'deck-x', 'qa', null, yd);
    doReview(cardRepo, 'c1', 3, yd);
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(0);
  });

  it('counts multiple distinct cards reviewed today', () => {
    for (let i = 0; i < 3; i++) {
      cardRepo.ensure(`c${i}`, 'deck-x', 'qa', null, now);
      doReview(cardRepo, `c${i}`, 3, now);
    }
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(3);
  });

  it('does not double-count a card reviewed many times today', () => {
    cardRepo.ensure('c1', 'deck-x', 'qa', null, now);
    doReview(cardRepo, 'c1', 1, now);
    doReview(cardRepo, 'c1', 1, now);
    doReview(cardRepo, 'c1', 3, now);
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(1);
  });

  it('does not count a review-state card reviewed today as a new card consumed', () => {
    const yd = yesterday();
    cardRepo.ensure('c1', 'deck-x', 'qa', null, yd);
    doReview(cardRepo, 'c1', 4, yd); // Easy: New→Review yesterday

    doReview(cardRepo, 'c1', 3, now); // Good from Review state today
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(0);
  });

  it('does not count cards from other decks', () => {
    cardRepo.ensure('c1', 'deck-x', 'qa', null, now);
    cardRepo.ensure('c2', 'deck-y', 'qa', null, now);
    doReview(cardRepo, 'c1', 3, now);
    doReview(cardRepo, 'c2', 3, now);
    expect(cardRepo.countNewReviewedTodayForDeck('deck-x', now)).toBe(1);
    expect(cardRepo.countNewReviewedTodayForDeck('deck-y', now)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getStats due count
// ---------------------------------------------------------------------------

describe('getStats', () => {
  let tmpDir: string;
  let cardRepo: SqliteCardRepository;
  const now = new Date();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-counters-'));
    const db = new Database(join(tmpDir, 'test.db'));
    initDb(db);
    cardRepo = new SqliteCardRepository(db);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it('counts all new cards as due', () => {
    for (let i = 0; i < 5; i++) cardRepo.ensure(`c${i}`, 'deck-x', 'qa', null, now);
    const stats = cardRepo.getStats('deck-x', now);
    expect(stats.total).toBe(5);
    expect(stats.due).toBe(5);
    expect(stats.newCards).toBe(5);
  });

  it('always counts review-state (state>0) due cards', () => {
    const past = new Date(now.getTime() - 2 * 60 * 1000); // 2 minutes ago
    cardRepo.ensure('r4', 'deck-x', 'qa', null, past);
    doReview(cardRepo, 'r4', 1, past); // Again from New at past → state=1, due ~1 min ago

    cardRepo.ensure('new1', 'deck-x', 'qa', null, now);
    cardRepo.ensure('new2', 'deck-x', 'qa', null, now);

    const stats = cardRepo.getStats('deck-x', now);
    expect(stats.due).toBeGreaterThanOrEqual(1); // r4 (Learning, due) must appear
  });
});

// ---------------------------------------------------------------------------
// API-level integration tests
// ---------------------------------------------------------------------------

const DECK_A_UNLIMITED = ['Q: A1?', 'A: a1', '', 'Q: A2?', 'A: a2', '', 'Q: A3?', 'A: a3'].join('\n');
const DECK_B_UNLIMITED = ['Q: B1?', 'A: b1', '', 'Q: B2?', 'A: b2', '', 'Q: B3?', 'A: b3'].join('\n');

function deckWithLimit(limit: number, cards: string): string {
  return `---\nmax_new = ${limit}\n---\n${cards}`;
}

let tmpDir: string;
let deckA: Deck;
let deckB: Deck;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
let cardRepo: SqliteCardRepository;
let deckSource: LocalDeckSource;

beforeEach(async () => {
  tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-counters-api-'));
  const db = new Database(join(tmpDir, 'test.db'));
  initDb(db);
  cardRepo = new SqliteCardRepository(db);

  writeFileSync(join(tmpDir, 'deck-a.md'), DECK_A_UNLIMITED);
  writeFileSync(join(tmpDir, 'deck-b.md'), DECK_B_UNLIMITED);

  deckSource = new LocalDeckSource(tmpDir, cardRepo);
  await deckSource.sync(true);

  const decks = deckSource.getAll();
  deckA = decks.find(d => d.name === 'deck-a')!;
  deckB = decks.find(d => d.name === 'deck-b')!;

  const settingsRepo = new JsonSettingsRepository(join(tmpDir, 'settings.json'));
  const renderer = new HtmlCardRenderer({ decksDir: tmpDir, githubBranch: 'main' });
  const deckService = new DeckService(deckSource, cardRepo);
  const reviewService = new ReviewService(cardRepo, deckSource, settingsRepo, renderer);
  app = createApp(deckService, reviewService, tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true });
});

describe('Default (no max_new) — unlimited new cards', () => {
  it('global /api/review returns all new cards from all decks', async () => {
    const res = await request(app).get('/api/review');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(6); // 3 + 3
  });

  it('per-deck endpoint returns all new cards', async () => {
    const resA = await request(app).get(`/api/review/${deckA.id}`);
    const resB = await request(app).get(`/api/review/${deckB.id}`);
    expect(resA.body.cards).toHaveLength(3);
    expect(resB.body.cards).toHaveLength(3);
  });

  it('deck stats due equals total for all decks', async () => {
    const decks = (await request(app).get('/api/decks')).body;
    for (const deck of decks) {
      expect(deck.stats.due).toBe(deck.stats.total);
    }
  });
});

describe('Per-deck max_new frontmatter cap', () => {
  beforeEach(async () => {
    // Rewrite deck-a with max_new = 2
    writeFileSync(join(tmpDir, 'deck-a.md'), deckWithLimit(2, 'Q: A1?\nA: a1\n\nQ: A2?\nA: a2\n\nQ: A3?\nA: a3'));
    await deckSource.sync(true);
    deckA = deckSource.getAll().find(d => d.name === 'deck-a')!;
  });

  it('global queue: limited deck contributes max_new, unlimited deck contributes all', async () => {
    const res = await request(app).get('/api/review');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(5); // deck-a: 2, deck-b: 3
  });

  it('per-deck queue for limited deck returns at most max_new cards', async () => {
    const res = await request(app).get(`/api/review/${deckA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(2);
    for (const c of res.body.cards) expect(c.deckId).toBe(deckA.id);
  });

  it('per-deck queue for unlimited deck returns all cards', async () => {
    const res = await request(app).get(`/api/review/${deckB.id}`);
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(3);
  });

  it('after exhausting deck-a limit, deck-a per-deck queue shows 0 new cards', async () => {
    const queueA = await request(app).get(`/api/review/${deckA.id}`);
    for (const card of queueA.body.cards) {
      await request(app).post('/api/review').send({ cardId: card.cardId, pass: true });
    }

    const afterA = await request(app).get(`/api/review/${deckA.id}`);
    // Learning cards (state=1) due in the future won't appear; new slots exhausted
    const newCards = afterA.body.cards.filter((c: { cardId: string }) =>
      !queueA.body.cards.some((q: { cardId: string }) => q.cardId === c.cardId)
    );
    expect(newCards).toHaveLength(0);
  });

  it('after exhausting deck-a limit, deck-b still shows all cards in global queue', async () => {
    const queueA = await request(app).get(`/api/review/${deckA.id}`);
    for (const card of queueA.body.cards) {
      await request(app).post('/api/review').send({ cardId: card.cardId, pass: true });
    }

    const globalQueue = await request(app).get('/api/review');
    const deckBCards = globalQueue.body.cards.filter((c: { deckId: string }) => c.deckId === deckB.id);
    expect(deckBCards).toHaveLength(3);
  });

  it('deck stats shows real due count (not capped by max_new)', async () => {
    const decks = (await request(app).get('/api/decks')).body;
    const deckAStats = decks.find((d: { id: string }) => d.id === deckA.id);
    // Stats always shows real count — all 3 are due
    expect(deckAStats.stats.due).toBe(3);
    expect(deckAStats.stats.newCards).toBe(3);
  });
});

describe('Daily budget counter is correct across multiple reviews of the same card', () => {
  beforeEach(async () => {
    writeFileSync(join(tmpDir, 'deck-a.md'), deckWithLimit(2, 'Q: A1?\nA: a1\n\nQ: A2?\nA: a2\n\nQ: A3?\nA: a3'));
    await deckSource.sync(true);
    deckA = deckSource.getAll().find(d => d.name === 'deck-a')!;
  });

  it('a card reviewed Again then Good still counts as 1 toward the daily cap', async () => {
    const queueFirst = await request(app).get(`/api/review/${deckA.id}`);
    const firstCard = queueFirst.body.cards[0];

    await request(app).post('/api/review').send({ cardId: firstCard.cardId, pass: false }); // Again → Learning

    // 1 slot used out of 2 — should see 1 new card remaining
    const queueSecond = await request(app).get(`/api/review/${deckA.id}`);
    const secondNewCards = queueSecond.body.cards.filter(
      (c: { cardId: string }) => c.cardId !== firstCard.cardId
    );
    expect(secondNewCards).toHaveLength(1);

    await request(app).post('/api/review').send({ cardId: secondNewCards[0].cardId, pass: true });

    // Both slots used — no more new cards from deck-a
    const queueFinal = await request(app).get(`/api/review/${deckA.id}`);
    const finalNewCards = queueFinal.body.cards.filter(
      (c: { cardId: string }) =>
        c.cardId !== firstCard.cardId && c.cardId !== secondNewCards[0].cardId
    );
    expect(finalNewCards).toHaveLength(0);
  });
});
