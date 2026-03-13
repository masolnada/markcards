import {
  createRouter,
  createRoute,
  createRootRoute,
  redirect,
} from '@tanstack/react-router';
import { RootLayout } from './routes/root/route';
import { DecksPage } from './routes/decks/route';
import { ReviewPage } from './routes/review/route';
import { SkillsPage } from './routes/skills/route';
import { SuspendedPage } from './routes/suspended/route';

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/review', search: { deck: undefined } });
  },
});

const decksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/decks',
  component: DecksPage,
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  validateSearch: (search: Record<string, unknown>) => ({
    deck: typeof search.deck === 'string' ? search.deck : undefined,
  }),
  component: ReviewPage,
});

const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/skills',
  component: SkillsPage,
});

const suspendedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/suspended',
  component: SuspendedPage,
});

const routeTree = rootRoute.addChildren([indexRoute, decksRoute, reviewRoute, skillsRoute, suspendedRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
