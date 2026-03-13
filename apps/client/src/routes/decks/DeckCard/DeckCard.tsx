import { Button, Badge } from '@markcards/ui';
import type { DeckSummary } from '@markcards/types';

interface DeckCardProps {
  deck: DeckSummary;
  onReview: () => void;
}

export function DeckCard({ deck, onReview }: DeckCardProps) {
  const hasDue = deck.stats.due > 0;

  return (
    <>
      <div className="bg-card px-4 py-3 flex items-center gap-3 min-w-0">
        <span className="font-medium text-card-foreground truncate">{deck.name}</span>
        {deck.stats.newCards > 0 && (
          <Badge variant="primary">{deck.stats.newCards} new</Badge>
        )}
        {deck.stats.suspended > 0 && (
          <Badge variant="neutral">{deck.stats.suspended} suspended</Badge>
        )}
      </div>

      <div className="bg-card px-4 py-3 flex items-center justify-end">
        <span className="text-sm text-muted-foreground">{deck.stats.total} cards</span>
      </div>

      <div className="bg-card px-4 py-3 flex items-center justify-end">
        <Button
          variant={hasDue ? 'primary' : 'secondary'}
          disabled={!hasDue}
          onClick={onReview}
          size="sm"
          className="w-32"
        >
          {hasDue ? 'Review' : 'Up to date'}
        </Button>
      </div>
    </>
  );
}
