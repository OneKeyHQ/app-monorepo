import { useEffect, useRef } from 'react';

import { StackActions } from '@react-navigation/routers';

import type { IPageScreenProps } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import {
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

type IDiscoveryMarketRouteProps = IPageScreenProps<
  ITabMarketParamList,
  | ETabMarketRoutes.MarketDetailV2
  | ETabMarketRoutes.MarketStockDetail
  | ETabMarketRoutes.MarketBannerDetail
>;

export function DiscoveryMarketRouteRedirect({
  route,
  navigation: stackNavigation,
}: IDiscoveryMarketRouteProps) {
  const navigation = useAppNavigation();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (hasRedirectedRef.current) {
      return;
    }
    hasRedirectedRef.current = true;
    const routeName = route.name;
    const routeParams = route.params;

    const stackIndex = stackNavigation?.getState?.()?.index ?? 0;
    const canPopInDiscovery =
      stackIndex > 0 && Boolean(stackNavigation?.canGoBack?.());
    if (canPopInDiscovery) {
      stackNavigation.goBack();
    }

    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: routeName,
        params: routeParams,
      },
    } as any);

    // When this legacy route is the Discovery stack root, there is nothing to
    // pop without touching parent history; replace it with the Discovery home
    // so returning to the Discovery tab does not show this empty redirect.
    if (!canPopInDiscovery) {
      stackNavigation?.dispatch?.(
        StackActions.replace(ETabDiscoveryRoutes.TabDiscovery),
      );
    }
  }, [navigation, route.name, route.params, stackNavigation]);

  return null;
}
