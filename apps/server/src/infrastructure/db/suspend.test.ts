import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import { Database } from 'bun:sqlite';
import { initDb } from './schema.js';
import { SqliteCardRepository } from './sqlite-card-repository.js';

const NOW = new Date('2025-01-01T00:00:00Z');

let tmpDir: string;
let db: Database;
let repo: SqliteCardRepository;

beforeEach(() => {
  tmpDir = mkdtempSync(join(os.tmpdir(), 'markcards-suspend-test-'));
  db = new Database(join(tmpDir, 'test.db'));
  initDb(db);
  repo = new SqliteCardRepository(db);
});

function cleanup() {
  rmSync(tmpDir, { recursive: true });
}

// Helper — creates a new card in state=0 (New) due now
function seed(cardId: string, deckId = 'deck-1') {
  return repo.ensure(cardId, deckId, 'qa', null, NOW);
}

describe('initDb migration — suspended column', () => {
  it('adds suspended column to an existing DB that lacks it', () => {
    // Build a DB that represents the old schema (no suspended column)
    const legacyDb = new Database(join(tmpDir, 'legacy.db'));
    legacyDb.exec('PRAGMA journal_mode = WAL');
    legacyDb.exec(`
      CREATE TABLE cards (
        card_id        TEXT    PRIMARY KEY,
        deck_id        TEXT    NOT NULL,
        card_type      TEXT    NOT NULL,
        cloze_index    INTEGER,
        due            TEXT    NOT NULL,
        stability      REAL    NOT NULL DEFAULT 0,
        difficulty     REAL    NOT NULL DEFAULT 0,
        elapsed_days   INTEGER NOT NULL DEFAULT 0,
        scheduled_days INTEGER NOT NULL DEFAULT 0,
        reps           INTEGER NOT NULL DEFAULT 0,
        lapses         INTEGER NOT NULL DEFAULT 0,
        state          INTEGER NOT NULL DEFAULT 0,
        last_review    TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);
    legacyDb.exec(`INSERT INTO cards (card_id, deck_id, card_type, due) VALUES ('c1', 'd1', 'qa', '2025-01-01')`);

    // Migration should add the column without error
    initDb(legacyDb);

    const cols = legacyDb.query<{ name: string }, []>('PRAGMA table_info(cards)').all();
    expect(cols.some(c => c.name === 'suspended')).toBe(true);

    // Existing row should default to 0
    const row = legacyDb.query<{ suspended: number }, []>('SELECT suspended FROM cards').get();
    expect(row?.suspended).toBe(0);
  });

  it('is idempotent — running initDb twice does not error', () => {
    expect(() => initDb(db)).not.toThrow();
  });
});

describe('SqliteCardRepository.setSuspended', () => {
  it('marks a card as suspended', () => {
    seed('c1');
    repo.setSuspended('c1', true);

    const ids = repo.getSuspendedIds();
    expect(ids).toHaveLength(1);
    expect(ids[0].cardId).toBe('c1');
  });

  it('unsuspends a previously suspended card', () => {
    seed('c1');
    repo.setSuspended('c1', true);
    repo.setSuspended('c1', false);

    expect(repo.getSuspendedIds()).toHaveLength(0);
  });

  it('is a no-op for an unknown cardId', () => {
    expect(() => repo.setSuspended('no-such-card', true)).not.toThrow();
    expect(repo.getSuspendedIds()).toHaveLength(0);
  });
});

describe('SqliteCardRepository.getSuspendedIds', () => {
  it('returns empty array when no cards are suspended', () => {
    seed('c1');
    expect(repo.getSuspendedIds()).toHaveLength(0);
  });

  it('returns only suspended cards with correct deckId', () => {
    seed('c1', 'deck-1');
    seed('c2', 'deck-2');
    seed('c3', 'deck-1');

    repo.setSuspended('c1', true);
    repo.setSuspended('c3', true);

    const ids = repo.getSuspendedIds();
    expect(ids).toHaveLength(2);
    expect(ids.find(r => r.cardId === 'c1')?.deckId).toBe('deck-1');
    expect(ids.find(r => r.cardId === 'c3')?.deckId).toBe('deck-1');
    expect(ids.find(r => r.cardId === 'c2')).toBeUndefined();
  });
});

describe('due-card queries exclude suspended cards', () => {
  it('getDueReviewIds excludes suspended cards', () => {
    // Seed and advance c1 to state>0 (reviewed once) so it appears in review queue
    seed('c1');
    seed('c2');
    repo.save('c1', { ...repo.ensure('c1', 'deck-1', 'qa', null, NOW), state: 2, due: NOW }, 3);
    repo.save('c2', { ...repo.ensure('c2', 'deck-1', 'qa', null, NOW), state: 2, due: NOW }, 3);

    repo.setSuspended('c1', true);

    const ids = repo.getDueReviewIds(NOW);
    expect(ids.map(r => r.cardId)).not.toContain('c1');
    expect(ids.map(r => r.cardId)).toContain('c2');
  });

  it('getDueReviewIdsForDeck excludes suspended cards', () => {
    seed('c1', 'deck-1');
    seed('c2', 'deck-1');
    repo.save('c1', { ...repo.ensure('c1', 'deck-1', 'qa', null, NOW), state: 2, due: NOW }, 3);
    repo.save('c2', { ...repo.ensure('c2', 'deck-1', 'qa', null, NOW), state: 2, due: NOW }, 3);

    repo.setSuspended('c1', true);

    const ids = repo.getDueReviewIdsForDeck('deck-1', NOW);
    expect(ids.map(r => r.cardId)).not.toContain('c1');
    expect(ids.map(r => r.cardId)).toContain('c2');
  });

  it('getNewIdsForDeckQueue excludes suspended new cards', () => {
    seed('c1', 'deck-1');
    seed('c2', 'deck-1');

    repo.setSuspended('c1', true);

    const ids = repo.getNewIdsForDeckQueue('deck-1', NOW);
    expect(ids.map(r => r.cardId)).not.toContain('c1');
    expect(ids.map(r => r.cardId)).toContain('c2');
  });
});

describe('SqliteCardRepository.getStats with suspended cards', () => {
  it('suspended count reflects how many cards are suspended', () => {
    seed('c1', 'deck-1');
    seed('c2', 'deck-1');
    seed('c3', 'deck-1');

    repo.setSuspended('c1', true);
    repo.setSuspended('c2', true);

    const stats = repo.getStats('deck-1', NOW);
    expect(stats.suspended).toBe(2);
  });

  it('total remains inclusive of suspended cards', () => {
    seed('c1', 'deck-1');
    seed('c2', 'deck-1');
    repo.setSuspended('c1', true);

    const stats = repo.getStats('deck-1', NOW);
    expect(stats.total).toBe(2);
  });

  it('due excludes suspended cards', () => {
    seed('c1', 'deck-1');
    seed('c2', 'deck-1');
    repo.setSuspended('c1', true);

    const stats = repo.getStats('deck-1', NOW);
    expect(stats.due).toBe(1); // only c2 is due
  });

  it('newCards excludes suspended cards', () => {
    seed('c1', 'deck-1');
    seed('c2', 'deck-1');
    repo.setSuspended('c1', true);

    const stats = repo.getStats('deck-1', NOW);
    expect(stats.newCards).toBe(1);
  });
});
