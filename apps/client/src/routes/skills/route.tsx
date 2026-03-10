import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Spinner, SidePanel, CardSummary } from '@markcards/ui';
import type { DeckSummary } from '@markcards/types';
import { EmptyState } from '../../_shared/EmptyState';
import { decksQueryOptions } from '../../api/decks';
import { deckCardsQueryOptions, deleteDeckCards } from '../../api/deck-cards';
import { SkillsGraph } from './SkillsGraph';

export function SkillsPage() {
  const [selectedDeck, setSelectedDeck] = useState<DeckSummary | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const clearSelectedDeck = useCallback(() => {
    setSelectedDeck(null);
    setMarkedIds(new Set());
  }, []);
  const queryClient = useQueryClient();

  const { data: decks, isLoading, error } = useQuery(decksQueryOptions);
  const { data: deckCards, isLoading: cardsLoading } = useQuery(
    deckCardsQueryOptions(selectedDeck?.id ?? null),
  );

  const deleteMutation = useMutation({
    mutationFn: () => deleteDeckCards(selectedDeck!.id, Array.from(markedIds)),
    onSuccess: () => {
      setMarkedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['deck-cards', selectedDeck?.id] });
    },
  });

  const toggleMark = useCallback((cardId: string) => {
    setMarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load decks" description={error.message} />;
  }

  if (!decks?.length) {
    return (
      <EmptyState
        title="No decks found"
        description="Add .md files to your decks directory to get started."
      />
    );
  }

  const deleteFooter = markedIds.size > 0 ? (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        {markedIds.size} card{markedIds.size !== 1 ? 's' : ''} marked for removal
      </span>
      <button
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
        className="border border-border px-2 py-0.5 text-xs text-foreground hover:bg-danger hover:text-danger-foreground hover:border-danger disabled:opacity-50"
      >
        {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  ) : undefined;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '3rem',
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <SkillsGraph
          decks={decks}
          onDeckClick={setSelectedDeck}
          onBackgroundClick={clearSelectedDeck}
        />
      </div>

      <SidePanel
        open={selectedDeck !== null}
        onClose={clearSelectedDeck}
        title={deckCards?.deck.name ?? selectedDeck?.name ?? ''}
        footer={deleteFooter}
      >
        {cardsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : !deckCards?.cards.length ? (
          <p className="text-muted-foreground text-sm py-4 text-center">No cards in this deck.</p>
        ) : (
          deckCards.cards.map(card => (
            <CardSummary
              key={card.cardId}
              promptHtml={card.promptHtml}
              revealHtml={card.revealHtml}
              type={card.type}
              markedForRemoval={markedIds.has(card.cardId)}
              onMarkForRemoval={() => toggleMark(card.cardId)}
            />
          ))
        )}
      </SidePanel>
    </>
  );
}
