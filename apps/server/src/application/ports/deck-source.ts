import type { Deck } from '../../domain/card.js';

export interface DeckSource {
  getAll(): Deck[];
  getById(id: string): Deck | undefined;
  sync(force?: boolean): Promise<void>;
  removeCards(deckId: string, cardIds: string[]): Promise<void>;
}
