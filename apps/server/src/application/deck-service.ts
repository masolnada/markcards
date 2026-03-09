import type { Card } from '../domain/card.js';
import type { CardRepository, DeckStats } from './ports/card-repository.js';
import type { DeckSource } from './ports/deck-source.js';

export class DeckService {
  constructor(
    private decks: DeckSource,
    private cards: CardRepository,
  ) {}

  async listDecks(now: Date): Promise<Array<{ id: string; name: string; filePath: string; stats: DeckStats }>> {
    await this.decks.sync();
    return this.decks.getAll().map(deck => ({
      id: deck.id,
      name: deck.name,
      filePath: deck.filePath,
      stats: this.cards.getStats(deck.id, now),
    }));
  }

  async getDeck(id: string, now: Date): Promise<{ id: string; name: string; filePath: string; stats: DeckStats; cards: Card[] } | null> {
    await this.decks.sync();
    const deck = this.decks.getById(id);
    if (!deck) return null;
    return {
      id: deck.id,
      name: deck.name,
      filePath: deck.filePath,
      stats: this.cards.getStats(deck.id, now),
      cards: deck.cards,
    };
  }
}
