import type { Card } from '../domain/card.js';
import type { CardRepository, DeckStats } from './ports/card-repository.js';
import type { DeckSource } from './ports/deck-source.js';
import type { SettingsRepository } from './ports/settings-repository.js';

export class DeckService {
  constructor(
    private decks: DeckSource,
    private cards: CardRepository,
    private settings: SettingsRepository,
  ) {}

  async listDecks(now: Date): Promise<Array<{ id: string; name: string; filePath: string; stats: DeckStats }>> {
    await this.decks.sync();
    const { maxNewPerDay } = this.settings.get();
    const newLimit = Math.max(0, maxNewPerDay - this.cards.countNewReviewedToday(now));
    return this.decks.getAll().map(deck => ({
      id: deck.id,
      name: deck.name,
      filePath: deck.filePath,
      stats: this.cards.getStats(deck.id, now, newLimit),
    }));
  }

  async getDeck(id: string, now: Date): Promise<{ id: string; name: string; filePath: string; stats: DeckStats; cards: Card[] } | null> {
    await this.decks.sync();
    const deck = this.decks.getById(id);
    if (!deck) return null;
    const { maxNewPerDay } = this.settings.get();
    const newLimit = Math.max(0, maxNewPerDay - this.cards.countNewReviewedToday(now));
    return {
      id: deck.id,
      name: deck.name,
      filePath: deck.filePath,
      stats: this.cards.getStats(deck.id, now, newLimit),
      cards: deck.cards,
    };
  }
}
