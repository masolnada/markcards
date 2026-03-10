import type { ReactNode } from 'react';

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function SidePanel({ open, onClose, title, children }: SidePanelProps) {
  if (!open) return null;

  return (
    <div
      className="fixed z-40 flex flex-col bg-card border border-border"
      style={{
        right: '1.5rem',
        top: 'calc(3.5rem + 1.5rem)',
        bottom: '1.5rem',
        width: 'calc(33% - 1.5rem)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
        <span className="font-semibold text-sm text-foreground truncate pr-2">{title}</span>
        <button
          onClick={onClose}
          className="shrink-0 border border-transparent hover:border-border px-2 py-0.5 text-muted-foreground hover:text-foreground text-sm leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}
