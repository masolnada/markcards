import { Link } from '@tanstack/react-router';
import { useTheme } from '@markcards/ui';

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function NavBar() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-border bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-3xl h-12 flex items-center justify-between">
        <nav className="flex items-center gap-6">
          <span className="font-mono font-semibold text-sm text-foreground tracking-tight">markcards</span>
          <Link
            to="/review"
            search={{ deck: undefined }}
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors [&.active]:text-foreground [&.active]:underline [&.active]:underline-offset-4"
          >
            review
          </Link>
          <Link
            to="/decks"
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors [&.active]:text-foreground [&.active]:underline [&.active]:underline-offset-4"
          >
            decks
          </Link>
          <Link
            to="/skills"
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors [&.active]:text-foreground [&.active]:underline [&.active]:underline-offset-4"
          >
            skills
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`https://github.com/masolnada/markcards/commit/${__APP_VERSION__.split('-')[1]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {__APP_VERSION__}
          </a>
          <button
            onClick={toggleTheme}
            className="h-7 w-7 border border-transparent flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors cursor-pointer"
            aria-label={resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {resolvedTheme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </div>
    </header>
  );
}
