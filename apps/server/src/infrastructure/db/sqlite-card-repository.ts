import type { Database } from 'bun:sqlite';
import type { CardType } from '../../domain/card.js';
import type { FSRSCard, Rating, CardState } from '../../domain/fsrs.js';
import type { CardRepository, DeckStats } from '../../application/ports/card-repository.js';

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

export class SqliteCardRepository implements CardRepository {
  constructor(private db: Database) {}

  ensure(id: string, deckId: string, type: CardType, clozeIndex: number | null, now: Date): FSRSCard {
    const existing = this.db.query<CardRow, [string]>('SELECT * FROM cards WHERE card_id = ?').get(id);
    if (existing) return rowToFSRSCard(existing);

    const dueStr = now.toISOString();
    this.db.query(`
      INSERT INTO cards (card_id, deck_id, card_type, cloze_index, due, stability, difficulty,
        elapsed_days, scheduled_days, reps, lapses, state, last_review)
      VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, NULL)
    `).run(id, deckId, type, clozeIndex, dueStr);

    return rowToFSRSCard(this.db.query<CardRow, [string]>('SELECT * FROM cards WHERE card_id = ?').get(id)!);
  }

  findById(id: string): FSRSCard | null {
    const row = this.db.query<CardRow, [string]>('SELECT * FROM cards WHERE card_id = ?').get(id);
    return row ? rowToFSRSCard(row) : null;
  }

  save(id: string, card: FSRSCard, rating: Rating): void {
    this.db.query(`
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
      id,
    );

    this.db.query(`
      INSERT INTO review_log (card_id, rating, scheduled_days, elapsed_days, review_time)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, rating, card.scheduledDays, card.elapsedDays, (card.lastReview ?? new Date()).toISOString());
  }

  getDueReviewIds(now: Date): { cardId: string; deckId: string }[] {
    const rows = this.db.query<{ card_id: string; deck_id: string }, [string]>(
      `SELECT card_id, deck_id FROM cards WHERE state > 0 AND due <= ? ORDER BY due ASC`
    ).all(now.toISOString());
    return rows.map(r => ({ cardId: r.card_id, deckId: r.deck_id }));
  }

  getDueReviewIdsForDeck(deckId: string, now: Date): { cardId: string; deckId: string }[] {
    const rows = this.db.query<{ card_id: string }, [string, string]>(
      `SELECT card_id FROM cards WHERE deck_id = ? AND state > 0 AND due <= ? ORDER BY due ASC`
    ).all(deckId, now.toISOString());
    return rows.map(r => ({ cardId: r.card_id, deckId }));
  }

  getNewIdsForDeckQueue(deckId: string, now: Date, limit?: number): { cardId: string; deckId: string }[] {
    if (limit !== undefined && limit <= 0) return [];
    if (limit !== undefined) {
      const rows = this.db.query<{ card_id: string }, [string, string, number]>(
        `SELECT card_id FROM cards WHERE deck_id = ? AND state = 0 AND due <= ? ORDER BY due ASC LIMIT ?`
      ).all(deckId, now.toISOString(), limit);
      return rows.map(r => ({ cardId: r.card_id, deckId }));
    }
    const rows = this.db.query<{ card_id: string }, [string, string]>(
      `SELECT card_id FROM cards WHERE deck_id = ? AND state = 0 AND due <= ? ORDER BY due ASC`
    ).all(deckId, now.toISOString());
    return rows.map(r => ({ cardId: r.card_id, deckId }));
  }

  countNewReviewedTodayForDeck(deckId: string, now: Date): number {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const result = this.db.query<{ c: number }, [string, string]>(`
      SELECT COUNT(*) as c FROM (
        SELECT MIN(rl.id) as first_id FROM review_log rl
        JOIN cards c ON c.card_id = rl.card_id
        WHERE c.deck_id = ?
        GROUP BY rl.card_id
      ) first_reviews
      JOIN review_log rl ON rl.id = first_reviews.first_id
      WHERE rl.review_time >= ?
    `).get(deckId, todayStart.toISOString())!;
    return result.c;
  }

  deleteCards(cardIds: string[]): void {
    if (cardIds.length === 0) return;
    const placeholders = cardIds.map(() => '?').join(', ');
    this.db.query(`DELETE FROM review_log WHERE card_id IN (${placeholders})`).run(...cardIds);
    this.db.query(`DELETE FROM cards WHERE card_id IN (${placeholders})`).run(...cardIds);
  }

  getStats(deckId: string, now: Date): DeckStats {
    const total = this.db.query<{ c: number }, [string]>('SELECT COUNT(*) as c FROM cards WHERE deck_id = ?').get(deckId)!.c;
    const dueReview = this.db.query<{ c: number }, [string, string]>(
      `SELECT COUNT(*) as c FROM cards WHERE deck_id = ? AND state > 0 AND due <= ?`
    ).get(deckId, now.toISOString())!.c;
    const dueNew = this.db.query<{ c: number }, [string, string]>(
      `SELECT COUNT(*) as c FROM cards WHERE deck_id = ? AND state = 0 AND due <= ?`
    ).get(deckId, now.toISOString())!.c;
    const due = dueReview + dueNew;
    const newCards = this.db.query<{ c: number }, [string]>(
      `SELECT COUNT(*) as c FROM cards WHERE deck_id = ? AND state = 0`
    ).get(deckId)!.c;
    const relearning = this.db.query<{ c: number }, [string]>(
      `SELECT COUNT(*) as c FROM cards WHERE deck_id = ? AND state = 3`
    ).get(deckId)!.c;
    const shortReview = this.db.query<{ c: number }, [string]>(
      `SELECT COUNT(*) as c FROM cards WHERE deck_id = ? AND state = 2 AND scheduled_days <= 7`
    ).get(deckId)!.c;
    return { total, due, newCards, relearning, shortReview };
  }
}
