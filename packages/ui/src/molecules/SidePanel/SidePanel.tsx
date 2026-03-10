import type { ReactNode } from 'react';

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function SidePanel({ open, onClose, title, children }: SidePanelProps) {
  return (
    <>
      {/* Backdrop — mobile only, fades with the panel */}
      <div
        className={`fixed inset-0 z-30 sm:hidden bg-foreground/20 transition-opacity duration-300 ease-out ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed z-40 flex flex-col bg-card
          top-12 right-0 bottom-0 w-[85%] border-l border-border
          transition-transform duration-300 ease-out
          sm:top-[4.5rem] sm:border sm:right-6 sm:bottom-6 sm:w-[calc(33%-1.5rem)]
          ${open ? 'translate-x-0' : 'translate-x-full sm:hidden'}`}
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
    </>
  );
}
