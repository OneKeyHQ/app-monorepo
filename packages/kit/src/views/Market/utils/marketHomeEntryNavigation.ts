import { rootNavigationRef } from '@onekeyhq/components';
import {
  EMarketHomeEntrySource,
  markMarketHomeEntry,
} from '@onekeyhq/shared/src/logger/scopes/market/marketHomeEntry';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

type IFocusStateNode = {
  index?: number;
  routes?: Array<{ name?: string; state?: IFocusStateNode }>;
};

function getFocusedRoute(
  state: IFocusStateNode | undefined,
  fallbackIndex: (length: number) => number,
) {
  const routes = state?.routes;
  if (!routes?.length) return undefined;
  return routes[state?.index ?? fallbackIndex(routes.length)];
}

/**
 * True when the focused route path is root Main -> Market tab -> Market home.
 * A root overlay (modal, full screen push) or a detail on top of the home
 * means the home is not focused, so navigating to it is a focus transition.
 */
export function isMarketHomeFocusedInState(
  rootState: IFocusStateNode | undefined,
): boolean {
  const rootRoute = getFocusedRoute(rootState, (length) => length - 1);
  if (rootRoute?.name !== ERootRoutes.Main) return false;
  const tabRoute = getFocusedRoute(rootRoute.state, () => 0);
  if (tabRoute?.name !== ETabRoutes.Market) return false;
  const marketRoute = getFocusedRoute(tabRoute.state, (length) => length - 1);
  return marketRoute?.name === ETabMarketRoutes.TabMarket;
}

/**
 * Deep link handlers call this right before navigating to the Market home.
 * When the home is already focused no focus gain follows, and a marker left
 * behind would be consumed by an unrelated later focus gain (e.g. a back
 * from a detail), so it is only written when a focus transition will happen.
 */
export function markMarketHomeDeeplinkEntry() {
  // The handlers navigate the root container, so its state is the one that
  // decides whether the navigation changes focus.
  const rootState: IFocusStateNode | undefined =
    rootNavigationRef.current?.getRootState();
  if (isMarketHomeFocusedInState(rootState)) return;
  markMarketHomeEntry(EMarketHomeEntrySource.Deeplink);
}
