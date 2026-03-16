import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Spinner, SidePanel, CardSummary, Button } from '@markcards/ui';
import type { DeckSummary } from '@markcards/types';
import { EmptyState } from '../../_shared/EmptyState';
import { decksQueryOptions } from '../../api/decks';
import { deckCardsQueryOptions, deleteDeckCards } from '../../api/deck-cards';
import { suspendedQueryOptions, unsuspendCard } from '../../api/suspended';
import { SkillsGraph } from './SkillsGraph';

export function SkillsPage() {
  const [selectedDeck, setSelectedDeck] = useState<DeckSummary | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [suspendedOpen, setSuspendedOpen] = useState(false);
  const [hoveredSuspendedId, setHoveredSuspendedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const clearSelectedDeck = useCallback(() => {
    setSelectedDeck(null);
    setMarkedIds(new Set());
  }, []);

  const { data: decks, isLoading, error } = useQuery(decksQueryOptions);
  const { data: deckCards, isLoading: cardsLoading } = useQuery(
    deckCardsQueryOptions(selectedDeck?.id ?? null),
  );
  const { data: suspendedData, isLoading: suspendedLoading } = useQuery(suspendedQueryOptions);

  const suspendedCount = decks?.reduce((s, d) => s + d.stats.suspended, 0) ?? 0;

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

  const handleUnsuspend = useCallback(async (cardId: string) => {
    await unsuspendCard(cardId);
    queryClient.invalidateQueries({ queryKey: ['suspended'] });
    queryClient.invalidateQueries({ queryKey: ['review'] });
    queryClient.invalidateQueries({ queryKey: ['decks'] });
  }, [queryClient]);

  useEffect(() => {
    if (!suspendedOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'u' || e.key === 'U') && hoveredSuspendedId) {
        handleUnsuspend(hoveredSuspendedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [suspendedOpen, hoveredSuspendedId, handleUnsuspend]);

  const handleBackgroundClick = useCallback(() => {
    clearSelectedDeck();
    setSuspendedOpen(false);
  }, [clearSelectedDeck]);

  const handleSuspendedClick = useCallback(() => {
    setSelectedDeck(null);
    setMarkedIds(new Set());
    setSuspendedOpen(true);
  }, []);

  const handleDeckClick = useCallback((deck: DeckSummary) => {
    setSuspendedOpen(false);
    setSelectedDeck(deck);
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

  const suspendedCards = suspendedData?.cards ?? [];

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
          suspendedCount={suspendedCount}
          onDeckClick={handleDeckClick}
          onBackgroundClick={handleBackgroundClick}
          onSuspendedClick={handleSuspendedClick}
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

      <SidePanel
        open={suspendedOpen}
        onClose={() => setSuspendedOpen(false)}
        title="suspended"
      >
        {suspendedLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : !suspendedCards.length ? (
          <p className="text-muted-foreground text-sm py-4 text-center">No suspended cards.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {suspendedCards.map(card => (
              <div
                key={card.cardId}
                className="border border-border p-4 flex flex-col justify-between gap-3 transition-colors bg-card hover:bg-foreground/5 cursor-default"
                onMouseEnter={() => setHoveredSuspendedId(card.cardId)}
                onMouseLeave={() => setHoveredSuspendedId(null)}
              >
                <div className="flex flex-col gap-3">
                  <div
                    className="text-sm text-card-foreground prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: card.promptHtml }}
                  />
                  <div className="text-xs text-muted-foreground font-mono">{card.deckName}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => handleUnsuspend(card.cardId)}>
                  Unsuspend
                </Button>
              </div>
            ))}
          </div>
        )}
      </SidePanel>
    </>
  );
}
