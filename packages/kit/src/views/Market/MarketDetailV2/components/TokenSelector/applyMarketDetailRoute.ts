import { CommonActions, StackActions } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

const MARKET_DETAIL_ROUTE_NAMES = new Set<string>([
  ETabMarketRoutes.MarketDetailV2,
  ETabMarketRoutes.MarketStockDetail,
  ETabMarketRoutes.MarketNativeDetail,
]);

const DETAIL_ROUTE_PARAM_KEYS = [
  'tokenAddress',
  'network',
  'isNative',
  'marketTokenId',
  'marketVariantId',
  'marketTokenCategory',
  'marketTokenSymbol',
  'resolveMarketAsset',
  'skipMarketDataFetch',
  'legacyTokenPreview',
  'stockId',
  'stockPreviewSymbol',
  'stockPreviewName',
  'stockPreviewLogoUrl',
  'from',
  'disableTrade',
  'showFavoriteButton',
] as const;

type INavigationRouteNode = {
  key?: string;
  name?: string;
  state?: INavigationStateNode;
};

export type INavigationStateNode = {
  key?: string;
  routes?: INavigationRouteNode[];
};

export type IExistingMarketDetailRoute = {
  routeKey: string;
  routeName: string;
  navigatorKey?: string;
};

export function findExistingMarketDetailRoute(
  state?: INavigationStateNode,
): IExistingMarketDetailRoute | undefined {
  if (!state?.routes?.length) {
    return undefined;
  }

  let found: IExistingMarketDetailRoute | undefined;
  for (const route of state.routes) {
    if (route.name && MARKET_DETAIL_ROUTE_NAMES.has(route.name) && route.key) {
      found = {
        routeKey: route.key,
        routeName: route.name,
        navigatorKey: state.key,
      };
    }
    const nested = findExistingMarketDetailRoute(route.state);
    if (nested) {
      found = nested;
    }
  }
  return found;
}

export function buildReplacedMarketDetailParams(
  params: Record<string, unknown>,
) {
  const next: Record<string, unknown> = {};
  for (const key of DETAIL_ROUTE_PARAM_KEYS) {
    next[key] = key in params ? params[key] : undefined;
  }
  return next;
}

export function applyExistingMarketDetailRoute({
  routeName,
  params,
}: {
  routeName: string;
  params: Record<string, unknown>;
}): boolean {
  const navigation = rootNavigationRef.current;
  const existing = findExistingMarketDetailRoute(navigation?.getRootState?.());
  if (!existing || !navigation) {
    return false;
  }

  const nextParams = buildReplacedMarketDetailParams(params);
  if (existing.routeName === routeName) {
    navigation.dispatch({
      ...CommonActions.setParams(nextParams),
      source: existing.routeKey,
    });
    return true;
  }

  if (!existing.navigatorKey) {
    return false;
  }

  navigation.dispatch({
    ...StackActions.replace(routeName, nextParams),
    target: existing.navigatorKey,
  });
  return true;
}
