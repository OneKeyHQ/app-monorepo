import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

// The browser page the desktop sidebar's browser icon returns to: the
// Discovery home or the multi-tab browser the user left.
let lastBrowserRoute: ETabRoutes = ETabRoutes.Discovery;

export function getLastBrowserRoute() {
  return lastBrowserRoute;
}

export function setLastBrowserRoute(route: ETabRoutes) {
  lastBrowserRoute = route;
}
