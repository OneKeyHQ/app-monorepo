import { WEB_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IAppNavigation } from '../../hooks/useAppNavigation';

export function buildMarketFullUrl({ coinGeckoId }: { coinGeckoId: string }) {
  const origin =
    platformEnv.isWeb && !platformEnv.isDev
      ? globalThis.location.origin
      : WEB_APP_URL;
  const path = `/market/tokens/${coinGeckoId}`;
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
    await timerUtils.wait(80);
    navigation.switchTab(ETabRoutes.Market);
    await timerUtils.wait(80);
    navigation.push(ETabMarketRoutes.MarketDetail, {
      token: coinGeckoId,
    });
  },
};
