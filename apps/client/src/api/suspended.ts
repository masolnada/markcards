import { queryOptions } from '@tanstack/react-query';
import type { RenderedCard } from '@markcards/types';

export const suspendedQueryOptions = queryOptions({
  queryKey: ['suspended'],
  queryFn: async (): Promise<{ cards: RenderedCard[] }> => {
    const res = await fetch('/api/suspended');
    if (!res.ok) throw new Error('Failed to fetch suspended cards');
    return res.json() as Promise<{ cards: RenderedCard[] }>;
  },
  staleTime: Infinity,
  refetchOnMount: 'always',
});

export const suspendCard = async (cardId: string): Promise<void> => {
  const res = await fetch('/api/suspended', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId }),
  });
  if (!res.ok) throw new Error('Failed to suspend card');
};

export const unsuspendCard = async (cardId: string): Promise<void> => {
  const res = await fetch(`/api/suspended/${encodeURIComponent(cardId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to unsuspend card');
};
