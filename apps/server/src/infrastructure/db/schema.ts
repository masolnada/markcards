import type { Database } from 'bun:sqlite';

export function initDb(db: Database): void {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
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
    );

    CREATE TABLE IF NOT EXISTS review_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id        TEXT    NOT NULL,
      rating         INTEGER NOT NULL,
      scheduled_days INTEGER NOT NULL,
      elapsed_days   INTEGER NOT NULL,
      review_time    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_cards_deck_due ON cards(deck_id, due);
  `);
}
