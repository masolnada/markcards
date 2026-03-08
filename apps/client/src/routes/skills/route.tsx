import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@markcards/ui';
import { EmptyState } from '../../_shared/EmptyState';
import { decksQueryOptions } from '../../api/decks';
import { SkillsGraph } from './SkillsGraph';

export function SkillsPage() {
  const { data: decks, isLoading, error } = useQuery(decksQueryOptions);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load decks" description={error.message} />;
  }

  if (!decks?.length) {
    return (
      <EmptyState
        title="No decks found"
        description="Add .md files to your decks directory to get started."
      />
    );
  }

  return (
    <div
      style={{
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',
        marginTop: '-2rem',
        height: 'calc(100vh - 3.5rem)',
      }}
    >
      <SkillsGraph decks={decks} />
    </div>
  );
}
