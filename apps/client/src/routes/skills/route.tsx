import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner, SidePanel, CardSummary } from '@markcards/ui';
import type { DeckSummary } from '@markcards/types';
import { EmptyState } from '../../_shared/EmptyState';
import { decksQueryOptions } from '../../api/decks';
import { deckCardsQueryOptions } from '../../api/deck-cards';
import { SkillsGraph } from './SkillsGraph';

export function SkillsPage() {
  const [selectedDeck, setSelectedDeck] = useState<DeckSummary | null>(null);
  const clearSelectedDeck = useCallback(() => setSelectedDeck(null), []);
  const { data: decks, isLoading, error } = useQuery(decksQueryOptions);
  const { data: deckCards, isLoading: cardsLoading } = useQuery(
    deckCardsQueryOptions(selectedDeck?.id ?? null),
  );

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

  return (
    <>
      <div
        style={{
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          marginTop: '-2rem',
          height: 'calc(100vh - 3.5rem)',
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
            />
          ))
        )}
      </SidePanel>
    </>
  );
}
