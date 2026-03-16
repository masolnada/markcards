import { queryOptions } from '@tanstack/react-query';
import type { InputCard } from '@markcards/types';

export interface RenderedInputCard extends InputCard {
  imageBaseUrl?: string;
}

export const inputQueryOptions = queryOptions({
  queryKey: ['input'],
  queryFn: async (): Promise<{ cards: RenderedInputCard[] }> => {
    const res = await fetch('/api/input');
    if (!res.ok) throw new Error('Failed to fetch input cards');
    return res.json() as Promise<{ cards: RenderedInputCard[] }>;
  },
  staleTime: Infinity,
  refetchOnMount: 'always',
});

export const confirmCard = async (cardId: string, markdown?: string): Promise<void> => {
  const res = await fetch(`/api/input/${encodeURIComponent(cardId)}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown }),
  });
  if (!res.ok) throw new Error('Failed to confirm card');
};

export const rejectCard = async (cardId: string): Promise<void> => {
  const res = await fetch(`/api/input/${encodeURIComponent(cardId)}/reject`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to reject card');
};
