import { queryOptions } from '@tanstack/react-query';
import type { ReviewQueue, ReviewResult } from '@markcards/types';

export const reviewQueryOptions = (deckId?: string) =>
  queryOptions({
    queryKey: ['review', deckId ?? null],
    queryFn: async (): Promise<ReviewQueue> => {
      const url = deckId ? `/api/review?deck=${deckId}` : '/api/review';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch review queue');
      return res.json() as Promise<ReviewQueue>;
    },
    staleTime: Infinity,
    refetchOnMount: 'always',
  });

export const submitReview = async (cardId: string, pass: boolean): Promise<ReviewResult> => {
  const res = await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, pass }),
  });
  if (!res.ok) throw new Error('Failed to submit review');
  return res.json() as Promise<ReviewResult>;
};
