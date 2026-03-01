import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { initDb } from '../db.js';
import { clearDecks, loadDecks } from '../decks.js';
import { createApp } from '../index.js';

const DECK_A_CONTENT = 'Q: What is 2+2?\nA: 4\n\nQ: Capital of France?\nA: Paris';
const DECK_B_CONTENT = 'Q: What color is the sky?\nA: Blue\n\nC: The [sun] rises in the [east]';

let tmpDir: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeEach(() => {
  tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-test-'));
  const tmpDb = join(tmpDir, 'test.db');

  writeFileSync(join(tmpDir, 'deck-a.md'), DECK_A_CONTENT);
  writeFileSync(join(tmpDir, 'deck-b.md'), DECK_B_CONTENT);

  initDb(tmpDb);
  clearDecks();
  loadDecks(tmpDir);

  app = createApp();
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
