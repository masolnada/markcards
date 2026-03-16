import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Spinner, SidePanel, Button } from '@markcards/ui';
import type { DeckSummary } from '@markcards/types';
import { EmptyState } from '../../_shared/EmptyState';
import { decksQueryOptions } from '../../api/decks';
import { suspendedQueryOptions, unsuspendCard } from '../../api/suspended';
import { SkillsGraph } from './SkillsGraph';
import { DeckSummaryPanel } from './DeckSummaryPanel/DeckSummaryPanel';

export function SkillsPage() {
  const [selectedDeck, setSelectedDeck] = useState<DeckSummary | null>(null);
  const [suspendedOpen, setSuspendedOpen] = useState(false);
  const [hoveredSuspendedId, setHoveredSuspendedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: decks, isLoading, error } = useQuery(decksQueryOptions);
  const { data: suspendedData, isLoading: suspendedLoading } = useQuery(suspendedQueryOptions);

  const suspendedCount = decks?.reduce((s, d) => s + d.stats.suspended, 0) ?? 0;

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
    setSelectedDeck(null);
    setSuspendedOpen(false);
  }, []);

  const handleSuspendedClick = useCallback(() => {
    setSelectedDeck(null);
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
        onClose={() => setSelectedDeck(null)}
        title={selectedDeck?.name ?? ''}
      >
        {selectedDeck && <DeckSummaryPanel deck={selectedDeck} />}
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
