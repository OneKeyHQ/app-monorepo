import { WEB_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IAppNavigation } from '../../hooks/useAppNavigation';

export function buildMarketFullUrl({ coinGeckoId }: { coinGeckoId: string }) {
  const origin =
    platformEnv.isWeb && !platformEnv.isDev
      ? window.location.origin
      : WEB_APP_URL;
  const path = `/market/market_detail?coinGeckoId=${coinGeckoId}`;
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
    // TODO：it's a trick to refresh the tab.
    navigation.switchTab(ETabRoutes.Market);
    await timerUtils.wait(100);
    navigation.switchTab(ETabRoutes.Home);
    await timerUtils.wait(100);
    navigation.switchTab(ETabRoutes.Market);
    await timerUtils.wait(100);

    navigation.push(ETabMarketRoutes.MarketDetail, {
      coinGeckoId,
    });
  },
};
