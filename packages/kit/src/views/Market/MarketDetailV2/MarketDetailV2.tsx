import { useEffect } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, useMedia } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useTokenDetailActions } from '../../../states/jotai/contexts/marketV2';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import { MarketDetailHeader } from './components/MarketDetailHeader';
import { useAutoRefreshTokenDetail } from './hooks';
import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetailV2>) {
  const { tokenAddress, networkId, isNative } = route.params;
  const media = useMedia();
  const tokenDetailActions = useTokenDetailActions();

  // Clear all token detail content when unmount
  useEffect(() => {
    const actions = tokenDetailActions.current;
    return () => {
      actions.setTokenDetail(undefined);
      actions.setTokenDetailLoading(false);
      actions.setTokenAddress('');
      actions.setNetworkId('');
    };
  }, [tokenDetailActions]);

  // Start auto-refresh for token details every 5 seconds
  useAutoRefreshTokenDetail({
    tokenAddress,
    networkId,
  });

  return (
    <Page>
      <MarketDetailHeader isNative={isNative} />

      <Page.Body>
        {media.gtLg ? (
          <DesktopLayout isNative={isNative} />
        ) : (
          <MobileLayout isNative={isNative} />
        )}
      </Page.Body>
    </Page>
  );
}

function MarketDetailV2(
  props: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetailV2>,
) {
  useEffect(() => {
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
