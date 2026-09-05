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
import {
  Page,
  useIsModalPage,
  useMedia,
  usePreventRemove,
} from '@onekeyhq/components';
import { getRootRoutersLength } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSetSplitViewDetailFullscreen } from '@onekeyhq/kit/src/provider/Container/TableSplitViewContainer';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
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
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TradingViewEmbedGlobalPreload } from '../../../provider/TradingViewEmbedGlobalPreload';
import { useMarketEnterAnalytics } from '../hooks';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';
import { MarketTestIDs } from '../testIDs';

import { MarketDetailHeader } from './components/MarketDetailHeader';
import {
  BtcMetadataProvider,
  StockDetailProvider,
  useAutoRefreshTokenDetail,
  useStockDetail,
} from './hooks';
import { MarketDetailResponsiveLayout } from './layouts/MarketDetailResponsiveLayout';
import { shouldReplayFullscreenNavigationAction } from './utils/marketDetailFullscreenNavigation';
import { preloadMarketDetailV2BodyModules } from './utils/marketDetailPagePreload';
import { buildMarketStockDetailPreview } from './utils/marketDetailPreview';

import type { NavigationAction } from '@react-navigation/routers';

function normalizeRouteBooleanParam(
  value: boolean | string | undefined,
  defaultValue: boolean,
) {
  if (typeof value === 'string') {
    return value === 'true';
  }
  return value ?? defaultValue;
}

function LegacyTokenPreviewInitializer({
  preview,
}: {
  preview?: IMarketTokenDetailPreview;
}) {
  const tokenDetailActions = useTokenDetailActions();

  useLayoutEffect(() => {
    if (preview) {
      tokenDetailActions.current.prepareTokenDetailPreview(preview);
    }
  }, [preview, tokenDetailActions]);

  return null;
}

function MarketDetail({
  isChartFullscreen,
  isTradingViewNative,
  onChartSwitch,
  onChartFullscreenChange,
  route,
}: IPageScreenProps<
  ITabMarketParamList,
  | ETabMarketRoutes.MarketDetailV2
  | ETabMarketRoutes.MarketStockDetail
  | ETabMarketRoutes.MarketNativeDetail
> & {
  isChartFullscreen: boolean;
  isTradingViewNative: boolean;
  onChartSwitch: () => void;
  onChartFullscreenChange: (isFullscreen: boolean) => void;
}) {
  const params = route.params as
    | ITabMarketParamList[ETabMarketRoutes.MarketDetailV2]
    | ITabMarketParamList[ETabMarketRoutes.MarketStockDetail]
    | ITabMarketParamList[ETabMarketRoutes.MarketNativeDetail];

  const { isStockRoute, selectedTokenVariant } = useStockDetail();
  const network =
    selectedTokenVariant?.networkId ??
    ('network' in params ? params.network : '') ??
    '';
  const isNative = 'isNative' in params ? params.isNative : false;
  const disableTrade = params.disableTrade;
  const marketTokenId =
    'marketTokenId' in params ? params.marketTokenId : undefined;
  const marketVariantId =
    'marketVariantId' in params ? params.marketVariantId : undefined;
  const marketTokenCategory =
    'marketTokenCategory' in params ? params.marketTokenCategory : undefined;
  const skipMarketDataFetch = normalizeRouteBooleanParam(
    'skipMarketDataFetch' in params ? params.skipMarketDataFetch : undefined,
    false,
  );
  const showFavoriteButton = normalizeRouteBooleanParam(
    params.showFavoriteButton,
    true,
  );
  // For MarketNativeDetail route, tokenAddress is undefined, use empty string
  const tokenAddress =
    selectedTokenVariant?.contractAddress ??
    ('tokenAddress' in params ? params.tokenAddress : '') ??
    '';

  // Convert shortcode back to full networkId if needed
  // network is a shortcode like 'bsc', convert it to 'evm--56'
  const networkId =
    networkUtils.getNetworkIdFromShortCode({ shortCode: network }) || network;
  const isNativeBoolean = normalizeRouteBooleanParam(isNative, false);

  // Track market entry analytics
  useMarketEnterAnalytics();

  // Start auto-refresh for token details every 5 seconds
  // Use actualNetworkId (converted from shortcode if needed) for API calls
  const { marketAssetDetail, isMarketAssetDetailLoading } =
    useAutoRefreshTokenDetail({
      tokenAddress,
      networkId,
      isNative: isNativeBoolean,
      skipMarketDataFetch,
      marketTokenId,
      marketVariantId,
      marketTokenCategory,
    });

  const media = useMedia();
  const isDesktopLayout = media.gtLg && !platformEnv.isNative;
  const isRouteFocused = useIsFocused();
  const rootRoutersLength = getRootRoutersLength();
  const ownsEmbeddedSwapRef = useRef(isRouteFocused);
  const focusedRootRoutersLengthRef = useRef(rootRoutersLength);
  if (isRouteFocused) {
    ownsEmbeddedSwapRef.current = true;
    focusedRootRoutersLengthRef.current = rootRoutersLength;
  } else if (rootRoutersLength <= focusedRootRoutersLengthRef.current) {
    ownsEmbeddedSwapRef.current = false;
  }
  const shouldKeepEmbeddedSwapMounted =
    !isRouteFocused &&
    rootRoutersLength > focusedRootRoutersLengthRef.current &&
    ownsEmbeddedSwapRef.current;
  // Desktop detail screens stay mounted in the navigation stack. Only the
  // focused screen may own the shared Swap state and page footer. Keep that
  // owner mounted while a child modal is open so quote listeners remain
  // attached to the same Swap instance.
  const shouldDisableTrade =
    disableTrade ||
    (isDesktopLayout && !isRouteFocused && !shouldKeepEmbeddedSwapMounted);
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
      isStockRoute,
    });
  }, [isDesktopLayout, isStockRoute]);

  return (
    <BtcMetadataProvider>
      <Page>
        {isChartFullscreen ? (
          <Page.Header headerShown={false} />
        ) : (
          <MarketDetailHeader
            chartMode={isTradingViewNative ? 'native' : 'tradingView'}
            showFavoriteButton={showFavoriteButton}
          />
        )}

        <Page.Body
          pt={isChartFullscreen ? 0 : bodyPaddingTop}
          testID={MarketTestIDs.detailPage}
        >
          <MarketDetailResponsiveLayout
            isDesktopLayout={isDesktopLayout}
            isChartFullscreen={isChartFullscreen}
            isTradingViewNative={isTradingViewNative}
            onChartSwitch={onChartSwitch}
            onChartFullscreenChange={onChartFullscreenChange}
            isNative={isNativeBoolean}
            networkId={networkId}
            tokenAddress={tokenAddress}
            marketTokenId={marketTokenId}
            marketAssetDetail={marketAssetDetail}
            isMarketAssetDetailLoading={isMarketAssetDetailLoading}
            marketTokenCategory={marketTokenCategory}
            showFavoriteButton={showFavoriteButton}
            disableTrade={shouldDisableTrade}
          />
        </Page.Body>
      </Page>
    </BtcMetadataProvider>
  );
}

function MarketDetailV2(
  props: IPageScreenProps<
    ITabMarketParamList,
    | ETabMarketRoutes.MarketDetailV2
    | ETabMarketRoutes.MarketStockDetail
    | ETabMarketRoutes.MarketNativeDetail
  >,
) {
  const { navigation, route } = props;
  const stockId =
    'stockId' in props.route.params ? props.route.params.stockId : undefined;
  const stockPreview = buildMarketStockDetailPreview({
    stockId,
    symbol:
      'stockPreviewSymbol' in props.route.params
        ? props.route.params.stockPreviewSymbol
        : undefined,
    name:
      'stockPreviewName' in props.route.params
        ? props.route.params.stockPreviewName
        : undefined,
    logoUrl:
      'stockPreviewLogoUrl' in props.route.params
        ? props.route.params.stockPreviewLogoUrl
        : undefined,
  });
  const initialTokenAddress =
    'tokenAddress' in props.route.params
      ? props.route.params.tokenAddress
      : undefined;
  const initialNetwork =
    'network' in props.route.params ? props.route.params.network : undefined;
  const initialNetworkId = initialNetwork
    ? networkUtils.getNetworkIdFromShortCode({ shortCode: initialNetwork }) ||
      initialNetwork
    : undefined;
  const legacyTokenPreview =
    'legacyTokenPreview' in props.route.params
      ? props.route.params.legacyTokenPreview
      : undefined;
  const media = useMedia();
  const setSplitViewDetailFullscreen = useSetSplitViewDetailFullscreen();
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [isTradingViewNative, setIsTradingViewNative] = useState(
    () => route.params.chartMode !== 'tradingView',
  );
  const isDesktopChartLayout = media.gtLg && !platformEnv.isNative;
  const supportsChartFullscreen = Boolean(
    isDesktopChartLayout || (platformEnv.isNative && isTradingViewNative),
  );
  const effectiveIsChartFullscreen =
    supportsChartFullscreen && isChartFullscreen;
  const handleChartFullscreenChange = useCallback(
    (isFullscreen: boolean) => {
      setIsChartFullscreen(isFullscreen);
      setSplitViewDetailFullscreen(isFullscreen);
    },
    [setSplitViewDetailFullscreen],
  );
  const handleChartSwitch = useCallback(() => {
    handleChartFullscreenChange(false);
    setIsTradingViewNative((currentValue) => !currentValue);
  }, [handleChartFullscreenChange]);
  const handleFullscreenRemove = useCallback(
    ({ data }: { data: { action: NavigationAction } }) => {
      handleChartFullscreenChange(false);
      if (shouldReplayFullscreenNavigationAction(data.action)) {
        navigation.dispatch(data.action);
      }
    },
    [handleChartFullscreenChange, navigation],
  );

  usePreventRemove(effectiveIsChartFullscreen, handleFullscreenRemove);

  useLayoutEffect(() => {
    setSplitViewDetailFullscreen(effectiveIsChartFullscreen);
    return () => {
      setSplitViewDetailFullscreen(false);
    };
  }, [effectiveIsChartFullscreen, setSplitViewDetailFullscreen]);

  useEffect(() => {
    if (!supportsChartFullscreen && isChartFullscreen) {
      handleChartFullscreenChange(false);
    }
  }, [handleChartFullscreenChange, isChartFullscreen, supportsChartFullscreen]);

  useLayoutEffect(() => {
    if (!platformEnv.isNativeIOS) {
      return;
    }
    navigation.setOptions({
      gestureEnabled: true,
      fullScreenGestureEnabled: false,
      gestureResponseDistance: {
        start: 20,
      },
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        handleChartFullscreenChange(false);
      };
    }, [handleChartFullscreenChange]),
  );

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
    <>
      <TradingViewEmbedGlobalPreload />
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
          <LegacyTokenPreviewInitializer preview={legacyTokenPreview} />
          <StockDetailProvider
            stockId={stockId}
            initialStockPreview={stockPreview}
            initialNetworkId={initialNetworkId}
            initialTokenAddress={initialTokenAddress}
          >
            <MarketDetail
              {...props}
              isChartFullscreen={effectiveIsChartFullscreen}
              isTradingViewNative={isTradingViewNative}
              onChartSwitch={handleChartSwitch}
              onChartFullscreenChange={handleChartFullscreenChange}
            />
          </StockDetailProvider>
        </MarketWatchListProviderMirrorV2>
      </AccountSelectorProviderMirror>
    </>
  );
}

export { MarketDetailV2 };
