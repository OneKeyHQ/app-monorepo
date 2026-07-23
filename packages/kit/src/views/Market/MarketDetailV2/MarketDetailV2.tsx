import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, useIsModalPage, useMedia } from '@onekeyhq/components';
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
import { MarketTestIDs } from '../testIDs';

import { MarketDetailHeader } from './components/MarketDetailHeader';
import { BtcMetadataProvider, useAutoRefreshTokenDetail } from './hooks';
import { MarketDetailResponsiveLayout } from './layouts/MarketDetailResponsiveLayout';
import { preloadMarketDetailV2BodyModules } from './utils/marketDetailPagePreload';

function normalizeRouteBooleanParam(
  value: boolean | string | undefined,
  defaultValue: boolean,
) {
  if (typeof value === 'string') {
    return value === 'true';
  }
  return value ?? defaultValue;
}

function MarketDetail({
  isChartFullscreen,
  isRouteFocused,
  shouldRenderContent,
  onChartFullscreenChange,
  route,
}: IPageScreenProps<
  ITabMarketParamList,
  ETabMarketRoutes.MarketDetailV2 | ETabMarketRoutes.MarketNativeDetail
> & {
  isChartFullscreen: boolean;
  isRouteFocused: boolean;
  shouldRenderContent: boolean;
  onChartFullscreenChange: (isFullscreen: boolean) => void;
}) {
  const params = route.params as
    | ITabMarketParamList[ETabMarketRoutes.MarketDetailV2]
    | ITabMarketParamList[ETabMarketRoutes.MarketNativeDetail];

  const network = params.network;
  const isNative = params.isNative;
  const disableTrade = params.disableTrade;
  const showFavoriteButton = normalizeRouteBooleanParam(
    params.showFavoriteButton,
    true,
  );
  // For MarketNativeDetail route, tokenAddress is undefined, use empty string
  const tokenAddress = 'tokenAddress' in params ? params.tokenAddress : '';

  // Convert shortcode back to full networkId if needed
  // network is a shortcode like 'bsc', convert it to 'evm--56'
  const networkId =
    networkUtils.getNetworkIdFromShortCode({ shortCode: network }) || network;
  const isNativeBoolean = normalizeRouteBooleanParam(isNative, false);

  // Track market entry analytics
  useMarketEnterAnalytics();

  // Start auto-refresh for token details every 5 seconds
  // Use actualNetworkId (converted from shortcode if needed) for API calls
  useAutoRefreshTokenDetail({
    tokenAddress,
    networkId,
    isNative: isNativeBoolean,
    enabled: isRouteFocused,
  });

  const media = useMedia();
  const isDesktopLayout = media.gtLg && !platformEnv.isNative;
  // iOS 26+ root-tab headers are translucent (Liquid Glass) so the page
  // body extends under the bar — without an explicit top inset the
  // chart / 图表 / 概述 tabs sit clipped behind the navbar position.
  // The modal entry (EModalMarketRoutes.MarketDetailV2) renders against
  // an opaque non-root header where react-native-screens already lays
  // content out below the bar; adding headerHeight there would push the
  // body down twice and leave a blank band at the top.
  const isModalPage = useIsModalPage();
  const headerHeight = useHeaderHeight();
  const bodyPaddingTop =
    platformEnv.isNativeIOS26Plus && !isModalPage ? headerHeight : 0;

  useEffect(() => {
    preloadMarketDetailV2BodyModules({
      layout: isDesktopLayout ? 'desktop' : 'mobile',
      includeHeavyModules: true,
    });
  }, [isDesktopLayout]);

  const pageHeader = isChartFullscreen ? (
    <Page.Header headerShown={false} />
  ) : (
    <MarketDetailHeader showFavoriteButton={showFavoriteButton} />
  );

  return (
    <BtcMetadataProvider>
      <Page>
        {isRouteFocused ? pageHeader : null}

        <Page.Body
          pt={isChartFullscreen ? 0 : bodyPaddingTop}
          testID={MarketTestIDs.detailPage}
        >
          {shouldRenderContent ? (
            <MarketDetailResponsiveLayout
              isDesktopLayout={isDesktopLayout}
              isChartFullscreen={isChartFullscreen}
              onChartFullscreenChange={onChartFullscreenChange}
              showFavoriteButton={showFavoriteButton}
              disableTrade={disableTrade}
            />
          ) : null}
        </Page.Body>
      </Page>
    </BtcMetadataProvider>
  );
}

function useShouldRenderMarketDetailContent(isRouteFocused: boolean) {
  const isRouteFocusedRef = useRef(isRouteFocused);
  isRouteFocusedRef.current = isRouteFocused;
  const [wasPreloadedContentReleased, setWasPreloadedContentReleased] =
    useState(false);

  useEffect(() => {
    if (isRouteFocused) {
      setWasPreloadedContentReleased(false);
    }
  }, [isRouteFocused]);

  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }

    const handleMemoryPressure = () => {
      if (!isRouteFocusedRef.current) {
        setWasPreloadedContentReleased(true);
      }
    };
    appEventBus.on(
      EAppEventBusNames.MemoryPressureWarning,
      handleMemoryPressure,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.MemoryPressureWarning,
        handleMemoryPressure,
      );
    };
  }, []);

  return !wasPreloadedContentReleased;
}

function MarketDetailV2(
  props: IPageScreenProps<
    ITabMarketParamList,
    ETabMarketRoutes.MarketDetailV2 | ETabMarketRoutes.MarketNativeDetail
  >,
) {
  const { navigation } = props;
  const media = useMedia();
  const isRouteFocused = useIsFocused();
  const shouldRenderContent =
    useShouldRenderMarketDetailContent(isRouteFocused);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const isDesktopChartLayout = media.gtLg && !platformEnv.isNative;
  const effectiveIsChartFullscreen = isDesktopChartLayout && isChartFullscreen;
  const handleChartFullscreenChange = useCallback((isFullscreen: boolean) => {
    setIsChartFullscreen(isFullscreen);
  }, []);

  useEffect(() => {
    if (!isDesktopChartLayout && isChartFullscreen) {
      setIsChartFullscreen(false);
    }
  }, [isChartFullscreen, isDesktopChartLayout]);

  useLayoutEffect(() => {
    if (!platformEnv.isNativeIOS || !isRouteFocused) {
      return;
    }
    navigation.setOptions({
      gestureEnabled: true,
      fullScreenGestureEnabled: false,
      gestureResponseDistance: {
        start: 20,
      },
    });
  }, [isRouteFocused, navigation]);

  useFocusEffect(
    useCallback(() => {
      const shouldHideTabBar =
        effectiveIsChartFullscreen ||
        platformEnv.isNative ||
        (!platformEnv.isExtension && media.md);

      if (!shouldHideTabBar) {
        return;
      }

      appEventBus.emit(EAppEventBusNames.HideTabBar, true);

      return () => {
        appEventBus.emit(EAppEventBusNames.HideTabBar, false);
      };
    }, [effectiveIsChartFullscreen, media.md]),
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
        <MarketDetail
          {...props}
          isChartFullscreen={effectiveIsChartFullscreen}
          isRouteFocused={isRouteFocused}
          shouldRenderContent={shouldRenderContent}
          onChartFullscreenChange={handleChartFullscreenChange}
        />
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}

export { MarketDetailV2 };
