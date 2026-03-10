export interface CardSummaryProps {
  promptHtml: string;
  revealHtml: string;
  type?: string;
}

export function CardSummary({ promptHtml, revealHtml }: CardSummaryProps) {
  return (
    <div className="border border-border bg-card text-card-foreground text-sm">
      <div
        className="card-content card-summary-content p-2"
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
