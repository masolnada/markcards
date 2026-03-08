import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch, Link } from '@tanstack/react-router';
import { Spinner, ProgressBar, Button } from '@markcards/ui';
import { EmptyState } from '../../_shared/EmptyState';
import { StatGroup } from '../../_shared/StatGroup';
import { reviewQueryOptions, submitReview } from '../../api/review';
import { FlashCard } from './FlashCard';
import { RatingButtons } from './RatingButtons';

interface SessionStats {
  reviewed: number;
  passed: number;
  failed: number;
}

export function ReviewPage() {
  const { deck: deckId } = useSearch({ from: '/review' });
  const queryClient = useQueryClient();
  const { data: queue, isLoading, error } = useQuery(reviewQueryOptions(deckId));

  const [index, setIndex] = useState(0);
  const [revealed, setReveal] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ reviewed: 0, passed: 0, failed: 0 });

  const cards = queue?.cards ?? [];
  const card = cards[index];

  const handleRate = useCallback(
    (pass: boolean) => {
      if (!card) return;
      submitReview(card.cardId, pass); // fire-and-forget
      setStats((s) => ({
        reviewed: s.reviewed + 1,
        passed: s.passed + (pass ? 1 : 0),
        failed: s.failed + (pass ? 0 : 1),
      }));
      setIndex((i) => i + 1);
      setReveal(false);
    },
    [card],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!revealed) {
        if (e.key === ' ') {
          e.preventDefault();
          setReveal(true);
        }
      } else {
        if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'j') {
          handleRate(false);
        } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'k') {
          handleRate(true);
        } else if (e.key === ' ') {
          e.preventDefault();
          handleRate(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, handleRate]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load review queue" description={error.message} />;
  }

  if (!cards.length) {
    return (
      <EmptyState
        title="All caught up!"
        description="No cards due for review right now."
        action={
          <Link to="/decks">
            <Button variant="secondary">View decks</Button>
          </Link>
        }
      />
    );
  }

  if (index >= cards.length) {
    return (
      <div className="flex flex-col items-center gap-6 py-20">
        <h1 className="text-2xl font-bold text-foreground">Session complete</h1>
        <StatGroup
          className="justify-center gap-8"
          stats={[
            { label: 'Reviewed', value: stats.reviewed },
            { label: 'Passed', value: stats.passed },
            { label: 'Failed', value: stats.failed },
          ]}
        />
        <div className="flex gap-3">
          <Link to="/decks">
            <Button variant="secondary">Decks</Button>
          </Link>
          <Button
            onClick={() => {
              setIndex(0);
              setReveal(false);
              setStats({ reviewed: 0, passed: 0, failed: 0 });
              queryClient.invalidateQueries(reviewQueryOptions(deckId));
            }}
          >
            Review again
          </Button>
        </div>
      </div>
    );
  }

  const progress = (index / cards.length) * 100;

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar value={progress} label={`${index} / ${cards.length}`} />
      <FlashCard card={card} revealed={revealed} onReveal={() => setReveal(true)} />
      {revealed && <RatingButtons onPass={() => handleRate(true)} onFail={() => handleRate(false)} />}
    </div>
  );
}
