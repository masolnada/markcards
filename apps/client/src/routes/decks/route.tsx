import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Spinner } from '@markcards/ui';
import { EmptyState } from '../../_shared/EmptyState';
import { decksQueryOptions } from '../../api/decks';
import { DeckCard } from './DeckCard';

export function DecksPage() {
  const navigate = useNavigate();
  const { data: decks, isLoading, error } = useQuery(decksQueryOptions);

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
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Decks</h1>
      <div className="grid grid-cols-[1fr_auto_auto] [&>*:nth-child(n+4)]:border-t [&>*:nth-child(n+4)]:border-border border border-border rounded-lg overflow-hidden">
        {decks.map((deck) => (
          <DeckCard
            key={deck.id}
            deck={deck}
            onReview={() =>
              navigate({ to: '/review', search: { deck: deck.id } })
            }
          />
        ))}
      </div>
    </div>
  );
}
