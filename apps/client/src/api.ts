export interface DeckStats {
  total: number;
  due: number;
  newCards: number;
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
  type: 'qa' | 'cloze';
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

const apiBase: string = (window as any).__MARKCARDS_API_BASE__ ?? '';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getDecks(): Promise<DeckSummary[]> {
    return apiFetch('/api/decks');
  },

  getDeck(deckId: string): Promise<DeckSummary & { cards: unknown[] }> {
    return apiFetch(`/api/decks/${deckId}`);
  },

  getReviewQueue(deckId?: string): Promise<ReviewQueue> {
    return apiFetch(deckId ? `/api/review/${deckId}` : '/api/review');
  },

  submitReview(cardId: string, pass: boolean): Promise<ReviewResult> {
    return apiFetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId, pass }),
    });
  },
};
