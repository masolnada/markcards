import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { initDb } from '../db.js';
import { clearDecks, loadDecks, getAllDecks } from '../decks.js';
import { initSettings } from '../settings.js';
import { createApp } from '../index.js';
import type { ParsedDeck } from '../parser.js';

const DECK_CONTENT = [
  'Q: Card one?',
  'A: One',
  '',
  'Q: Card two?',
  'A: Two',
  '',
  'Q: Card three?',
  'A: Three',
].join('\n');

let tmpDir: string;
let settingsFile: string;
let deck: ParsedDeck;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeEach(() => {
  tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-settings-test-'));
  settingsFile = join(tmpDir, 'settings.json');

  writeFileSync(join(tmpDir, 'deck.md'), DECK_CONTENT);

  initDb(join(tmpDir, 'test.db'));
  initSettings(settingsFile);
  clearDecks();
  loadDecks(tmpDir);

  deck = getAllDecks()[0];
  app = createApp();
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(tmpDir, { recursive: true });
});

describe('maxNewPerDay', () => {
  it('returns all 3 new cards when no settings file exists (uses default of 20)', async () => {
    const res = await request(app).get('/api/review');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(3);
  });

  it('returns 0 cards when maxNewPerDay is 0', async () => {
    writeFileSync(settingsFile, JSON.stringify({ maxNewPerDay: 0 }));

    const res = await request(app).get('/api/review');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(0);
  });

  it('returns exactly 2 cards when maxNewPerDay is 2', async () => {
    writeFileSync(settingsFile, JSON.stringify({ maxNewPerDay: 2 }));

    const res = await request(app).get('/api/review');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(2);
  });

  it('limits count on deck-specific endpoint too', async () => {
    writeFileSync(settingsFile, JSON.stringify({ maxNewPerDay: 1 }));

    const res = await request(app).get(`/api/review/${deck.id}`);
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(1);
  });

  it('counts new cards reviewed today toward the limit', async () => {
    writeFileSync(settingsFile, JSON.stringify({ maxNewPerDay: 2 }));

    // Review one card — uses limit slot
    const listRes = await request(app).get('/api/review');
    const cardId = listRes.body.cards[0].cardId;
    await request(app).post('/api/review').send({ cardId, pass: true });

    // Now only 1 slot remains
    const res = await request(app).get('/api/review');
    expect(res.status).toBe(200);
    // 1 card still in Learning (due soon), 1 new slot left → 2 total or fewer
    const newCards = res.body.cards.filter((c: any) => c.cardId !== cardId);
    expect(newCards.length).toBeLessThanOrEqual(1);
  });
});

describe('learningSteps — 1-week step', () => {
  it('card with 1-week step is not due before 1 week and is due after 1 week', async () => {
    // t0 must be >= cards' due dates (set during beforeEach with real time)
    const t0 = new Date('2030-01-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(t0);

    writeFileSync(settingsFile, JSON.stringify({ learningSteps: [1, 10080] }));

    const listRes = await request(app).get('/api/review');
    expect(listRes.body.cards.length).toBeGreaterThan(0);
    const cardId = listRes.body.cards[0].cardId;

    // Pass → Good → scheduled at last learning step (10080 min)
    const postRes = await request(app).post('/api/review').send({ cardId, pass: true });
    expect(postRes.status).toBe(200);
    expect(new Date(postRes.body.nextDue).getTime()).toBe(t0.getTime() + 10080 * 60 * 1000);

    // Not due 1 day later
    vi.setSystemTime(new Date(t0.getTime() + 24 * 60 * 60 * 1000));
    const earlyQueue = (await request(app).get('/api/review')).body;
    expect(earlyQueue.cards.some((c: any) => c.cardId === cardId)).toBe(false);

    // Due after 10080 min + 1 min
    vi.setSystemTime(new Date(t0.getTime() + (10080 + 1) * 60 * 1000));
    const lateQueue = (await request(app).get('/api/review')).body;
    expect(lateQueue.cards.some((c: any) => c.cardId === cardId)).toBe(true);
  });
});

describe('learningSteps — 1-month step', () => {
  it('card with 1-month step is not due before 30 days and is due after 30 days', async () => {
    const t0 = new Date('2030-01-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(t0);

    writeFileSync(settingsFile, JSON.stringify({ learningSteps: [1, 43200] }));

    const listRes = await request(app).get('/api/review');
    const cardId = listRes.body.cards[0].cardId;

    const postRes = await request(app).post('/api/review').send({ cardId, pass: true });
    expect(postRes.status).toBe(200);
    expect(new Date(postRes.body.nextDue).getTime()).toBe(t0.getTime() + 43200 * 60 * 1000);

    // Not due after 29 days
    vi.setSystemTime(new Date(t0.getTime() + 29 * 24 * 60 * 60 * 1000));
    const earlyQueue = (await request(app).get('/api/review')).body;
    expect(earlyQueue.cards.some((c: any) => c.cardId === cardId)).toBe(false);

    // Due after 43200 min + 1 min
    vi.setSystemTime(new Date(t0.getTime() + (43200 + 1) * 60 * 1000));
    const lateQueue = (await request(app).get('/api/review')).body;
    expect(lateQueue.cards.some((c: any) => c.cardId === cardId)).toBe(true);
  });
});

describe('relearningSteps — 1-week relearning step', () => {
  it('failed Review card reappears after 1 week with relearningSteps:[10080]', async () => {
    const t0 = new Date('2030-01-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(t0);

    // Graduate a card to Review state: New → Learning → Review
    // Default learningSteps [1,10], but we set relearningSteps to test it
    writeFileSync(settingsFile, JSON.stringify({ relearningSteps: [10080] }));

    const listRes = await request(app).get('/api/review');
    const cardId = listRes.body.cards[0].cardId;

    // First pass: New → Learning (state=1), scheduled 10 min out
    const pass1 = await request(app).post('/api/review').send({ cardId, pass: true });
    expect(pass1.status).toBe(200);
    expect(pass1.body.state).toBe(1); // Learning

    // Advance past learning step, review again: Learning → Review (state=2)
    vi.setSystemTime(new Date(t0.getTime() + 11 * 60 * 1000));
    const pass2 = await request(app).post('/api/review').send({ cardId, pass: true });
    expect(pass2.status).toBe(200);
    expect(pass2.body.state).toBe(2); // Review

    // Now fail the Review card → Relearning (state=3), due in 10080 min
    const reviewDue = new Date(pass2.body.nextDue);
    vi.setSystemTime(reviewDue);
    const fail = await request(app).post('/api/review').send({ cardId, pass: false });
    expect(fail.status).toBe(200);
    expect(fail.body.state).toBe(3); // Relearning
    const relearningDue = new Date(fail.body.nextDue);
    expect(relearningDue.getTime()).toBe(reviewDue.getTime() + 10080 * 60 * 1000);

    // Not due 1 day after the fail
    vi.setSystemTime(new Date(reviewDue.getTime() + 24 * 60 * 60 * 1000));
    const earlyQueue = (await request(app).get('/api/review')).body;
    expect(earlyQueue.cards.some((c: any) => c.cardId === cardId)).toBe(false);

    // Due after 10080 min + 1 min
    vi.setSystemTime(new Date(reviewDue.getTime() + (10080 + 1) * 60 * 1000));
    const lateQueue = (await request(app).get('/api/review')).body;
    expect(lateQueue.cards.some((c: any) => c.cardId === cardId)).toBe(true);
  });
});
