import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
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

const DECK_CONTENT = [
  'Q: What does this show?',
  'A: ![diagram](images/diagram.png)',
  '',
  'Q: Top-level image?',
  'A: ![photo](photo.jpg)',
  '',
  'C: The capital of France is [Paris] ![map](assets/map.png)',
].join('\n');

let tmpDir = '';
let deck: Deck;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeEach(async () => {
  tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-img-test-'));

  // Create deck file
  writeFileSync(join(tmpDir, 'img-deck.md'), DECK_CONTENT);

  // Create image files
  mkdirSync(join(tmpDir, 'images'));
  writeFileSync(join(tmpDir, 'images', 'diagram.png'), 'PNG_DATA');
  writeFileSync(join(tmpDir, 'photo.jpg'), 'JPG_DATA');
  mkdirSync(join(tmpDir, 'assets'));
  writeFileSync(join(tmpDir, 'assets', 'map.png'), 'MAP_DATA');

  const db = new Database(join(tmpDir, 'test.db'));
  initDb(db);
  const cardRepo = new SqliteCardRepository(db);
  const deckSource = new LocalDeckSource(tmpDir, cardRepo);
  await deckSource.sync(true);

  deck = deckSource.getAll().find(d => d.name === 'img-deck')!;

  const settingsRepo = new JsonSettingsRepository(join(tmpDir, 'settings.json'));
  // Pass tmpDir as decksDir so image URLs are resolved against it
  const renderer = new HtmlCardRenderer({ decksDir: tmpDir, githubBranch: 'main' });
  const deckService = new DeckService(deckSource, cardRepo, settingsRepo);
  const reviewService = new ReviewService(cardRepo, deckSource, settingsRepo, renderer);
  app = createApp(deckService, reviewService, tmpDir);
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

});

describe('static image serving from /decks/', () => {
  it('returns 404 for a non-existent image', async () => {
    const res = await request(app).get('/decks/images/missing.png');
    expect(res.status).toBe(404);
  });
});
