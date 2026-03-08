import { Outlet } from '@tanstack/react-router';
import { NavBar } from './NavBar';

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="container mx-auto px-6 py-8 max-w-3xl">
        <Outlet />
      </main>
    </div>
  );
}
