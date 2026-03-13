import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Spinner, Button } from '@markcards/ui';
import { EmptyState } from '../../_shared/EmptyState';
import { suspendedQueryOptions, unsuspendCard } from '../../api/suspended';
import { useHelp } from '../root/HelpProvider';

export function SuspendedPage() {
  const { data, isLoading, error } = useQuery(suspendedQueryOptions);
  const queryClient = useQueryClient();
  const help = useHelp();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleUnsuspend = async (cardId: string) => {
    await unsuspendCard(cardId);
    queryClient.invalidateQueries({ queryKey: ['suspended'] });
    queryClient.invalidateQueries({ queryKey: ['review'] });
    queryClient.invalidateQueries({ queryKey: ['decks'] });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (help.open) return;
      if ((e.key === 'u' || e.key === 'U') && hoveredId) {
        handleUnsuspend(hoveredId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hoveredId, help.open]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load suspended cards" description={error.message} />;
  }

  const cards = data?.cards ?? [];

  if (!cards.length) {
    return <EmptyState title="No suspended cards" description="Cards you suspend during review will appear here." />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cards.map(card => (
        <div
          key={card.cardId}
          className="border border-border p-4 flex flex-col justify-between gap-3 transition-colors bg-card hover:bg-foreground/5 cursor-default"
          onMouseEnter={() => setHoveredId(card.cardId)}
          onMouseLeave={() => setHoveredId(null)}
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
  );
}
