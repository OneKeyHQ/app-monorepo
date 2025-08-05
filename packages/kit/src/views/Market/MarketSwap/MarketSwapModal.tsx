import { useEffect } from 'react';

import { Page, View, useMedia } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { SwapPanelWrap } from '../MarketDetailV2/components/SwapPanel/SwapPanelWrap';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

export default function MarketSwapModal() {
  const navigation = useAppNavigation();
  const media = useMedia();

  useEffect(() => {
    const handleSwapSuccess = () => {
      setTimeout(() => {
        navigation.pop();
      }, 200);
    };

    appEventBus.on(
      EAppEventBusNames.SwapSpeedBuildTxSuccess,
      handleSwapSuccess,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapSpeedBuildTxSuccess,
        handleSwapSuccess,
      );
    };
  }, [navigation]);

  // Auto close when screen size is larger than lg
  useEffect(() => {
    if (media.gtMd) {
      navigation.pop();
    }
  }, [media.gtMd, navigation]);

  return (
    <Page>
      <Page.Header title="Swap" />
      <Page.Body>
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
            <View p="$4">
              <SwapPanelWrap />
            </View>
          </MarketWatchListProviderMirrorV2>
        </AccountSelectorProviderMirror>
      </Page.Body>
    </Page>
  );
}
