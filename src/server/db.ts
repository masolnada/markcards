import Database from 'better-sqlite3';
import type { FSRSCard } from './fsrs.js';
import type { CardState, Rating } from './fsrs.js';

let db: Database.Database;

export function initDb(dbPath: string): void {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
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

interface CardRow {
  card_id: string;
  deck_id: string;
  card_type: string;
  cloze_index: number | null;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  created_at: string;
}

function rowToFSRSCard(row: CardRow): FSRSCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsed_days,
    scheduledDays: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as CardState,
    lastReview: row.last_review ? new Date(row.last_review) : null,
  };
}

// Ensure a card exists in the DB (upsert on first encounter)
export function ensureCard(cardId: string, deckId: string, cardType: 'qa' | 'cloze', clozeIndex: number | null, now: Date): FSRSCard {
  const existing = db.prepare('SELECT * FROM cards WHERE card_id = ?').get(cardId) as CardRow | undefined;
  if (existing) return rowToFSRSCard(existing);

  const dueStr = now.toISOString();
  db.prepare(`
    INSERT INTO cards (card_id, deck_id, card_type, cloze_index, due, stability, difficulty,
      elapsed_days, scheduled_days, reps, lapses, state, last_review)
    VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, NULL)
  `).run(cardId, deckId, cardType, clozeIndex, dueStr);

  return rowToFSRSCard(db.prepare('SELECT * FROM cards WHERE card_id = ?').get(cardId) as CardRow);
}

export function getCard(cardId: string): FSRSCard | null {
  const row = db.prepare('SELECT * FROM cards WHERE card_id = ?').get(cardId) as CardRow | undefined;
  return row ? rowToFSRSCard(row) : null;
}

export function updateCard(cardId: string, card: FSRSCard, rating: Rating): void {
  db.prepare(`
    UPDATE cards
    SET due = ?, stability = ?, difficulty = ?, elapsed_days = ?,
        scheduled_days = ?, reps = ?, lapses = ?, state = ?, last_review = ?
    WHERE card_id = ?
  `).run(
    card.due.toISOString(),
    card.stability,
    card.difficulty,
    card.elapsedDays,
    card.scheduledDays,
    card.reps,
    card.lapses,
    card.state,
    card.lastReview ? card.lastReview.toISOString() : null,
    cardId,
  );

  db.prepare(`
    INSERT INTO review_log (card_id, rating, scheduled_days, elapsed_days, review_time)
    VALUES (?, ?, ?, ?, ?)
  `).run(cardId, rating, card.scheduledDays, card.elapsedDays, (card.lastReview ?? new Date()).toISOString());
}

// Returns all card IDs for a deck that are due <= now
export function getDueCardIds(deckId: string, now: Date): string[] {
  const rows = db.prepare(
    `SELECT card_id FROM cards WHERE deck_id = ? AND due <= ? ORDER BY due ASC`
  ).all(deckId, now.toISOString()) as { card_id: string }[];
  return rows.map(r => r.card_id);
}

// Returns all card IDs for a deck that are new (state = 0)
export function getNewCardIds(deckId: string): string[] {
  const rows = db.prepare(
    `SELECT card_id FROM cards WHERE deck_id = ? AND state = 0`
  ).all(deckId) as { card_id: string }[];
  return rows.map(r => r.card_id);
}

export interface DeckStats {
  total: number;
  due: number;
  newCards: number;
}

export function getDeckStats(deckId: string, now: Date): DeckStats {
  const total = (db.prepare('SELECT COUNT(*) as c FROM cards WHERE deck_id = ?').get(deckId) as { c: number }).c;
  const due = (db.prepare(
    `SELECT COUNT(*) as c FROM cards WHERE deck_id = ? AND due <= ?`
  ).get(deckId, now.toISOString()) as { c: number }).c;
  const newCards = (db.prepare(
    `SELECT COUNT(*) as c FROM cards WHERE deck_id = ? AND state = 0`
  ).get(deckId) as { c: number }).c;
  return { total, due, newCards };
}

// Get all due cards across all decks
export function getAllDueCardIds(now: Date): { cardId: string; deckId: string }[] {
  const rows = db.prepare(
    `SELECT card_id, deck_id FROM cards WHERE due <= ? ORDER BY due ASC`
  ).all(now.toISOString()) as { card_id: string; deck_id: string }[];
  return rows.map(r => ({ cardId: r.card_id, deckId: r.deck_id }));
}

// Get due non-new cards (state > 0) across all decks
export function getDueReviewCardIds(now: Date): { cardId: string; deckId: string }[] {
  const rows = db.prepare(
    `SELECT card_id, deck_id FROM cards WHERE state > 0 AND due <= ? ORDER BY due ASC`
  ).all(now.toISOString()) as { card_id: string; deck_id: string }[];
  return rows.map(r => ({ cardId: r.card_id, deckId: r.deck_id }));
}

// Get new cards (state = 0) due now, up to limit
export function getNewCardIdsForQueue(now: Date, limit: number): { cardId: string; deckId: string }[] {
  if (limit <= 0) return [];
  const rows = db.prepare(
    `SELECT card_id, deck_id FROM cards WHERE state = 0 AND due <= ? ORDER BY due ASC LIMIT ?`
  ).all(now.toISOString(), limit) as { card_id: string; deck_id: string }[];
  return rows.map(r => ({ cardId: r.card_id, deckId: r.deck_id }));
}

// Count new cards whose first review happened today (local time)
export function countNewCardsReviewedToday(now: Date): number {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const result = db.prepare(
    `SELECT COUNT(*) as c FROM cards WHERE reps = 1 AND last_review >= ?`
  ).get(todayStart.toISOString()) as { c: number };
  return result.c;
}
