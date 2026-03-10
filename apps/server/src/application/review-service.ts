import type { RenderedCard, CardRenderer } from './ports/card-renderer.js';
import type { CardRepository } from './ports/card-repository.js';
import type { DeckSource } from './ports/deck-source.js';
import type { SettingsRepository } from './ports/settings-repository.js';
import { schedule } from '../domain/fsrs.js';
import type { Rating } from '../domain/fsrs.js';

export class ReviewService {
  constructor(
    private cards: CardRepository,
    private decks: DeckSource,
    private settings: SettingsRepository,
    private renderer: CardRenderer,
  ) {}

  async getDueCards(now: Date): Promise<{ cards: RenderedCard[]; total: number }> {
    await this.decks.sync();
    const reviewCards = this.cards.getDueReviewIds(now);

    const newCards: { cardId: string; deckId: string }[] = [];
    for (const deck of this.decks.getAll()) {
      if (deck.maxNewPerDay !== undefined) {
        const reviewed = this.cards.countNewReviewedTodayForDeck(deck.id, now);
        const remaining = Math.max(0, deck.maxNewPerDay - reviewed);
        newCards.push(...this.cards.getNewIdsForDeckQueue(deck.id, now, remaining));
      } else {
        newCards.push(...this.cards.getNewIdsForDeckQueue(deck.id, now));
      }
    }

    const due = [...reviewCards, ...newCards];

    const rendered: RenderedCard[] = [];
    for (const { cardId, deckId } of due) {
      const deck = this.decks.getById(deckId);
      if (!deck) continue;
      const card = deck.cards.find(c => c.id === cardId);
      if (!card) continue;
      rendered.push(this.renderer.render(card, deck));
    }
    return { cards: rendered, total: rendered.length };
  }

  async getDueCardsForDeck(deckId: string, now: Date): Promise<{ cards: RenderedCard[]; total: number; deck: { id: string; name: string } } | null> {
    await this.decks.sync();
    const deck = this.decks.getById(deckId);
    if (!deck) return null;

    const reviewCards = this.cards.getDueReviewIdsForDeck(deckId, now);
    let newCards: { cardId: string; deckId: string }[];
    if (deck.maxNewPerDay !== undefined) {
      const reviewed = this.cards.countNewReviewedTodayForDeck(deckId, now);
      const remaining = Math.max(0, deck.maxNewPerDay - reviewed);
      newCards = this.cards.getNewIdsForDeckQueue(deckId, now, remaining);
    } else {
      newCards = this.cards.getNewIdsForDeckQueue(deckId, now);
    }
    const due = [...reviewCards, ...newCards];

    const rendered: RenderedCard[] = [];
    for (const { cardId } of due) {
      const card = deck.cards.find(c => c.id === cardId);
      if (!card) continue;
      rendered.push(this.renderer.render(card, deck));
    }
    return { cards: rendered, total: rendered.length, deck: { id: deck.id, name: deck.name } };
  }

  async getAllCardsForDeck(deckId: string): Promise<{ cards: RenderedCard[]; deck: { id: string; name: string } } | null> {
    await this.decks.sync();
    const deck = this.decks.getById(deckId);
    if (!deck) return null;
    const rendered = deck.cards.map(card => this.renderer.render(card, deck));
    return { cards: rendered, deck: { id: deck.id, name: deck.name } };
  }

  async deleteCards(deckId: string, cardIds: string[]): Promise<void> {
    this.cards.deleteCards(cardIds);
    await this.decks.removeCards(deckId, cardIds);
  }

  submitReview(cardId: string, pass: boolean, now: Date): { nextDue: string; scheduledDays: number; state: number; rating: number } | null {
    const card = this.cards.findById(cardId);
    if (!card) return null;

    const rating: Rating = pass ? 3 : 1;
    const settings = this.settings.get();
    const result = schedule(card, rating, now, {
      learningSteps: settings.learningSteps,
      relearningSteps: settings.relearningSteps,
    });
    this.cards.save(cardId, result.card, rating);

    return {
      nextDue: result.card.due.toISOString(),
      scheduledDays: result.card.scheduledDays,
      state: result.card.state,
      rating,
    };
  }
}
