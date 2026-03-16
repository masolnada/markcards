import { useNavigate } from '@tanstack/react-router';
import { Button, Badge } from '@markcards/ui';
import type { DeckSummary } from '@markcards/types';

interface DeckSummaryPanelProps {
  deck: DeckSummary;
}

export function DeckSummaryPanel({ deck }: DeckSummaryPanelProps) {
  const navigate = useNavigate();
  const hasDue = deck.stats.due > 0;

  return (
    <div className="flex flex-col gap-4 pb-4 mb-4 border-b border-border">
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground">{deck.stats.total} cards</span>
        {deck.stats.newCards > 0 && (
          <Badge variant="primary">{deck.stats.newCards} new</Badge>
        )}
        {deck.stats.suspended > 0 && (
          <Badge variant="neutral">{deck.stats.suspended} suspended</Badge>
        )}
      </div>

      <Button
        variant={hasDue ? 'primary' : 'secondary'}
        disabled={!hasDue}
        onClick={() => navigate({ to: '/review', search: { deck: deck.id } })}
        size="sm"
      >
        {hasDue ? 'Review' : 'Up to date'}
      </Button>
    </div>
  );
}
