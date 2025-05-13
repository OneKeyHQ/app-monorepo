import { useEffect } from 'react';

import { Animated, Easing } from 'react-native';

import { Page } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import useHomePageWidth from '../../Home/hooks/useHomePageWidth';
import { MarketWatchListProviderMirror } from '../MarketWatchListProviderMirror';

import { MarketFilterBar } from './components/MarketFilterBar';
import { MarketTokenList } from './components/MarketTokenList';
import MarketTokenListNetworkSelector from './components/MarketTokenListNetworkSelector/MarketTokenListNetworkSelector';

let CONTENT_ITEM_WIDTH: Animated.Value | undefined;

function MarketHome() {
  const { pageWidth } = useHomePageWidth();
  if (CONTENT_ITEM_WIDTH == null) {
    CONTENT_ITEM_WIDTH = new Animated.Value(pageWidth);
  }
  useEffect(() => {
    if (!CONTENT_ITEM_WIDTH) {
      return;
    }
    Animated.timing(CONTENT_ITEM_WIDTH, {
      toValue: pageWidth,
      duration: 400,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pageWidth]);

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body>
        <MarketTokenListNetworkSelector />

        <MarketFilterBar />

        <MarketTokenList />
      </Page.Body>
    </Page>
  );
}

export function MarketHomeV2() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirror
        storeName={EJotaiContextStoreNames.marketWatchList}
      >
        <MarketHome />
      </MarketWatchListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
