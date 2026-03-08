import { Button } from '@markcards/ui';

interface RatingButtonsProps {
  onPass: () => void;
  onFail: () => void;
}

export function RatingButtons({ onPass, onFail }: RatingButtonsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4">
      <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">
        <Button variant="danger" size="lg" fullWidth onClick={onFail}>
          Again
          <span className="ml-2 text-xs opacity-60">←</span>
        </Button>
        <Button variant="success" size="lg" fullWidth onClick={onPass}>
          Good
          <span className="ml-2 text-xs opacity-60">→</span>
        </Button>
      </div>
    </div>
  );
}
