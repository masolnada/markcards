export interface ProgressBarProps {
  /** Value from 0 to 100 */
  value: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, label, className = '' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      {label !== undefined && (
        <div className="flex justify-between mb-1.5 px-2 text-sm text-muted-foreground">
          <span>{label}</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-border">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
