import { queryOptions } from '@tanstack/react-query';
import type { RenderedCard } from '@markcards/types';

interface DeckCardsResponse { cards: RenderedCard[]; deck: { id: string; name: string } }

export const deckCardsQueryOptions = (deckId: string | null) =>
  queryOptions({
    queryKey: ['deck-cards', deckId],
    queryFn: async () => {
      const res = await fetch(`/api/decks/${deckId}/cards`);
      if (!res.ok) throw new Error('Failed to fetch deck cards');
      return res.json() as Promise<DeckCardsResponse>;
    },
    enabled: deckId !== null,
  });

export async function deleteDeckCards(deckId: string, cardIds: string[]): Promise<void> {
  const res = await fetch(`/api/decks/${deckId}/cards`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardIds }),
  });
  if (!res.ok) throw new Error('Failed to delete cards');
}
