import type { Card, Deck } from '../../domain/card.js';

export interface RenderedCard {
  cardId: string;
  deckId: string;
  deckName: string;
  type: 'qa' | 'cloze';
  promptHtml: string;
  revealHtml: string;
  questionHtml?: string;
}

export interface CardRenderer {
  render(card: Card, deck: Deck): RenderedCard;
}
