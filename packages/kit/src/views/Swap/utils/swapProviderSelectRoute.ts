import { rootNavigationRef } from '@onekeyhq/components';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';

function getActiveQuoteRoute(
  route: unknown,
): { name: string; params?: unknown } | undefined {
  if (!route || typeof route !== 'object') {
    return undefined;
  }
  if ('routes' in route && Array.isArray(route.routes)) {
    const index =
      'index' in route && typeof route.index === 'number'
        ? route.index
        : route.routes.length - 1;
    return getActiveQuoteRoute(route.routes[index]);
  }
  if ('state' in route && route.state) {
    return getActiveQuoteRoute(route.state);
  }
  if ('params' in route) {
    const destination = getActiveQuoteRoute(route.params);
    if (destination) {
      return destination;
    }
  }
  if ('screen' in route && typeof route.screen === 'string') {
    return {
      name: route.screen,
      params: 'params' in route ? route.params : undefined,
    };
  }
  return 'name' in route && typeof route.name === 'string'
    ? { name: route.name, params: 'params' in route ? route.params : undefined }
    : undefined;
}

export function shouldKeepSwapQuoteAliveOnFocusLoss(
  routeName?: string,
  rootState?: unknown,
  storeName?: EJotaiContextStoreNames,
) {
  const route = getActiveQuoteRoute(rootState);
  if (storeName !== undefined) {
    return (
      route?.name === EModalSwapRoutes.SwapProviderSelect &&
      !!route.params &&
      typeof route.params === 'object' &&
      'storeName' in route.params &&
      route.params.storeName === storeName &&
      !('providerSelect' in route.params && route.params.providerSelect)
    );
  }
  return (
    routeName === EModalSwapRoutes.SwapProviderSelect ||
    route?.name === EModalSwapRoutes.SwapProviderSelect
  );
}

export function isSwapProviderSelectRouteActive(
  storeName: EJotaiContextStoreNames,
) {
  const navigation = rootNavigationRef.current;
  const currentRoute = navigation?.getCurrentRoute();
  return shouldKeepSwapQuoteAliveOnFocusLoss(
    currentRoute?.name,
    navigation?.getRootState?.() ?? currentRoute,
    storeName,
  );
}
