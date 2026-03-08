import { Button, Badge } from '@markcards/ui';
import { StatGroup } from '../../../_shared/StatGroup';
import type { DeckSummary } from '@markcards/types';

interface DeckCardProps {
  deck: DeckSummary;
  onReview: () => void;
}

export function DeckCard({ deck, onReview }: DeckCardProps) {
  const hasDue = deck.stats.due > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-card-foreground">{deck.name}</h2>
        {deck.stats.newCards > 0 && (
          <Badge variant="primary">{deck.stats.newCards} new</Badge>
        )}
      </div>

      <StatGroup
        stats={[
          { label: 'Total', value: deck.stats.total },
          { label: 'Due', value: deck.stats.due },
          { label: 'New', value: deck.stats.newCards },
        ]}
      />

      <Button
        variant={hasDue ? 'primary' : 'secondary'}
        disabled={!hasDue}
        onClick={onReview}
        fullWidth
        size="sm"
      >
        {hasDue ? `Review ${deck.stats.due}` : 'Up to date'}
      </Button>
    </div>
  );
}
