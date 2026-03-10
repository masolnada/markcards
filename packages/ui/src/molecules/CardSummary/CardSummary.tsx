export interface CardSummaryProps {
  promptHtml: string;
  revealHtml: string;
  type?: string;
  markedForRemoval?: boolean;
  onMarkForRemoval?: () => void;
}

export function CardSummary({ promptHtml, revealHtml, markedForRemoval, onMarkForRemoval }: CardSummaryProps) {
  return (
    <div className={`relative border bg-card text-card-foreground text-sm ${markedForRemoval ? 'border-danger opacity-60' : 'border-border'}`}>
      {onMarkForRemoval && (
        <button
          onClick={onMarkForRemoval}
          className="absolute top-1 right-1 z-10 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border border border-transparent leading-none text-xs"
          aria-label="Mark for removal"
        >
          ×
        </button>
      )}
      <div
        className="card-content card-summary-content p-2 pr-6"
        dangerouslySetInnerHTML={{ __html: promptHtml }}
      />
      <div className="border-t border-border">
        <div
          className="card-content card-summary-content p-2 text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: revealHtml }}
        />
      </div>
    </div>
  );
}
