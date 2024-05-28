import { WEB_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IAppNavigation } from '../../hooks/useAppNavigation';

export function buildMarketFullUrl({ coinGeckoId }: { coinGeckoId: string }) {
  const origin =
    platformEnv.isWeb && !platformEnv.isDev
      ? window.location.origin
      : WEB_APP_URL;
  const path = `${EOneKeyDeepLinkPath.market_detail}?coinGeckoId=${coinGeckoId}`;
  return `${origin}${path}`;
}

export const marketNavigation = {
  async pushDetailPageFromDeeplink(
    navigation: IAppNavigation,
    {
      coinGeckoId,
    }: {
      coinGeckoId: string;
    },
  ) {
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.TabMarket,
      },
    });

    await timerUtils.wait(100);

    navigation.navigate(ETabRoutes.Market, {
      screen: ETabMarketRoutes.MarketDetail,
      params: {
        coinGeckoId,
      },
    });
  },
};
