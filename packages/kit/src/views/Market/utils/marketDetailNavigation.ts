import { CommonActions, StackActions } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
} from '@onekeyhq/shared/src/routes';

const MARKET_DETAIL_ROUTE_NAMES = new Set<string>([
  ETabMarketRoutes.MarketDetail,
  ETabMarketRoutes.MarketDetailV2,
  ETabMarketRoutes.MarketStockDetail,
  ETabMarketRoutes.MarketNativeDetail,
  ETabMarketRoutes.MarketBannerDetail,
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

export type INavigationRouteNode = {
  key?: string;
  name?: string;
  params?: Record<string, unknown>;
  state?: INavigationStateNode;
};

export type INavigationStateNode = {
  key?: string;
  index?: number;
  routes?: INavigationRouteNode[];
};

export type IMarketDetailBackAction =
  | { type: 'pop' }
  | { type: 'popToTop' }
  | { type: 'popAndSwitchDiscovery' }
  | { type: 'reset'; name: string };

type INavigationLike = {
  dispatch: (action: object) => void;
  getRootState?: () => INavigationStateNode | undefined;
  getCurrentRoute?: () => { name?: string; key?: string } | undefined;
};

export function isMarketDetailRouteName(name?: string) {
  return Boolean(name && MARKET_DETAIL_ROUTE_NAMES.has(name));
}

export function getMarketListRootName() {
  return platformEnv.isNative
    ? ETabDiscoveryRoutes.TabDiscovery
    : ETabMarketRoutes.TabMarket;
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

function isMarketTabStack(state: INavigationStateNode) {
  return Boolean(
    state.key &&
    state.routes?.some(
      (route) =>
        route.name === ETabMarketRoutes.TabMarket ||
        route.name === ETabDiscoveryRoutes.TabDiscovery ||
        isMarketDetailRouteName(route.name),
    ),
  );
}

function collectMarketTabStacks(
  state: INavigationStateNode | undefined,
  stacks: INavigationStateNode[],
) {
  if (!state?.routes?.length) {
    return;
  }
  if (isMarketTabStack(state)) {
    stacks.push(state);
  }
  for (const route of state.routes) {
    collectMarketTabStacks(route.state, stacks);
  }
}

function getMarketTabStackScore(stack: INavigationStateNode) {
  const routes = stack.routes ?? [];
  if (routes.some((route) => isMarketDetailRouteName(route.name))) {
    return 3;
  }
  const listRootName = getMarketListRootName();
  if (routes.some((route) => route.name === listRootName)) {
    return 2;
  }
  return 1;
}

export function findMarketTabStack(state?: INavigationStateNode) {
  const stacks: INavigationStateNode[] = [];
  collectMarketTabStacks(state, stacks);
  if (!stacks.length) {
    return undefined;
  }
  return stacks.reduce((best, stack) =>
    getMarketTabStackScore(stack) >= getMarketTabStackScore(best)
      ? stack
      : best,
  );
}

function canUpdateCurrentDetailInPlace(
  stack: INavigationStateNode,
  routeName: string,
) {
  const routes = stack.routes ?? [];
  const current = routes[stack.index ?? routes.length - 1];
  const detailCount = routes.filter((route) =>
    isMarketDetailRouteName(route.name),
  ).length;
  return Boolean(
    current?.key && current.name === routeName && detailCount <= 1,
  );
}

function dispatchResetToSingleDetail({
  navigation,
  stackKey,
  listRoute,
  routeName,
  params,
}: {
  navigation: INavigationLike;
  stackKey: string;
  listRoute: INavigationRouteNode;
  routeName: string;
  params: Record<string, unknown>;
}) {
  const listResetRoute = {
    name: listRoute.name ?? getMarketListRootName(),
    ...(listRoute.key ? { key: listRoute.key } : {}),
    ...(listRoute.params ? { params: listRoute.params } : {}),
  };
  navigation.dispatch({
    ...CommonActions.reset({
      index: 1,
      routes: [listResetRoute, { name: routeName, params }],
    }),
    target: stackKey,
  });
}

export function openOrReplaceMarketDetailRoute({
  routeName,
  params,
}: {
  routeName: string;
  params: Record<string, unknown>;
}): boolean {
  const navigation = rootNavigationRef.current as INavigationLike | undefined;
  const stack = findMarketTabStack(navigation?.getRootState?.());
  if (!navigation || !stack?.key || !stack.routes?.length) {
    return false;
  }

  const nextParams = buildReplacedMarketDetailParams(params);
  const current = stack.routes[stack.index ?? stack.routes.length - 1];
  if (canUpdateCurrentDetailInPlace(stack, routeName) && current?.key) {
    navigation.dispatch({
      ...CommonActions.setParams(nextParams),
      source: current.key,
    });
    return true;
  }

  const listRootName = getMarketListRootName();
  const listRoute = stack.routes.find(
    (route) => route.name === listRootName,
  ) ?? {
    name: listRootName,
  };
  dispatchResetToSingleDetail({
    navigation,
    stackKey: stack.key,
    listRoute,
    routeName,
    params: nextParams,
  });
  return true;
}

export function replaceFocusedMarketDetailRoute({
  routeName,
  params,
}: {
  routeName: string;
  params: Record<string, unknown>;
}): boolean {
  const navigation = rootNavigationRef.current as INavigationLike | undefined;
  const current = navigation?.getCurrentRoute?.();
  if (!navigation || !isMarketDetailRouteName(current?.name)) {
    return false;
  }

  const nextParams = buildReplacedMarketDetailParams(params);
  if (current?.name === routeName) {
    navigation.dispatch({
      ...CommonActions.setParams(nextParams),
      ...(current.key ? { source: current.key } : {}),
    });
    return true;
  }

  navigation.dispatch(StackActions.replace(routeName, nextParams));
  return true;
}

export function resolveMarketDetailBackAction({
  isTabletDetailView,
  isNative,
  from,
  routes,
  index,
}: {
  isTabletDetailView: boolean;
  isNative: boolean;
  from?: EEnterWay;
  routes?: Array<{ name?: string }>;
  index?: number;
}): IMarketDetailBackAction {
  if (isTabletDetailView) {
    return { type: 'pop' };
  }

  const listRootName = isNative
    ? ETabDiscoveryRoutes.TabDiscovery
    : ETabMarketRoutes.TabMarket;

  if (isNative && from === EEnterWay.Search) {
    if (!routes?.length || routes.length <= 1) {
      return { type: 'reset', name: ETabDiscoveryRoutes.TabDiscovery };
    }
    return { type: 'popAndSwitchDiscovery' };
  }

  if (from === EEnterWay.SwapPro) {
    return { type: 'pop' };
  }

  if (!routes?.length || routes.length <= 1) {
    return { type: 'reset', name: listRootName };
  }

  const currentIndex = index ?? routes.length - 1;
  const previousRoute = currentIndex > 0 ? routes[currentIndex - 1] : undefined;
  if (
    previousRoute?.name === ETabMarketRoutes.TabMarket ||
    previousRoute?.name === ETabDiscoveryRoutes.TabDiscovery
  ) {
    return { type: 'pop' };
  }

  return { type: 'popToTop' };
}
