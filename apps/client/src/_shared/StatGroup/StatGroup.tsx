import type { ReactNode } from 'react';

interface StatItem {
  label: string;
  value: ReactNode;
}

interface StatGroupProps {
  stats: StatItem[];
  className?: string;
}

export function StatGroup({ stats, className = '' }: StatGroupProps) {
  return (
    <dl
      className={['flex flex-wrap gap-x-6 gap-y-2', className]
        .filter(Boolean)
        .join(' ')}
    >
      {stats.map(({ label, value }) => (
        <div key={label} className="flex flex-col">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-semibold text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
