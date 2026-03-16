import { Outlet, useRouterState } from '@tanstack/react-router';
import { HelpProvider } from './HelpProvider';
import { HelpOverlay } from './HelpOverlay/HelpOverlay';
import { NavBar } from './NavBar';

export function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const route = pathname === '/review' ? 'review' : 'other';

  return (
    <HelpProvider>
      <div className="min-h-screen bg-background text-foreground">
        <NavBar />
        <main className="container mx-auto px-6 py-8 max-w-3xl">
          <Outlet />
        </main>
        <HelpOverlay route={route} />
      </div>
    </HelpProvider>
  );
}
