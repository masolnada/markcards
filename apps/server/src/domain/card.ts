export type CardType = 'qa' | 'cloze';

export interface Card {
  id: string;
  type: CardType;
  question?: string;
  answer?: string;
  template?: string;
  clozeIndex?: number;
}

export interface Deck {
  id: string;
  name: string;
  filePath: string;
  cards: Card[];
}
