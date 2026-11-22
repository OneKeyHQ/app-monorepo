import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

// The browser page the desktop Browser entries return to: the Discovery home
// or the multi-tab browser the user left. Recorded from the tab navigator's
// focus (desktop), read by the sidebar icon, its overflow item and Cmd+7.
let lastBrowserRoute: ETabRoutes = ETabRoutes.Discovery;

export function getLastBrowserRoute() {
  return lastBrowserRoute;
}

export function setLastBrowserRoute(route: ETabRoutes) {
  lastBrowserRoute = route;
}
