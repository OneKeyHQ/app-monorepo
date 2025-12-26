import { useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Page,
  useIsNativeTablet,
  useMedia,
  useOrientation,
} from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useMarketEnterAnalytics } from '../hooks';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import { MarketDetailHeader } from './components/MarketDetailHeader';
import { useAutoRefreshTokenDetail } from './hooks';
import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';

function MarketDetail({
  route,
}: IPageScreenProps<
  ITabMarketParamList,
  ETabMarketRoutes.MarketDetailV2 | ETabMarketRoutes.MarketNativeDetail
>) {
  const params = route.params as
    | ITabMarketParamList[ETabMarketRoutes.MarketDetailV2]
    | ITabMarketParamList[ETabMarketRoutes.MarketNativeDetail];

  const network = params.network;
  const isNative = params.isNative;
  const disableTrade = params.disableTrade;
  // For MarketNativeDetail route, tokenAddress is undefined, use empty string
  const tokenAddress = 'tokenAddress' in params ? params.tokenAddress : '';

  // Convert shortcode back to full networkId if needed
  // network is a shortcode like 'bsc', convert it to 'evm--56'
  const networkId =
    networkUtils.getNetworkIdFromShortCode({ shortCode: network }) || network;
  const isNativeBoolean =
    typeof isNative === 'string' ? isNative === 'true' : isNative ?? false;

  // Track market entry analytics
  useMarketEnterAnalytics();

  // Start auto-refresh for token details every 5 seconds
  // Use actualNetworkId (converted from shortcode if needed) for API calls
  useAutoRefreshTokenDetail({
    tokenAddress,
    networkId,
    isNative: isNativeBoolean,
  });

  const media = useMedia();

  return (
    <Page>
      <MarketDetailHeader />

      <Page.Body>
        {media.gtLg && !platformEnv.isNative ? (
          <DesktopLayout />
        ) : (
          <MobileLayout disableTrade={disableTrade} />
        )}
      </Page.Body>
    </Page>
  );
}

function MarketDetailV2(
  props: IPageScreenProps<
    ITabMarketParamList,
    ETabMarketRoutes.MarketDetailV2 | ETabMarketRoutes.MarketNativeDetail
  >,
) {
  const isLandscape = useOrientation();
  const isTablet = useIsNativeTablet();
  useFocusEffect(
    useCallback(() => {
      if (platformEnv.isExtension || (isTablet && isLandscape)) {
        return;
      }

      appEventBus.emit(EAppEventBusNames.HideTabBar, true);

      return () => {
        appEventBus.emit(EAppEventBusNames.HideTabBar, false);
      };
    }, [isLandscape, isTablet]),
  );

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <MarketDetail {...props} />
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}

export { MarketDetailV2 };
