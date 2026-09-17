import { CommonActions, StackActions } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalSwapRoutes,
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
} from '@onekeyhq/shared/src/routes';

const REPLACEABLE_MARKET_DETAIL_ROUTE_NAMES = new Set<string>([
  ETabMarketRoutes.MarketDetail,
  ETabMarketRoutes.MarketDetailV2,
  ETabMarketRoutes.MarketStockDetail,
  ETabMarketRoutes.MarketNativeDetail,
]);

const MARKET_HOST_ROUTE_NAMES = new Set<string>([
  ...REPLACEABLE_MARKET_DETAIL_ROUTE_NAMES,
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
  'marketTokenPreviewId',
  'stockId',
  'stockPreviewSymbol',
  'stockPreviewName',
  'stockPreviewLogoUrl',
  'from',
  'disableTrade',
  'showFavoriteButton',
] as const;

const SWAP_PRO_OWNED_PARAM_KEYS = [
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
  | { type: 'reset'; name: string; params?: Record<string, unknown> };

type INavigationLike = {
  dispatch: (action: object) => void;
  getRootState?: () => INavigationStateNode | undefined;
  getCurrentRoute?: () => { name?: string; key?: string } | undefined;
};

export function isReplaceableMarketDetailRouteName(name?: string) {
  return Boolean(name && REPLACEABLE_MARKET_DETAIL_ROUTE_NAMES.has(name));
}

export function isMarketHostRouteName(name?: string) {
  return Boolean(name && MARKET_HOST_ROUTE_NAMES.has(name));
}

export function isFocusedMarketDetailRouteName(name?: string) {
  return (
    isReplaceableMarketDetailRouteName(name) ||
    name === EModalSwapRoutes.SwapProMarketDetail
  );
}

export function getMarketListRootName() {
  return platformEnv.isNative
    ? ETabDiscoveryRoutes.TabDiscovery
    : ETabMarketRoutes.TabMarket;
}

export function getNativeMarketListResetParams() {
  return { defaultTab: ETranslations.global_market };
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

function omitSwapProOwnedParams(params: Record<string, unknown>) {
  const next = { ...params };
  for (const key of SWAP_PRO_OWNED_PARAM_KEYS) {
    delete next[key];
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
        isMarketHostRouteName(route.name),
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
  if (routes.some((route) => isReplaceableMarketDetailRouteName(route.name))) {
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

function containsStack(
  state: INavigationStateNode | undefined,
  stackKey: string,
): boolean {
  if (!state) {
    return false;
  }
  if (state.key === stackKey) {
    return true;
  }
  return Boolean(
    state.routes?.some((route) => containsStack(route.state, stackKey)),
  );
}

function isBackgroundMainMarketStack(
  root: INavigationStateNode | undefined,
  stack: INavigationStateNode,
) {
  if (!root?.routes?.length || !stack.key) {
    return false;
  }
  const focused = root.routes[root.index ?? root.routes.length - 1];
  if (!focused?.name || focused.name === ERootRoutes.Main) {
    return false;
  }
  const mainRoute = root.routes.find(
    (route) => route.name === ERootRoutes.Main,
  );
  return containsStack(mainRoute?.state, stack.key);
}

function stackOwnsFocusedRoute(stack: INavigationStateNode, routeKey?: string) {
  return Boolean(
    routeKey && stack.routes?.some((route) => route.key === routeKey),
  );
}

function shouldSkipUnfocusedMainMarketStack({
  root,
  stack,
  focusedRoute,
}: {
  root?: INavigationStateNode;
  stack: INavigationStateNode;
  focusedRoute?: { name?: string; key?: string };
}) {
  if (!isBackgroundMainMarketStack(root, stack)) {
    return false;
  }
  if (!isFocusedMarketDetailRouteName(focusedRoute?.name)) {
    return false;
  }
  return !stackOwnsFocusedRoute(stack, focusedRoute?.key);
}

type IResetRoute = {
  name: string;
  key?: string;
  params?: Record<string, unknown>;
};

function toResetRoute(route: INavigationRouteNode): IResetRoute {
  return {
    name: route.name ?? getMarketListRootName(),
    ...(route.key ? { key: route.key } : {}),
    ...(route.params ? { params: route.params } : {}),
  };
}

function getPreservedHostRoutes(stack: INavigationStateNode): IResetRoute[] {
  const preserved: IResetRoute[] = [];
  for (const route of stack.routes ?? []) {
    if (isReplaceableMarketDetailRouteName(route.name)) {
      break;
    }
    preserved.push(toResetRoute(route));
  }
  if (preserved.length) {
    return preserved;
  }
  return [toResetRoute({ name: getMarketListRootName() })];
}

function canUpdateCurrentDetailInPlace(
  stack: INavigationStateNode,
  routeName: string,
) {
  const routes = stack.routes ?? [];
  const current = routes[stack.index ?? routes.length - 1];
  const leftoverDetailCount = routes.filter((route) =>
    isReplaceableMarketDetailRouteName(route.name),
  ).length;
  return Boolean(
    current?.key && current.name === routeName && leftoverDetailCount <= 1,
  );
}

function dispatchResetToSingleDetail({
  navigation,
  stackKey,
  hostRoutes,
  routeName,
  params,
}: {
  navigation: INavigationLike;
  stackKey: string;
  hostRoutes: IResetRoute[];
  routeName: string;
  params: Record<string, unknown>;
}) {
  navigation.dispatch({
    ...CommonActions.reset({
      index: hostRoutes.length,
      routes: [...hostRoutes, { name: routeName, params }],
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
  const rootState = navigation?.getRootState?.();
  const stack = findMarketTabStack(rootState);
  if (!navigation || !stack?.key || !stack.routes?.length) {
    return false;
  }
  if (
    shouldSkipUnfocusedMainMarketStack({
      root: rootState,
      stack,
      focusedRoute: navigation.getCurrentRoute?.(),
    })
  ) {
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

  dispatchResetToSingleDetail({
    navigation,
    stackKey: stack.key,
    hostRoutes: getPreservedHostRoutes(stack),
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
  if (!navigation || !isFocusedMarketDetailRouteName(current?.name)) {
    return false;
  }

  const nextParams = buildReplacedMarketDetailParams(params);
  if (current?.name === EModalSwapRoutes.SwapProMarketDetail) {
    navigation.dispatch({
      ...CommonActions.setParams(omitSwapProOwnedParams(nextParams)),
      ...(current.key ? { source: current.key } : {}),
    });
    return true;
  }
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

function buildNativeListResetAction(): IMarketDetailBackAction {
  return {
    type: 'reset',
    name: ETabDiscoveryRoutes.TabDiscovery,
    params: getNativeMarketListResetParams(),
  };
}

function resolveEntryBackAction({
  isNative,
  from,
  routes,
}: {
  isNative: boolean;
  from?: EEnterWay;
  routes?: Array<{ name?: string }>;
}): IMarketDetailBackAction | undefined {
  if (isNative && from === EEnterWay.Search) {
    if (!routes?.length || routes.length <= 1) {
      return buildNativeListResetAction();
    }
    return { type: 'popAndSwitchDiscovery' };
  }
  if (from === EEnterWay.SwapPro || from === EEnterWay.BannerList) {
    return { type: 'pop' };
  }
  return undefined;
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

  const fromAction = resolveEntryBackAction({ isNative, from, routes });
  if (fromAction) {
    return fromAction;
  }

  const listRootName = isNative
    ? ETabDiscoveryRoutes.TabDiscovery
    : ETabMarketRoutes.TabMarket;
  if (!routes?.length || routes.length <= 1) {
    return isNative
      ? buildNativeListResetAction()
      : { type: 'reset', name: listRootName };
  }

  const currentIndex = index ?? routes.length - 1;
  const previousRoute = currentIndex > 0 ? routes[currentIndex - 1] : undefined;
  if (isReplaceableMarketDetailRouteName(previousRoute?.name)) {
    return { type: 'popToTop' };
  }
  return { type: 'pop' };
}
