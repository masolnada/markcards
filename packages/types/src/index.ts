export type CardType = 'qa' | 'cloze';

export interface DeckStats {
  total: number;
  due: number;
  newCards: number;
  relearning: number;
  shortReview: number;
}

export interface DeckSummary {
  id: string;
  name: string;
  filePath: string;
  stats: DeckStats;
}

export interface RenderedCard {
  cardId: string;
  deckId: string;
  deckName: string;
  type: CardType;
  promptHtml: string;
  revealHtml: string;
  questionHtml?: string;
}

export interface ReviewQueue {
  cards: RenderedCard[];
  total: number;
}

export interface ReviewResult {
  cardId: string;
  rating: number;
  nextDue: string;
  scheduledDays: number;
  state: number;
}
