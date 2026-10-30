import type { ContextType } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import {
  useFocusEffect,
  useIsFocused,
  useNavigationState,
} from '@react-navigation/native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  HeaderScrollGestureContext,
  Page,
  rootNavigationRef,
  useIsModalPage,
  useMedia,
  usePreventRemove,
  useSplitSubView,
} from '@onekeyhq/components';
import { getRootRoutersLength } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSetSplitViewDetailFullscreen } from '@onekeyhq/kit/src/provider/Container/TableSplitViewContainer';
import {
  useTokenDetailActions,
  useTokenDetailPreviewAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import {
  createHideTabBarOwnerId,
  releaseHideTabBar,
  requestHideTabBar,
} from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';
import { parseTokenDetailPreviewParam } from '@onekeyhq/shared/src/utils/marketTokenPreviewRoute';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TradingViewEmbedGlobalPreload } from '../../../provider/TradingViewEmbedGlobalPreload';
import { useHeaderHeightCacheKey } from '../../Earn/hooks/useHeaderHeightCacheKey';
import { useNativeStackHeaderHeightEstimate } from '../../Earn/hooks/useNativeStackHeaderHeightEstimate';
import { useSettledHeaderHeight } from '../../Earn/hooks/useSettledHeaderHeight';
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
import { MarketSimpleChartRangeChangeProvider } from './hooks/MarketSimpleChartRangeChangeContext';
import { useSyncMarketCurrentTokenLiveData } from './hooks/useAutoRefreshTokenDetail';
import { useSwapStockBackTrip } from './hooks/useMarketDetailBackNavigation';
import { useMarketDetailChartMode } from './hooks/useMarketDetailChartMode';
import { useMarketDetailTabBarVisibility } from './hooks/useMarketDetailTabBarVisibility';
import { MarketDetailResponsiveLayout } from './layouts/MarketDetailResponsiveLayout';
import { shouldReplayFullscreenNavigationAction } from './utils/marketDetailFullscreenNavigation';
import { preloadMarketDetailV2BodyModules } from './utils/marketDetailPagePreload';
import {
  buildMarketStockDetailPreview,
  hasValidMarketDetailPreview,
} from './utils/marketDetailPreview';

import type { NavigationAction } from '@react-navigation/routers';

const MARKET_DETAIL_BACK_SWIPE_EDGE_WIDTH = 32;

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
  active,
  preview,
  stockTarget,
  retainedTokenTarget,
}: {
  active: boolean;
  preview?: IMarketTokenDetailPreview;
  retainedTokenTarget?: {
    tokenAddress: string;
    networkId: string;
    isNative: boolean;
  };
  stockTarget?: {
    tokenAddress: string;
    networkId: string;
    isNative?: boolean;
  };
}) {
  const tokenDetailActions = useTokenDetailActions();

  useLayoutEffect(() => {
    if (!active) {
      return;
    }
    if (stockTarget) {
      // Stock navigation may intentionally retain an existing detail/request
      // for the same variant. The action clears only when the identity changes.
      tokenDetailActions.current.prepareStockTokenDetail(stockTarget);
    } else if (retainedTokenTarget || preview) {
      tokenDetailActions.current.prepareTokenDetailPreview(
        preview,
        retainedTokenTarget,
      );
    } else if (!platformEnv.isNative) {
      tokenDetailActions.current.clearTokenDetail();
    }
  }, [active, preview, stockTarget, retainedTokenTarget, tokenDetailActions]);

  return null;
}

function MarketCurrentTokenLiveDataSync() {
  useSyncMarketCurrentTokenLiveData();
  return null;
}

function MarketDetail({
  isChartFullscreen,
  isTradingViewNative,
  onChartSwitch,
  onChartFullscreenChange,
  route,
  navigation,
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

  const {
    isStockRoute,
    selectedTokenVariant,
    isTokenVariantPending,
    stockPreview,
  } = useStockDetail();
  const [currentTokenDetailPreview] = useTokenDetailPreviewAtom();
  const isRouteFocused = useIsFocused();
  const media = useMedia();
  const isDesktopLayout = media.gtLg && !platformEnv.isNative;
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
  const usesRetainedMarketDetailRoutes = Boolean(
    platformEnv.isDesktop || platformEnv.isWeb,
  );
  const shouldOwnSharedMarketDetailState =
    !usesRetainedMarketDetailRoutes ||
    isRouteFocused ||
    shouldKeepEmbeddedSwapMounted;
  const routeNetwork = ('network' in params ? params.network : '') ?? '';
  const routeNetworkId =
    networkUtils.getNetworkIdFromShortCode({ shortCode: routeNetwork }) ||
    routeNetwork;
  const routeTokenAddress =
    ('tokenAddress' in params ? params.tokenAddress : '') ?? '';
  const routeIsNative = normalizeRouteBooleanParam(
    'isNative' in params ? params.isNative : false,
    false,
  );
  const networkId = selectedTokenVariant?.networkId ?? routeNetworkId;
  const tokenAddress =
    selectedTokenVariant?.contractAddress ?? routeTokenAddress;
  const isNativeBoolean = routeIsNative;
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
  const initialSection =
    'initialSection' in params ? params.initialSection : undefined;
  // One-shot: once shown, going back or switching stocks keeps the user's
  // own scroll position instead of jumping again.
  const handleInitialSectionShown = useCallback(() => {
    navigation.setParams({ initialSection: undefined });
  }, [navigation]);
  // Back from Swap's "view full data" returns to Swap (not in the tablet
  // split view, which keeps its own back behavior).
  const isTabletDetailView = useSplitSubView();
  useSwapStockBackTrip({
    navigation,
    params,
    routeKey: route.key,
    isFromSwapStock:
      !isTabletDetailView &&
      'from' in params &&
      params.from === EEnterWay.SwapStock,
    isChartFullscreen,
  });
  const routeTokenDetailPreview =
    'legacyTokenPreview' in params ? params.legacyTokenPreview : undefined;
  const tokenDetailPreview = useMemo(
    () => parseTokenDetailPreviewParam(routeTokenDetailPreview),
    [routeTokenDetailPreview],
  );
  // Stock navigation carries a separate stock preview instead of the token
  // preview atom. It already provides enough content for the native shell to
  // render while the stock variant and token detail requests settle.
  const hasValidInitialContentPreview = hasValidMarketDetailPreview({
    isStockRoute,
    stockPreview,
    previews: [tokenDetailPreview, currentTokenDetailPreview],
    tokenAddress,
    networkId,
  });
  const tokenDetailTarget = useMemo(
    () => ({ tokenAddress, networkId, isNative: isNativeBoolean }),
    [isNativeBoolean, networkId, tokenAddress],
  );

  // Track market entry analytics
  useMarketEnterAnalytics();

  // Refresh metadata, initialize the quote, and recover it when chart updates stop.
  // Use actualNetworkId (converted from shortcode if needed) for API calls
  const {
    marketAssetDetail,
    isMarketAssetDetailLoading,
    isInitialTokenDetailPending,
  } = useAutoRefreshTokenDetail({
    active: shouldOwnSharedMarketDetailState,
    resumeOnEffectReconnect: usesRetainedMarketDetailRoutes,
    tokenAddress,
    networkId,
    isNative: isNativeBoolean,
    skipMarketDataFetch,
    marketTokenId,
    marketVariantId,
    marketTokenCategory,
  });
  // Desktop/Web detail screens stay mounted in the navigation stack. Only the
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
  const usesTranslucentHeader = platformEnv.isNativeIOS26Plus && !isModalPage;
  // useHeaderHeight() starts from react-navigation's pre-iOS 26 estimate and
  // reports the Liquid Glass bar ~15pt taller a beat later, which dropped the
  // whole body mid-push. Reuse the height this device already settled on.
  const estimatedHeaderHeight = useNativeStackHeaderHeightEstimate();
  const headerHeightCacheKey = useHeaderHeightCacheKey();
  const inlineHeaderHeightRef = useRef(headerHeight);
  const preserveInlineHeader =
    platformEnv.isNativeIOS &&
    !platformEnv.isNativeIOSPad &&
    (isChartFullscreen || !isRouteFocused);
  if (!preserveInlineHeader) {
    inlineHeaderHeightRef.current = headerHeight;
  }
  // Keep the portrait header until the detail regains focus. The fullscreen
  // flag clears before UIKit has finished restoring the portrait geometry.
  const { paddingTop: settledHeaderHeight, isSettled: isHeaderHeightSettled } =
    useSettledHeaderHeight(inlineHeaderHeightRef.current, {
      enabled: usesTranslucentHeader,
      estimatedHeaderHeight,
      cacheKey: headerHeightCacheKey,
    });
  const bodyPaddingTop = usesTranslucentHeader ? settledHeaderHeight : 0;

  useEffect(() => {
    preloadMarketDetailV2BodyModules({
      layout: isDesktopLayout ? 'desktop' : 'mobile',
      includeHeavyModules: true,
      isStockRoute,
    });
  }, [isDesktopLayout, isStockRoute]);

  return (
    <BtcMetadataProvider>
      <MarketCurrentTokenLiveDataSync />
      <LegacyTokenPreviewInitializer
        active={shouldOwnSharedMarketDetailState}
        preview={tokenDetailPreview}
        stockTarget={isStockRoute ? tokenDetailTarget : undefined}
        retainedTokenTarget={tokenDetailTarget}
      />
      <Page>
        {isChartFullscreen && !platformEnv.isNative ? (
          <Page.Header headerShown={false} />
        ) : (
          <MarketDetailHeader
            showFavoriteButton={showFavoriteButton}
            marketTokenCategory={marketTokenCategory}
          />
        )}

        <Page.Body
          pt={isChartFullscreen && !platformEnv.isNative ? 0 : bodyPaddingTop}
          // Hidden only while the session's first header measurement settles.
          opacity={isHeaderHeightSettled ? 1 : 0}
          testID={MarketTestIDs.detailPage}
        >
          <MarketDetailResponsiveLayout
            active={shouldOwnSharedMarketDetailState}
            disablePerpsBanner={skipMarketDataFetch}
            isInitialContentPending={
              !hasValidInitialContentPreview &&
              (isTokenVariantPending || isInitialTokenDetailPending)
            }
            isDesktopLayout={isDesktopLayout}
            isChartFullscreen={isChartFullscreen}
            isTradingViewNative={isTradingViewNative}
            onChartSwitch={onChartSwitch}
            onChartFullscreenChange={onChartFullscreenChange}
            isNative={isNativeBoolean}
            networkId={networkId}
            tokenAddress={tokenAddress}
            isTokenDetailRequestPending={isInitialTokenDetailPending}
            marketTokenId={marketTokenId}
            marketAssetDetail={marketAssetDetail}
            isMarketAssetDetailLoading={isMarketAssetDetailLoading}
            marketTokenCategory={marketTokenCategory}
            showFavoriteButton={showFavoriteButton}
            disableTrade={shouldDisableTrade}
            initialSection={initialSection}
            onInitialSectionShown={handleInitialSectionShown}
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
  const { navigation } = props;
  const hasPreviousScreen = useNavigationState((state) => state.index > 0);
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
    quote:
      'stockPreviewQuote' in props.route.params
        ? props.route.params.stockPreviewQuote
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
  const media = useMedia();
  const setSplitViewDetailFullscreen = useSetSplitViewDetailFullscreen();
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const { isTradingViewNative, toggleChartMode } = useMarketDetailChartMode();
  const isDesktopChartLayout = media.gtLg && !platformEnv.isNative;
  // Mobile layouts can show the native chart while TradingView is preferred,
  // e.g. for a stock's share price, so they leave fullscreen themselves when
  // TradingView takes over instead of following the preference here.
  const supportsChartFullscreen = Boolean(
    isDesktopChartLayout || platformEnv.isNative || platformEnv.isWeb,
  );
  const effectiveIsChartFullscreen =
    supportsChartFullscreen && isChartFullscreen;
  const headerScrollGestureContext = useMemo<
    ContextType<typeof HeaderScrollGestureContext>
  >(
    () => ({
      gestures: [],
      excludeStartEdgeWidth:
        platformEnv.isNativeIOS &&
        hasPreviousScreen &&
        !effectiveIsChartFullscreen
          ? MARKET_DETAIL_BACK_SWIPE_EDGE_WIDTH
          : 0,
    }),
    [effectiveIsChartFullscreen, hasPreviousScreen],
  );
  const handleChartFullscreenChange = useCallback(
    (isFullscreen: boolean) => {
      setIsChartFullscreen(isFullscreen);
      setSplitViewDetailFullscreen(isFullscreen);
    },
    [setSplitViewDetailFullscreen],
  );
  const handleChartSwitch = useCallback(() => {
    if (!isDesktopChartLayout) {
      handleChartFullscreenChange(false);
    }
    toggleChartMode();
  }, [handleChartFullscreenChange, isDesktopChartLayout, toggleChartMode]);
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
      orientation: platformEnv.isNativeIOSPad ? 'default' : 'portrait',
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
      // Native stack checks the touch position after activation. Leave room
      // for the initial movement beyond the 32-point edge reserved by children.
      gestureResponseDistance: {
        end: MARKET_DETAIL_BACK_SWIPE_EDGE_WIDTH * 2,
      },
    });
  }, [navigation]);

  useLayoutEffect(() => {
    if (!platformEnv.isNativeIOS || !effectiveIsChartFullscreen) return;
    // Keep the underlying detail intact while its native fullscreen page opens.
    const ownerId = createHideTabBarOwnerId('market-chart-fullscreen');
    requestHideTabBar(ownerId);
    return () => releaseHideTabBar(ownerId);
  }, [effectiveIsChartFullscreen]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        const routes = rootNavigationRef.current?.getState().routes;
        if (
          platformEnv.isNativeIOS &&
          routes?.some(
            (route) => route.name === ERootRoutes.TradingViewNativeFullscreen,
          )
        ) {
          return;
        }
        handleChartFullscreenChange(false);
      };
    }, [handleChartFullscreenChange]),
  );

  useMarketDetailTabBarVisibility(
    effectiveIsChartFullscreen ||
      platformEnv.isNative ||
      (!platformEnv.isExtension && media.md),
  );

  return (
    <HeaderScrollGestureContext.Provider value={headerScrollGestureContext}>
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
          <StockDetailProvider
            stockId={stockId}
            initialStockPreview={stockPreview}
            initialNetworkId={initialNetworkId}
            initialTokenAddress={initialTokenAddress}
          >
            <MarketSimpleChartRangeChangeProvider>
              <MarketDetail
                {...props}
                isChartFullscreen={effectiveIsChartFullscreen}
                isTradingViewNative={isTradingViewNative}
                onChartSwitch={handleChartSwitch}
                onChartFullscreenChange={handleChartFullscreenChange}
              />
            </MarketSimpleChartRangeChangeProvider>
          </StockDetailProvider>
        </MarketWatchListProviderMirrorV2>
      </AccountSelectorProviderMirror>
    </HeaderScrollGestureContext.Provider>
  );
}

export { MarketDetailV2 };
