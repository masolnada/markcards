import { useState } from 'react';

export interface EditableCardSummaryProps {
  rawMarkdown: string;
  onMarkdownChange: (value: string) => void;
}

function parseCard(raw: string): { prompt: string; reveal: string } | null {
  const text = raw.trim();

  const clozeMatch = text.match(/^C:\s*([\s\S]+)/);
  if (clozeMatch) {
    const template = clozeMatch[1].trim();
    return {
      prompt: template.replace(/\[([^\]]+)\]/g, '_____'),
      reveal: template,
    };
  }

  const qMatch = text.match(/^Q:\s*([\s\S]*?)(?=\nA:)/);
  const aMatch = text.match(/\nA:\s*([\s\S]*?)$/);
  if (qMatch) {
    return {
      prompt: qMatch[1].trim(),
      reveal: aMatch ? aMatch[1].trim() : '',
    };
  }

  return null;
}

export function EditableCardSummary({ rawMarkdown, onMarkdownChange }: EditableCardSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const parsed = parseCard(rawMarkdown);

  if (isEditing || !parsed) {
    return (
      <div className="relative border border-border bg-card text-sm">
        {parsed && (
          <button
            onClick={() => setIsEditing(false)}
            className="absolute top-1 right-1 z-10 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground border border-transparent hover:border-border leading-none text-xs"
            aria-label="Close editor"
          >
            ×
          </button>
        )}
        <textarea
          className="w-full font-mono text-sm bg-background text-foreground p-2 pr-6 resize-y min-h-[100px] focus:outline-none"
          value={rawMarkdown}
          onChange={e => onMarkdownChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="relative border border-border bg-card text-card-foreground text-sm">
      <button
        onClick={() => setIsEditing(true)}
        className="absolute top-1 right-1 z-10 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground border border-transparent hover:border-border leading-none"
        style={{ fontSize: 11 }}
        aria-label="Edit card"
      >
        ✎
      </button>
      <div className="p-2 pr-6 whitespace-pre-wrap">{parsed.prompt}</div>
      <div className="border-t border-border">
        <div className="p-2 text-muted-foreground whitespace-pre-wrap">{parsed.reveal}</div>
      </div>
    </div>
  );
}
