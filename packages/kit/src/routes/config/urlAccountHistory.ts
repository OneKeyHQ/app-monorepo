import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import type { NavigationState } from '@react-navigation/core';

function getFocusedHomeTab(state: NavigationState) {
  const rootRoute = state.routes[state.index];
  if (rootRoute?.name !== ERootRoutes.Main) {
    return undefined;
  }
  const tabs = rootRoute.state;
  const tab = tabs?.routes[tabs.index ?? 0];
  return tab?.name === ETabRoutes.Home ? tab : undefined;
}

export function getUrlAccountHistoryBackRouteKey(
  previousState: NavigationState,
  state: NavigationState,
): string | undefined {
  const previousTab = getFocusedHomeTab(previousState);
  const tab = getFocusedHomeTab(state);
  const previousStack = previousTab?.state;
  const stack = tab?.state;
  if (!previousStack || !stack || previousTab.key !== tab.key) {
    return undefined;
  }

  const previousIndex = previousStack.index ?? 0;
  const index = stack.index ?? 0;
  const route = stack.routes[index];
  const historyRoute = previousStack.routes[index];
  if (!route || !historyRoute || index >= previousIndex) {
    return undefined;
  }

  const keptRoute = historyRoute.key === route.key;
  // If address search replaced Home, reuse the first address's history entry.
  const replacedFirstAddress =
    index === 0 && route.name === ETabHomeRoutes.TabHome;
  if (
    route.name !== ETabHomeRoutes.TabHomeUrlAccountPage &&
    (keptRoute || replacedFirstAddress) &&
    previousStack.routes
      .slice(keptRoute ? index + 1 : index, previousIndex + 1)
      .every(({ name }) => name === ETabHomeRoutes.TabHomeUrlAccountPage)
  ) {
    return historyRoute.key;
  }
  return undefined;
}
