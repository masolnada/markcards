import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch, Link } from '@tanstack/react-router';
import { Spinner, ProgressBar, Button } from '@markcards/ui';
import { EmptyState } from '../../_shared/EmptyState';
import { StatGroup } from '../../_shared/StatGroup';
import { reviewQueryOptions, submitReview } from '../../api/review';
import { suspendCard } from '../../api/suspended';
import { useHelp } from '../root/HelpProvider';
import { FlashCard } from './FlashCard';
import { RatingButtons } from './RatingButtons';

interface SessionStats {
  reviewed: number;
  passed: number;
  failed: number;
}

export function ReviewPage() {
  const { deck: deckId } = useSearch({ from: '/review' });
  const { data: queue, isLoading, error } = useQuery(reviewQueryOptions(deckId));
  const help = useHelp();

  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [revealed, setReveal] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ reviewed: 0, passed: 0, failed: 0 });
  const [suspendedIds, setSuspendedIds] = useState<Set<string>>(new Set());

  const cards = (queue?.cards ?? []).filter(c => !suspendedIds.has(c.cardId));
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

  const handleSuspend = useCallback(() => {
    if (!card) return;
    suspendCard(card.cardId); // fire-and-forget
    queryClient.invalidateQueries({ queryKey: ['suspended'] });
    queryClient.invalidateQueries({ queryKey: ['decks'] });
    setSuspendedIds(prev => new Set(prev).add(card.cardId));
    setReveal(false);
  }, [card, queryClient]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (help.open) return;
      if (e.key === 's' || e.key === 'S') {
        handleSuspend();
        return;
      }
      if (!revealed) {
        if (e.key === ' ' || e.key === '2' || e.key === 'ArrowRight' || e.key === '1' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setReveal(true);
        }
      } else {
        if (e.key === '1' || e.key === 'ArrowLeft') {
          handleRate(false);
        } else if (e.key === '2' || e.key === ' ' || e.key === 'ArrowRight') {
          e.preventDefault();
          handleRate(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, help.open, handleRate, handleSuspend]);

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
          <Link to="/skills">
            <Button variant="secondary">View skills</Button>
          </Link>
        }
      />
    );
  }

  if (index >= cards.length) {
    return (
      <div className="flex flex-col items-center gap-6 py-20">
        <h1 className="text-lg font-mono font-semibold text-foreground tracking-tight">// session complete</h1>
        <StatGroup
          className="justify-center gap-8"
          stats={[
            { label: 'Reviewed', value: stats.reviewed },
            { label: 'Passed', value: stats.passed },
            { label: 'Failed', value: stats.failed },
          ]}
        />
        <Link to="/skills">
          <Button variant="secondary">Skills</Button>
        </Link>
      </div>
    );
  }

  const progress = (index / cards.length) * 100;

  return (
    <div className="flex flex-col gap-6 pb-28">
      <ProgressBar value={progress} label={`${index} / ${cards.length}`} />
      <FlashCard card={card} revealed={revealed} />
      <RatingButtons
        revealed={revealed}
        onReveal={() => setReveal(true)}
        onPass={() => handleRate(true)}
        onFail={() => handleRate(false)}
        onSuspend={handleSuspend}
      />
    </div>
  );
}
