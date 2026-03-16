import { useEffect } from 'react';
import { SidePanel } from '@markcards/ui';
import { useHelp } from '../HelpProvider';

export type HelpRoute = 'review' | 'other';

interface HelpOverlayProps {
  route: HelpRoute;
}

export function HelpOverlay({ route }: HelpOverlayProps) {
  const { open, toggle, close } = useHelp();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?') { toggle(); return; }
      if (e.key === 'Escape') { close(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, close]);

  return (
    <>
      <button
        onClick={toggle}
        className="fixed bottom-4 right-4 z-50 border border-border px-2 py-1 font-mono text-xs text-muted-foreground hover:text-foreground hover:border-foreground leading-none bg-background"
        aria-label="Keyboard shortcuts"
      >
        ?
      </button>
      <SidePanel open={open} onClose={close} title="// keyboard shortcuts">
        <dl className="font-mono text-sm flex flex-col gap-3">
          {route === 'review' && (
            <>
              <div className="flex items-start gap-3">
                <dt className="flex gap-1 shrink-0">
                  <kbd className="border border-border px-1.5 py-0.5 text-xs">Space</kbd>
                  <kbd className="border border-border px-1.5 py-0.5 text-xs">2</kbd>
                  <kbd className="border border-border px-1.5 py-0.5 text-xs">→</kbd>
                </dt>
                <dd className="text-muted-foreground">Show answer / Pass (Good)</dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="flex gap-1 shrink-0">
                  <kbd className="border border-border px-1.5 py-0.5 text-xs">1</kbd>
                  <kbd className="border border-border px-1.5 py-0.5 text-xs">←</kbd>
                </dt>
                <dd className="text-muted-foreground">Fail (Again)</dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="flex gap-1 shrink-0">
                  <kbd className="border border-border px-1.5 py-0.5 text-xs">S</kbd>
                </dt>
                <dd className="text-muted-foreground">Suspend card</dd>
              </div>
            </>
          )}
          <div className="flex items-start gap-3">
            <dt className="flex gap-1 shrink-0">
              <kbd className="border border-border px-1.5 py-0.5 text-xs">?</kbd>
            </dt>
            <dd className="text-muted-foreground">Toggle this panel</dd>
          </div>
          <div className="flex items-start gap-3">
            <dt className="flex gap-1 shrink-0">
              <kbd className="border border-border px-1.5 py-0.5 text-xs">Esc</kbd>
            </dt>
            <dd className="text-muted-foreground">Close panel</dd>
          </div>
        </dl>
      </SidePanel>
    </>
  );
}
