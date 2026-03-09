import { navigateFromOverlayToTab } from '@onekeyhq/components';
import { WEB_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
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
      ? globalThis.location.origin
      : WEB_APP_URL;
  const path = `/market/tokens/${coinGeckoId}`;
  return `${origin}${path}`;
}

export function buildMarketFullUrlV2({
  network,
  address,
  isNative,
}: {
  network: string;
  address: string;
  isNative?: boolean;
}) {
  const origin =
    platformEnv.isWeb && !platformEnv.isDev
      ? globalThis.location.origin
      : WEB_APP_URL;

  let path = `/market/token/${network}/${address}`;

  // Add isNative as query parameter if needed
  if (typeof isNative === 'boolean' && isNative) {
    path += `?isNative=${String(isNative)}`;
  }

  return `${origin}${path}`;
}

export const marketNavigation = {
  // V1 version - for legacy MarketDetail page
  async pushDetailPageFromDeeplinkV1(
    navigation: IAppNavigation,
    {
      coinGeckoId,
    }: {
      coinGeckoId: string;
    },
  ) {
    await timerUtils.wait(80);
    navigation.switchTab(ETabRoutes.Market);
    await timerUtils.wait(100);

    // Navigate to V1 MarketDetail page
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetail,
        params: {
          token: coinGeckoId,
        },
      },
    });
  },

  // Default version - for backward compatibility, points to V1
  async pushDetailPageFromDeeplink(
    navigation: IAppNavigation,
    {
      coinGeckoId,
    }: {
      coinGeckoId: string;
    },
  ) {
    // Keep backward compatibility by using V1 version
    return this.pushDetailPageFromDeeplinkV1(navigation, {
      coinGeckoId,
    });
  },

  // Safe version for navigating from overlay routes (scan modal, ActionCenter).
  // Uses navigateFromOverlayToTab to atomically remove all overlay routes
  // via reset, avoiding the native UITabBarController window-nil race
  // condition where RNSScreenStack retries exhaust on detached tab views.
  async pushDetailPageFromOverlay(
    navigation: IAppNavigation,
    {
      coinGeckoId,
    }: {
      coinGeckoId: string;
    },
  ) {
    await navigateFromOverlayToTab({
      targetTab: ETabRoutes.Market,
      switchTab: (tab) => navigation.switchTab(tab),
    });
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetail,
        params: {
          token: coinGeckoId,
        },
      },
    });
  },
};
