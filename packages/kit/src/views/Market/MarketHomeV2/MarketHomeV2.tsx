import type { ForwardedRef } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Animated, Easing } from 'react-native';

import {
  Icon,
  Page,
  Spinner,
  Stack,
  Tab,
  useMedia,
} from '@onekeyhq/components';
import type { IColorTokens } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import useHomePageWidth from '../../Home/hooks/useHomePageWidth';
import { MarketHomeHeader } from '../components/MarketHomeHeader';
import { MarketHomeHeader as MDMarketHomeHeader } from '../components/MarketHomeHeader.md';
import { MarketHomeList } from '../components/MarketHomeList';
import { MarketWatchList } from '../components/MarketWatchList';
import { MarketWatchListProviderMirror } from '../MarketWatchListProviderMirror';

import { MarketFilterBar } from './components/MarketFilterBar';
import { MarketTokenList } from './components/MarketTokenList';
import MarketTokenListNetworkSelector from './components/MarketTokenListNetworkSelector/MarketTokenListNetworkSelector';
import { RiskIndicatorCardDemo } from './components/RiskIndicatorCard/RiskIndicatorCardDemo';

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

  const { gtMd } = useMedia();

  return (
    <Page>
      {gtMd && !platformEnv.isNativeIOSPad ? (
        <MarketHomeHeader />
      ) : (
        <MDMarketHomeHeader />
      )}
      <Page.Body>
        <MarketTokenListNetworkSelector />
        <RiskIndicatorCardDemo />
        <MarketFilterBar />
        <Stack flex={1}>
          <MarketTokenList />
        </Stack>
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
