import { Button } from '@markcards/ui';
import type { RenderedCard } from '@markcards/types';

interface FlashCardProps {
  card: RenderedCard;
  revealed: boolean;
  onReveal: () => void;
}

export function FlashCard({ card, revealed, onReveal }: FlashCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-0 min-h-48">
      <div
        className="card-content text-card-foreground"
        dangerouslySetInnerHTML={{ __html: card.promptHtml }}
      />

      {!revealed ? (
        <div className="mt-auto pt-6 border-t border-border">
          <Button variant="secondary" fullWidth onClick={onReveal}>
            Show answer
          </Button>
        </div>
      ) : (
        <div className="mt-auto pt-6 border-t border-border">
          <div
            className="card-content text-card-foreground"
            dangerouslySetInnerHTML={{ __html: card.revealHtml }}
          />
        </div>
      )}
    </div>
  );
}
