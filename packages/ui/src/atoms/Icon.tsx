export function Icon({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: 14,
        height: 14,
        borderTop: '1.5px solid currentColor',
        borderLeft: '1.5px solid currentColor',
        borderRight: '1.5px solid currentColor',
        borderBottom: '4px solid currentColor',
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}
