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
        <div className="flex justify-between mb-1.5 px-0 text-xs font-mono text-muted-foreground">
          <span>{label}</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="w-full h-1 bg-transparent border border-border overflow-hidden">
        <div
          className="h-full bg-foreground transition-all duration-300 ease-out"
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
