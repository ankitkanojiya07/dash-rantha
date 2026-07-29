import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router';
import { AppLayout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { CalendarPage } from './pages/Calendar';
import { BookingsPage } from './pages/Bookings';
import { AgentsPage } from './pages/Agents';
import { ReportsPage } from './pages/Reports';
import { GuestsPage } from './pages/Guests';
import { SyncHealthPage } from './pages/SyncHealth';
import { SendMailPage } from './pages/SendMail';

const rootRoute = createRootRoute({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarPage,
});

const bookingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bookings',
  component: BookingsPage,
});

const agentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents',
  component: AgentsPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: ReportsPage,
});

const guestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guests',
  component: GuestsPage,
});

const syncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sync',
  component: SyncHealthPage,
});

const sendMailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/send-mail',
  component: SendMailPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  calendarRoute,
  bookingsRoute,
  agentsRoute,
  sendMailRoute,
  reportsRoute,
  guestsRoute,
  syncRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
