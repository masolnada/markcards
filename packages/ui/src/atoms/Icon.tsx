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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden="true"
    >
      <span
        style={{
          fontSize: 7,
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          userSelect: 'none',
        }}
      >
        M
      </span>
    </div>
  );
}
