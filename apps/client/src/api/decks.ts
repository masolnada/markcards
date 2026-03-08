import { queryOptions } from '@tanstack/react-query';
import type { DeckSummary } from '@markcards/types';

const fetchDecks = async (): Promise<DeckSummary[]> => {
  const res = await fetch('/api/decks');
  if (!res.ok) throw new Error('Failed to fetch decks');
  return res.json() as Promise<DeckSummary[]>;
};

export const decksQueryOptions = queryOptions({
  queryKey: ['decks'],
  queryFn: fetchDecks,
});
