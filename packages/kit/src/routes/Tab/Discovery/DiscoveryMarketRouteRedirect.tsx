import { useEffect, useRef } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

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

    if (stackNavigation?.canGoBack?.()) {
      stackNavigation.goBack();
    }

    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: routeName,
        params: routeParams,
      },
    } as any);
  }, [navigation, route.name, route.params, stackNavigation]);

  return null;
}
