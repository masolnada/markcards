import type { CardType } from '../../domain/card.js';
import type { FSRSCard, Rating } from '../../domain/fsrs.js';

export interface DeckStats {
  total: number;
  due: number;
  newCards: number;
  relearning: number;
  shortReview: number;
}

export interface CardRepository {
  ensure(id: string, deckId: string, type: CardType, clozeIndex: number | null, now: Date): FSRSCard;
  findById(id: string): FSRSCard | null;
  save(id: string, card: FSRSCard, rating: Rating): void;
  getDueReviewIds(now: Date): { cardId: string; deckId: string }[];
  getDueReviewIdsForDeck(deckId: string, now: Date): { cardId: string; deckId: string }[];
  getNewIdsForDeckQueue(deckId: string, now: Date, limit?: number): { cardId: string; deckId: string }[];
  countNewReviewedTodayForDeck(deckId: string, now: Date): number;
  getStats(deckId: string, now: Date): DeckStats;
  deleteCards(cardIds: string[]): void;
}
