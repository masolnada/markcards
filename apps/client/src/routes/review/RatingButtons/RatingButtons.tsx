import { Button } from '@markcards/ui';

interface RatingButtonsProps {
  revealed: boolean;
  onReveal: () => void;
  onPass: () => void;
  onFail: () => void;
  onSuspend: () => void;
}

export function RatingButtons({ revealed, onReveal, onPass, onFail }: RatingButtonsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-3xl mx-auto">
        {!revealed ? (
          <Button variant="secondary" fullWidth size="lg" onClick={onReveal}>
            Show answer
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="danger" size="lg" fullWidth onClick={onFail}>
              Again
              <span className="ml-2 text-xs opacity-60">←</span>
            </Button>
            <Button variant="success" size="lg" fullWidth onClick={onPass}>
              Good
              <span className="ml-2 text-xs opacity-60">→</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
