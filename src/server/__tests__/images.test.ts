import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { initDb } from '../db.js';
import { clearDecks, loadDecks, getAllDecks } from '../decks.js';
import { createApp } from '../index.js';
import type { ParsedDeck } from '../parser.js';

let tmpDir = '';

vi.mock('../config.js', () => ({
  config: {
    get decksDir() { return tmpDir; },
    dbPath: ':memory:',
    settingsPath: '',
    port: 3000,
    githubRepo: undefined,
    githubToken: undefined,
    githubBranch: 'main',
    githubPath: '',
    syncTtlMs: 60000,
  },
}));

const DECK_CONTENT = [
  'Q: What does this show?',
  'A: ![diagram](images/diagram.png)',
  '',
  'Q: Top-level image?',
  'A: ![photo](photo.jpg)',
  '',
  'C: The capital of France is [Paris] ![map](assets/map.png)',
].join('\n');

let deck: ParsedDeck;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeEach(() => {
  tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-img-test-'));
  const tmpDb = join(tmpDir, 'test.db');

  // Create deck file
  writeFileSync(join(tmpDir, 'img-deck.md'), DECK_CONTENT);

  // Create image files
  mkdirSync(join(tmpDir, 'images'));
  writeFileSync(join(tmpDir, 'images', 'diagram.png'), 'PNG_DATA');
  writeFileSync(join(tmpDir, 'photo.jpg'), 'JPG_DATA');
  mkdirSync(join(tmpDir, 'assets'));
  writeFileSync(join(tmpDir, 'assets', 'map.png'), 'MAP_DATA');

  initDb(tmpDb);
  clearDecks();
  loadDecks(tmpDir);

  deck = getAllDecks().find(d => d.name === 'img-deck')!;
  app = createApp();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true });
});

describe('image URL rewriting in rendered cards', () => {
  it('rewrites relative image src in QA answer to /decks/ path', async () => {
    const res = await request(app).get(`/api/review/${deck.id}`);
    expect(res.status).toBe(200);

    const card = res.body.cards.find((c: { revealHtml: string }) =>
      c.revealHtml.includes('diagram.png')
    );
    expect(card).toBeDefined();
    expect(card.revealHtml).toContain('src="/decks/images/diagram.png"');
    // Must not contain a bare relative path
    expect(card.revealHtml).not.toContain('src="images/diagram.png"');
  });

  it('rewrites top-level relative image src to /decks/ path', async () => {
    const res = await request(app).get(`/api/review/${deck.id}`);
    const card = res.body.cards.find((c: { revealHtml: string }) =>
      c.revealHtml.includes('photo.jpg')
    );
    expect(card).toBeDefined();
    expect(card.revealHtml).toContain('src="/decks/photo.jpg"');
  });

  it('rewrites relative image src in cloze cards to /decks/ path', async () => {
    const res = await request(app).get(`/api/review/${deck.id}`);
    const card = res.body.cards.find((c: { revealHtml: string }) =>
      c.revealHtml.includes('map.png')
    );
    expect(card).toBeDefined();
    expect(card.revealHtml).toContain('src="/decks/assets/map.png"');
  });
});

describe('static image serving from /decks/', () => {
  it('serves an image from a subdirectory', async () => {
    const res = await request(app).get('/decks/images/diagram.png');
    expect(res.status).toBe(200);
    expect(res.text).toBe('PNG_DATA');
  });

  it('serves a top-level image', async () => {
    const res = await request(app).get('/decks/photo.jpg');
    expect(res.status).toBe(200);
    expect(res.text).toBe('JPG_DATA');
  });

  it('returns 404 for a non-existent image', async () => {
    const res = await request(app).get('/decks/images/missing.png');
    expect(res.status).toBe(404);
  });
});
