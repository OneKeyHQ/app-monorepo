import { useEffect } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, useMedia } from '@onekeyhq/components';
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
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetailV2>) {
  const { tokenAddress, network, isNative } = route.params;

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

      <Page.Body>{media.gtLg ? <DesktopLayout /> : <MobileLayout />}</Page.Body>
    </Page>
  );
}

function MarketDetailV2(
  props: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetailV2>,
) {
  useEffect(() => {
    if (platformEnv.isExtension) {
      return;
    }

    appEventBus.emit(EAppEventBusNames.HideTabBar, true);

    return () => {
      appEventBus.emit(EAppEventBusNames.HideTabBar, false);
    };
  }, []);

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
