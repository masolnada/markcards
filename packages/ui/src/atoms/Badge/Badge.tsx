import type { ReactNode } from 'react';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-surface text-muted-foreground border border-border',
  primary: 'bg-primary/10 text-primary border border-primary/20',
  success: 'bg-success/10 text-success border border-success/20',
  warning: 'bg-warning/10 text-warning-foreground border border-warning/20',
  danger:  'bg-danger/10 text-danger border border-danger/20',
};

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
