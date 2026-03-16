import { useState } from 'react';
import { CardSummary } from '../CardSummary/CardSummary.js';

export interface EditableCardSummaryProps {
  promptHtml: string;
  revealHtml: string;
  rawMarkdown: string;
  onMarkdownChange: (value: string) => void;
}

export function EditableCardSummary({ promptHtml, revealHtml, rawMarkdown, onMarkdownChange }: EditableCardSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="relative border border-border bg-card text-sm">
        <button
          onClick={() => setIsEditing(false)}
          className="absolute top-1 right-1 z-10 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground border border-transparent hover:border-border leading-none text-xs"
          aria-label="Close editor"
        >
          ×
        </button>
        <textarea
          className="w-full font-mono text-sm bg-background text-foreground p-2 pr-6 resize-y min-h-[100px] focus:outline-none"
          value={rawMarkdown}
          onChange={e => onMarkdownChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <CardSummary promptHtml={promptHtml} revealHtml={revealHtml} />
      <button
        onClick={() => setIsEditing(true)}
        className="absolute top-1 right-1 z-20 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground border border-transparent hover:border-border leading-none"
        style={{ fontSize: 11 }}
        aria-label="Edit card"
      >
        ✎
      </button>
    </div>
  );
}
