import type { RenderedCard } from '@markcards/types';

interface FlashCardProps {
  card: RenderedCard;
  revealed: boolean;
}

export function FlashCard({ card, revealed }: FlashCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-0 min-h-48 pb-8">
      <div
        className="card-content text-card-foreground text-center"
        dangerouslySetInnerHTML={{ __html: card.promptHtml }}
      />

      {revealed && (
        <div className="mt-6 pt-6 border-t border-border">
          <div
            className="card-content text-card-foreground text-center"
            dangerouslySetInnerHTML={{ __html: card.revealHtml }}
          />
        </div>
      )}
    </div>
  );
}
