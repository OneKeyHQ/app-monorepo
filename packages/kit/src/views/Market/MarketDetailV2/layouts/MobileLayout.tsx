import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import {
  type GestureResponderEvent,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { IDialogInstance, IScrollViewRef } from '@onekeyhq/components';
import {
  EInPageDialogType,
  HeaderScrollGestureWrapper,
  ScrollView,
  Spinner,
  Stack,
  Tabs,
  YStack,
  useInPageDialog,
  useIsOverlayPage,
  usePageWidth,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TradingViewNative } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/chartConstants';
import { getTradingViewNativeFullscreenLayout } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/utils/fullscreenLayout';
import { shouldReserveTradingViewNativeIndicatorQuickBar } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type { ITradingViewNativeIndicatorQuickBarState } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import {
  TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT,
  TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewV2ChartControls';
import { fetchMarketAssetKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData';
import type { IMarketKLineDataFallback } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';
import { useMobileTabTouchScrollBridge } from '@onekeyhq/kit/src/hooks/useMobileTabTouchScrollBridge';
import {
  EJotaiContextStoreNames,
  useMarketTradingViewSubIndicatorCountPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTradingViewStorageNamespace } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { MarketWatchListProviderMirrorV2 } from '../../MarketWatchListProviderMirrorV2';
import { MarketTestIDs } from '../../testIDs';
import { InformationPanel } from '../components/InformationPanel/InformationPanel';
import { usePortfolioData } from '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData';
import { useNetworkAccount } from '../components/InformationTabs/hooks/useNetworkAccount';
import { MobileInformationTabs } from '../components/InformationTabs/layout/MobileInformationTabs';
import { LazyMobileMarketTradingView } from '../components/MarketTradingView/LazyMarketTradingView';
import { PerpetualTradingBanner } from '../components/PerpetualTradingBanner/PerpetualTradingBanner';
import { useStockDetail } from '../hooks/StockDetailContext';
import {
  useMarketTradingViewParams,
  useTokenDetail,
} from '../hooks/useTokenDetail';
import { useTradingViewSubIndicatorCount } from '../hooks/useTradingViewSubIndicatorCount';
import { getMarketDetailTradingViewNativeSource } from '../utils/getMarketDetailTradingViewNativeSource';
import {
  getMarketTradingViewSubIndicatorCount,
  normalizeMarketTradingViewSubIndicatorCountPersist,
  setMarketTradingViewSubIndicatorCount,
} from '../utils/marketTradingViewSubIndicatorCount';

import type { SwapPanel } from '../components/SwapPanel/SwapPanel';
import type { SwapPanelWrap } from '../components/SwapPanel/SwapPanelWrap';

type ISwapPanelProps = ComponentProps<typeof SwapPanel>;
type ISwapPanelWrapProps = ComponentProps<typeof SwapPanelWrap>;
type ITokenActivityOverviewProps = {
  pl?: string;
  pr?: string;
  px?: string;
};

function ModuleLoadingFallback({ minHeight }: { minHeight?: number }) {
  return (
    <Stack
      minHeight={minHeight}
      flex={1}
      alignItems="center"
      justifyContent="center"
    >
      <Spinner size="large" />
    </Stack>
  );
}

const swapPanelLoadingFallback = <ModuleLoadingFallback minHeight={96} />;
const overviewLoadingFallback = <ModuleLoadingFallback minHeight={240} />;

const LazySwapPanel = LazyLoad<ISwapPanelProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-swap-panel" */ '../components/SwapPanel/SwapPanel'
    ).then(({ SwapPanel }) => ({
      default: SwapPanel,
    })),
  undefined,
  swapPanelLoadingFallback,
);

const LazySwapPanelWrap = LazyLoad<ISwapPanelWrapProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-swap-panel-wrap" */ '../components/SwapPanel/SwapPanelWrap'
    ).then(({ SwapPanelWrap }) => ({
      default: SwapPanelWrap,
    })),
  undefined,
  swapPanelLoadingFallback,
);

const LazyTokenActivityOverview = LazyLoad<ITokenActivityOverviewProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-token-activity-overview" */ '../components/TokenActivityOverview/TokenActivityOverview'
    ).then(({ TokenActivityOverview }) => ({
      default: TokenActivityOverview,
    })),
  undefined,
  overviewLoadingFallback,
);

const LazyTokenOverview = LazyLoad<Record<string, never>>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-token-overview" */ '../components/TokenOverview/TokenOverview'
    ).then(({ TokenOverview }) => ({
      default: TokenOverview,
    })),
  undefined,
  overviewLoadingFallback,
);

const LazyStockTokenOverview = LazyLoad<Record<string, never>>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-stock-token-overview" */ '../components/TokenOverview/StockTokenOverview'
    ).then(({ StockTokenOverview }) => ({
      default: StockTokenOverview,
    })),
  undefined,
  overviewLoadingFallback,
);

const MARKET_DETAIL_TRADING_VIEW_DEFAULT_SUB_INDICATOR_COUNT = 1;
const MARKET_DETAIL_MOBILE_TRADING_VIEW_MAX_SELECTABLE_SUB_INDICATOR_COUNT = 4;
const MARKET_DETAIL_MOBILE_TRADING_VIEW_BASE_HEIGHT_RATIO = 0.58;
const MARKET_DETAIL_INDICATOR_QUICK_BAR_VERTICAL_SCROLL_SCALE = 1.2;
const MARKET_DETAIL_INITIAL_SUB_INDICATOR_STABILIZATION_MS = 500;

function MobileIndicatorQuickBar({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled: boolean;
}) {
  const handleTouchScroll = useMobileTabTouchScrollBridge();
  const handleIndicatorQuickBarTouchScroll = useCallback(
    (deltaY: number) => {
      handleTouchScroll(
        deltaY * MARKET_DETAIL_INDICATOR_QUICK_BAR_VERTICAL_SCROLL_SCALE,
      );
    },
    [handleTouchScroll],
  );

  if (isValidElement<{ onTouchScroll?: (deltaY: number) => void }>(children)) {
    return cloneElement(children, {
      onTouchScroll: disabled ? undefined : handleIndicatorQuickBarTouchScroll,
    });
  }

  return children;
}

function MobileMarketTradingView({
  tokenAddress,
  networkId,
  tokenSymbol,
  decimal,
  dataSource,
  storageNamespace,
  pageWidth,
  onChartSwitch,
  onNativeIndicatorQuickBarChange,
  onNativeSubIndicatorCountChange,
  onIndicatorsDialogOpenChange,
  onInteractionOverlayOpenChange,
  kLineDataFallback,
  primaryKLineDataUnavailable,
}: {
  tokenAddress: string;
  networkId: string;
  tokenSymbol: string;
  decimal: number;
  dataSource: 'websocket' | 'polling';
  storageNamespace: IMarketTradingViewStorageNamespace;
  pageWidth?: number;
  onChartSwitch: () => void;
  onNativeIndicatorQuickBarChange: (
    state: ITradingViewNativeIndicatorQuickBarState,
  ) => void;
  onNativeSubIndicatorCountChange: (
    count: number | null,
    options?: { layoutRestored?: boolean },
  ) => void;
  onIndicatorsDialogOpenChange: (isOpen: boolean) => void;
  onInteractionOverlayOpenChange: (isOpen: boolean) => void;
  kLineDataFallback?: IMarketKLineDataFallback;
  primaryKLineDataUnavailable?: boolean;
}) {
  useEffect(() => {
    return () => {
      onIndicatorsDialogOpenChange(false);
      onInteractionOverlayOpenChange(false);
    };
  }, [onIndicatorsDialogOpenChange, onInteractionOverlayOpenChange]);

  return (
    <LazyMobileMarketTradingView
      tokenAddress={tokenAddress}
      networkId={networkId}
      tokenSymbol={tokenSymbol}
      decimal={decimal}
      dataSource={dataSource}
      storageNamespace={storageNamespace}
      pageWidth={pageWidth}
      nativeControlsLayoutMode="mobile"
      onChartSwitch={onChartSwitch}
      onNativeIndicatorQuickBarChange={onNativeIndicatorQuickBarChange}
      onNativeSubIndicatorCountChange={onNativeSubIndicatorCountChange}
      maxSelectableSubIndicatorCount={
        MARKET_DETAIL_MOBILE_TRADING_VIEW_MAX_SELECTABLE_SUB_INDICATOR_COUNT
      }
      onIndicatorsDialogOpenChange={onIndicatorsDialogOpenChange}
      onInteractionOverlayOpenChange={onInteractionOverlayOpenChange}
      kLineDataFallback={kLineDataFallback}
      primaryKLineDataUnavailable={primaryKLineDataUnavailable}
    />
  );
}

export interface IMobileLayoutProps {
  disableTrade?: boolean;
  isChartFullscreen: boolean;
  isTradingViewNative: boolean;
  onChartFullscreenChange: (isFullscreen: boolean) => void;
  onChartSwitch: () => void;
  isNative?: boolean;
  networkId?: string;
  tokenAddress?: string;
  marketTokenId?: string;
  marketTokenCategory?: string;
}

export function MobileLayout({
  disableTrade,
  isChartFullscreen,
  isTradingViewNative,
  onChartFullscreenChange,
  onChartSwitch,
  isNative: routeIsNative = false,
  networkId: routeNetworkId = '',
  tokenAddress: routeTokenAddress = '',
  marketTokenId,
  marketTokenCategory,
}: IMobileLayoutProps) {
  const {
    tokenAddress: storeTokenAddress,
    networkId: storeNetworkId,
    tokenDetail,
    tokenDetailPreview,
    isNative: storeIsNative,
    websocketConfig,
    perpsInfo,
    isStockToken,
  } = useTokenDetail();
  const { selectedTokenVariant } = useStockDetail();
  const networkId =
    selectedTokenVariant?.networkId || storeNetworkId || routeNetworkId;
  const tokenAddress =
    selectedTokenVariant?.contractAddress ||
    (storeNetworkId ? storeTokenAddress : routeTokenAddress);
  const isNative =
    networkId === routeNetworkId && tokenAddress === routeTokenAddress
      ? routeIsNative
      : storeIsNative;
  const tokenSymbol = tokenDetail?.symbol;
  const marketTradingViewParams = useMarketTradingViewParams({
    tokenAddress,
    networkId,
    tokenDetail,
    tokenDetailPreview,
    isNative,
    websocketConfig,
  });
  let marketTradingViewKey = 'v2';
  if (isTradingViewNative) {
    marketTradingViewKey = [
      'native',
      marketTokenId ?? '',
      networkId,
      tokenAddress,
    ].join(':');
  } else if (marketTradingViewParams) {
    marketTradingViewKey = [
      'v2',
      marketTokenId ?? '',
      marketTradingViewParams.networkId,
      marketTradingViewParams.tokenAddress,
      marketTradingViewParams.tokenSymbol,
    ].join(':');
  }
  const [
    marketTradingViewSubIndicatorCountPersist,
    setMarketTradingViewSubIndicatorCountPersist,
  ] = useMarketTradingViewSubIndicatorCountPersistAtom();
  const hasAttemptedMarketTradingViewPersistNormalizationRef = useRef(false);
  useEffect(() => {
    if (hasAttemptedMarketTradingViewPersistNormalizationRef.current) {
      return;
    }
    if (
      normalizeMarketTradingViewSubIndicatorCountPersist(
        marketTradingViewSubIndicatorCountPersist,
      ) === marketTradingViewSubIndicatorCountPersist
    ) {
      return;
    }
    hasAttemptedMarketTradingViewPersistNormalizationRef.current = true;
    setMarketTradingViewSubIndicatorCountPersist((prev) =>
      normalizeMarketTradingViewSubIndicatorCountPersist(prev),
    );
  }, [
    marketTradingViewSubIndicatorCountPersist,
    setMarketTradingViewSubIndicatorCountPersist,
  ]);
  const marketTradingViewStorageNamespace: IMarketTradingViewStorageNamespace =
    'market';
  const persistedWebViewSubIndicatorCount = platformEnv.isNative
    ? getMarketTradingViewSubIndicatorCount({
        persistState: marketTradingViewSubIndicatorCountPersist,
        storageNamespace: marketTradingViewStorageNamespace,
      })
    : undefined;
  let initialSubIndicatorCount =
    MARKET_DETAIL_TRADING_VIEW_DEFAULT_SUB_INDICATOR_COUNT;
  if (isTradingViewNative) {
    initialSubIndicatorCount = 0;
  } else if (
    typeof persistedWebViewSubIndicatorCount === 'number' &&
    Number.isFinite(persistedWebViewSubIndicatorCount)
  ) {
    initialSubIndicatorCount = persistedWebViewSubIndicatorCount;
  }
  const intl = useIntl();
  const isBTCMainnet = networkUtils.isBTCMainnet(networkId);
  const nativeHyperliquidCoin =
    isBTCMainnet && isNative ? (perpsInfo?.hlTicker ?? '') : '';
  const marketAssetId =
    marketTokenCategory === MARKET_TOP_COINS_CATEGORY_ID
      ? marketTokenId?.trim()
      : undefined;
  const tradingViewNativeSource = useMemo(
    () =>
      getMarketDetailTradingViewNativeSource({
        hyperliquidCoin: nativeHyperliquidCoin,
        isNative,
        marketAssetId,
        marketDataSource: marketTradingViewParams?.dataSource,
        networkId,
        symbol: tokenSymbol ?? '',
        tokenAddress,
      }),
    [
      marketAssetId,
      marketTradingViewParams?.dataSource,
      nativeHyperliquidCoin,
      isNative,
      networkId,
      tokenAddress,
      tokenSymbol,
    ],
  );
  const assetKLineDataFallback = useMemo<IMarketKLineDataFallback | undefined>(
    () =>
      marketAssetId
        ? ({ interval, timeFrom, timeTo }) =>
            fetchMarketAssetKLineData({
              assetId: marketAssetId,
              interval,
              timeFrom,
              timeTo,
            })
        : undefined,
    [marketAssetId],
  );

  const { accountAddress, xpub } = useNetworkAccount(networkId);

  const { portfolioData, isRefreshing } = usePortfolioData({
    tokenAddress,
    networkId,
    accountAddress,
    xpub,
  });
  const tabNames = useMemo(
    () => [
      intl.formatMessage({ id: ETranslations.market_chart }),
      intl.formatMessage({ id: ETranslations.global_overview }),
    ],
    [intl],
  );
  const isModalPage = useIsOverlayPage();
  const inPageDialog = useInPageDialog(
    isModalPage ? EInPageDialogType.inModalPage : EInPageDialogType.inTabPages,
  );
  const dialogRef = useRef<IDialogInstance>(null);

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const { top, right, bottom, left } = useSafeAreaInsets();
  const fullscreenLayout = useMemo(
    () =>
      getTradingViewNativeFullscreenLayout({
        height:
          isChartFullscreen && containerHeight > 0
            ? containerHeight
            : windowHeight,
        insets: { top, right, bottom, left },
        width:
          isChartFullscreen && containerWidth > 0
            ? containerWidth
            : windowWidth,
      }),
    [
      bottom,
      containerHeight,
      containerWidth,
      isChartFullscreen,
      left,
      right,
      top,
      windowHeight,
      windowWidth,
    ],
  );

  // Skip top inset for iOS modal pages, as modal has its own safe area handling
  const isIOSModalPage = platformEnv.isNativeIOS && isModalPage;

  const height = useMemo(() => {
    if (platformEnv.isNative) {
      const topInset = isIOSModalPage ? 0 : top;
      return windowHeight - topInset - bottom - 158;
    }
    return 'calc(100vh - 96px - 74px)';
  }, [bottom, top, isIOSModalPage, windowHeight]);

  const width = usePageWidth();
  const effectivePageWidth = useMemo(() => {
    if (containerWidth > 0) {
      return containerWidth;
    }
    if (typeof width === 'number' && width > 0) {
      return width;
    }
    return windowWidth;
  }, [containerWidth, width, windowWidth]);
  const layoutHeight = isChartFullscreen
    ? fullscreenLayout.contentHeight
    : height;
  const layoutPageWidth = isChartFullscreen
    ? fullscreenLayout.contentWidth
    : effectivePageWidth;

  const scrollViewRef = useRef<IScrollViewRef>(null);
  const focusedTab = useSharedValue(tabNames[0]);
  const [
    isTradingViewIndicatorsDialogOpen,
    setIsTradingViewIndicatorsDialogOpen,
  ] = useState(false);
  const [
    isTradingViewInteractionOverlayOpen,
    setIsTradingViewInteractionOverlayOpen,
  ] = useState(false);
  const [nativeIndicatorQuickBarState, setNativeIndicatorQuickBarState] =
    useState<ITradingViewNativeIndicatorQuickBarState>({
      status: 'loading',
      quickBar: null,
    });
  const { quickBar: nativeIndicatorQuickBar } = nativeIndicatorQuickBarState;
  const persistWebViewSubIndicatorCount = useCallback(
    (count: number) => {
      if (!platformEnv.isNative || isTradingViewNative) {
        return;
      }
      setMarketTradingViewSubIndicatorCountPersist((prev) =>
        setMarketTradingViewSubIndicatorCount({
          count,
          persistState: prev,
          storageNamespace: marketTradingViewStorageNamespace,
        }),
      );
    },
    [
      marketTradingViewStorageNamespace,
      setMarketTradingViewSubIndicatorCountPersist,
      isTradingViewNative,
    ],
  );
  const [tradingViewSubIndicatorCount, handleNativeSubIndicatorCountChange] =
    useTradingViewSubIndicatorCount({
      chartKey: `${marketTradingViewKey}:${marketTradingViewStorageNamespace}`,
      initialCount: initialSubIndicatorCount,
      stabilizeInitialCount: Boolean(
        platformEnv.isNative && !isTradingViewNative,
      ),
      stabilizationDelayMs:
        MARKET_DETAIL_INITIAL_SUB_INDICATOR_STABILIZATION_MS,
      onCountSettled: persistWebViewSubIndicatorCount,
    });
  const isTradingViewScrollLocked =
    isTradingViewIndicatorsDialogOpen || isTradingViewInteractionOverlayOpen;
  const secondTabTouchStartRef = useRef<{
    pageX: number;
    pageY: number;
  } | null>(null);

  const handleTabChange = useCallback(
    (tabName: string) => {
      focusedTab.value = tabName;
      scrollViewRef.current?.scrollTo({
        x: layoutPageWidth * tabNames.indexOf(tabName),
        animated: true,
      });
    },
    [focusedTab, layoutPageWidth, tabNames],
  );

  const handleContainerLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number; width: number } } }) => {
      const { height: nextLayoutHeight, width: nextLayoutWidth } =
        event.nativeEvent.layout;
      const nextHeight = Math.round(nextLayoutHeight);
      const nextWidth = Math.round(nextLayoutWidth);
      if (nextHeight > 0) {
        setContainerHeight((prevHeight) =>
          prevHeight === nextHeight ? prevHeight : nextHeight,
        );
      }
      if (nextWidth > 0) {
        setContainerWidth((prevWidth) =>
          prevWidth === nextWidth ? prevWidth : nextWidth,
        );
      }
    },
    [],
  );

  useEffect(() => {
    const activeTabIndex = tabNames.indexOf(focusedTab.value);
    if (
      activeTabIndex < 0 ||
      typeof layoutPageWidth !== 'number' ||
      layoutPageWidth <= 0
    ) {
      return;
    }

    // Keep horizontal pages aligned after fold/unfold or split-width changes.
    const alignTimer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: layoutPageWidth * activeTabIndex,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(alignTimer);
  }, [focusedTab, layoutPageWidth, tabNames]);

  useEffect(() => {
    setIsTradingViewIndicatorsDialogOpen(false);
    setIsTradingViewInteractionOverlayOpen(false);
    if (isTradingViewNative) {
      setNativeIndicatorQuickBarState({
        status: 'loading',
        quickBar: null,
      });
    }
  }, [isTradingViewNative, networkId, tokenAddress, tokenSymbol]);

  const handleIndicatorsDialogOpenChange = useCallback((isOpen: boolean) => {
    setIsTradingViewIndicatorsDialogOpen(isOpen);
  }, []);
  const handleInteractionOverlayOpenChange = useCallback((isOpen: boolean) => {
    setIsTradingViewInteractionOverlayOpen(isOpen);
  }, []);
  const handleNativeIndicatorQuickBarChange = useCallback(
    (state: ITradingViewNativeIndicatorQuickBarState) => {
      setNativeIndicatorQuickBarState(state);
    },
    [],
  );
  const handleHeaderHorizontalSwipe = useCallback(
    (direction: 'left' | 'right') => {
      const currentIndex = tabNames.indexOf(focusedTab.value);
      if (currentIndex < 0) {
        return;
      }
      const offset = direction === 'left' ? 1 : -1;
      const nextIndex = Math.min(
        tabNames.length - 1,
        Math.max(0, currentIndex + offset),
      );
      if (nextIndex === currentIndex) {
        return;
      }
      handleTabChange(tabNames[nextIndex]);
    },
    [focusedTab, handleTabChange, tabNames],
  );

  const tradingViewHeight = useMemo(() => {
    if (platformEnv.isNative) {
      const baseChartHeight = Math.round(
        Number(height) * MARKET_DETAIL_MOBILE_TRADING_VIEW_BASE_HEIGHT_RATIO,
      );
      const fixedMainChartHeight =
        baseChartHeight +
        TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT +
        TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT -
        TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT;
      return (
        fixedMainChartHeight +
        tradingViewSubIndicatorCount *
          TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT
      );
    }
    return 'calc(100vh - 96px - 74px - 250px)';
  }, [height, tradingViewSubIndicatorCount]);

  const shouldReserveNativeIndicatorQuickBar =
    platformEnv.isNative &&
    !isTradingViewNative &&
    shouldReserveTradingViewNativeIndicatorQuickBar(
      nativeIndicatorQuickBarState,
    );

  const tradingViewChartHeight = useMemo(() => {
    if (isChartFullscreen) {
      return Math.max(
        fullscreenLayout.contentHeight -
          (shouldReserveNativeIndicatorQuickBar
            ? TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT
            : 0),
        0,
      );
    }
    if (
      typeof tradingViewHeight === 'number' &&
      shouldReserveNativeIndicatorQuickBar
    ) {
      return Math.max(
        0,
        tradingViewHeight - TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT,
      );
    }

    return tradingViewHeight;
  }, [
    fullscreenLayout.contentHeight,
    isChartFullscreen,
    shouldReserveNativeIndicatorQuickBar,
    tradingViewHeight,
  ]);

  const handleSecondTabTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      secondTabTouchStartRef.current = { pageX, pageY };
    },
    [],
  );

  const handleSecondTabTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      const start = secondTabTouchStartRef.current;
      secondTabTouchStartRef.current = null;
      if (!start) {
        return;
      }

      const { pageX, pageY } = event.nativeEvent;
      const deltaX = pageX - start.pageX;
      const deltaY = pageY - start.pageY;

      if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      handleHeaderHorizontalSwipe(deltaX < 0 ? 'left' : 'right');
    },
    [handleHeaderHorizontalSwipe],
  );

  const nativeIndicatorQuickBarContent = useMemo(() => {
    if (!shouldReserveNativeIndicatorQuickBar) {
      return nativeIndicatorQuickBar;
    }

    return (
      <Stack
        h={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
        bg="$bgApp"
        overflow="hidden"
      >
        {nativeIndicatorQuickBar ? (
          <MobileIndicatorQuickBar disabled={isTradingViewScrollLocked}>
            {nativeIndicatorQuickBar}
          </MobileIndicatorQuickBar>
        ) : null}
      </Stack>
    );
  }, [
    isTradingViewScrollLocked,
    nativeIndicatorQuickBar,
    shouldReserveNativeIndicatorQuickBar,
  ]);

  const informationHeader = useMemo(() => {
    const chartAreaHorizontalSwipeHandler =
      isTradingViewNative || platformEnv.isNativeAndroid
        ? undefined
        : handleHeaderHorizontalSwipe;
    const chartAreaPanFailOffsetX: [number, number] =
      isTradingViewNative || platformEnv.isNativeAndroid
        ? [-12, 12]
        : [-40, 40];
    const chartAreaExcludeRightEdgeRatio = platformEnv.isNativeAndroid
      ? 0.16
      : 0.1;

    return (
      <YStack bg="$bgApp" pointerEvents="box-none">
        <HeaderScrollGestureWrapper
          disabled={isChartFullscreen}
          panActiveOffsetY={[-4, 4]}
          scrollScale={1}
          onHorizontalSwipe={handleHeaderHorizontalSwipe}
          horizontalSwipeThreshold={36}
        >
          <YStack display={isChartFullscreen ? 'none' : undefined}>
            <PerpetualTradingBanner px="$5" />
            <InformationPanel />
          </YStack>
        </HeaderScrollGestureWrapper>
        <Stack position="relative">
          <HeaderScrollGestureWrapper
            disabled={isChartFullscreen || isTradingViewScrollLocked}
            panActiveOffsetY={[-4, 4]}
            panFailOffsetX={chartAreaPanFailOffsetX}
            excludeRightEdgeRatio={chartAreaExcludeRightEdgeRatio}
            excludeBottomEdgeHeight={
              TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT
            }
            scrollScale={1.2}
            verticalPanMaxPointers={isTradingViewNative ? 1 : undefined}
            onHorizontalSwipe={chartAreaHorizontalSwipeHandler}
            horizontalSwipeThreshold={24}
            horizontalSwipeVelocityThreshold={900}
            simultaneousWithNativeGesture
            cancelChildTouches={false}
          >
            <Stack h={tradingViewChartHeight} overflow="hidden">
              {(() => {
                if (isTradingViewNative) {
                  return networkId ? (
                    <TradingViewNative
                      key={marketTradingViewKey}
                      testID={MarketTestIDs.detailChart}
                      source={tradingViewNativeSource}
                      enableNativeChartSettings
                      maxSelectableSubIndicatorCount={
                        MARKET_DETAIL_MOBILE_TRADING_VIEW_MAX_SELECTABLE_SUB_INDICATOR_COUNT
                      }
                      nativeControlsLayoutMode="mobile"
                      isNativeChartFullscreen={isChartFullscreen}
                      isChartSwitchDisabled={!marketTradingViewParams}
                      onChartSwitch={onChartSwitch}
                      onNativeChartFullscreenChange={onChartFullscreenChange}
                      onNativeSubIndicatorCountChange={
                        handleNativeSubIndicatorCountChange
                      }
                    />
                  ) : null;
                }

                if (!marketTradingViewParams) {
                  return null;
                }

                if (platformEnv.isNativeAndroid || platformEnv.isNativeIOS) {
                  return (
                    <MobileMarketTradingView
                      key={marketTradingViewKey}
                      tokenAddress={marketTradingViewParams.tokenAddress}
                      networkId={marketTradingViewParams.networkId}
                      tokenSymbol={marketTradingViewParams.tokenSymbol}
                      decimal={marketTradingViewParams.decimal}
                      dataSource={marketTradingViewParams.dataSource}
                      storageNamespace={marketTradingViewStorageNamespace}
                      pageWidth={layoutPageWidth}
                      onChartSwitch={onChartSwitch}
                      onNativeIndicatorQuickBarChange={
                        handleNativeIndicatorQuickBarChange
                      }
                      onNativeSubIndicatorCountChange={
                        handleNativeSubIndicatorCountChange
                      }
                      onIndicatorsDialogOpenChange={
                        handleIndicatorsDialogOpenChange
                      }
                      onInteractionOverlayOpenChange={
                        handleInteractionOverlayOpenChange
                      }
                      kLineDataFallback={assetKLineDataFallback}
                      primaryKLineDataUnavailable={Boolean(marketAssetId)}
                    />
                  );
                }
                return (
                  <LazyMobileMarketTradingView
                    tokenAddress={marketTradingViewParams.tokenAddress}
                    networkId={marketTradingViewParams.networkId}
                    tokenSymbol={marketTradingViewParams.tokenSymbol}
                    decimal={marketTradingViewParams.decimal}
                    dataSource={marketTradingViewParams.dataSource}
                    pageWidth={layoutPageWidth}
                    onChartSwitch={onChartSwitch}
                    kLineDataFallback={assetKLineDataFallback}
                    primaryKLineDataUnavailable={Boolean(marketAssetId)}
                  />
                );
              })()}
            </Stack>
          </HeaderScrollGestureWrapper>
          {/* Reserve the async quick bar until its availability is known. */}
          {nativeIndicatorQuickBarContent}
          {platformEnv.isNativeIOS && !isChartFullscreen ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 50,
                bottom: 0,
                width: 20,
                zIndex: 9999,
              }}
            />
          ) : null}
        </Stack>
      </YStack>
    );
  }, [
    handleHeaderHorizontalSwipe,
    handleIndicatorsDialogOpenChange,
    handleInteractionOverlayOpenChange,
    handleNativeIndicatorQuickBarChange,
    handleNativeSubIndicatorCountChange,
    isChartFullscreen,
    isTradingViewScrollLocked,
    isTradingViewNative,
    layoutPageWidth,
    assetKLineDataFallback,
    marketAssetId,
    marketTradingViewKey,
    marketTradingViewParams,
    marketTradingViewStorageNamespace,
    nativeIndicatorQuickBarContent,
    networkId,
    onChartFullscreenChange,
    onChartSwitch,
    tradingViewNativeSource,
    tradingViewChartHeight,
  ]);

  const renderInformationHeader = useCallback(
    () => informationHeader,
    [informationHeader],
  );

  const renderItem = useCallback(
    ({ index }: { index: number }) => {
      if (index === 0) {
        return (
          <YStack flex={1} height={layoutHeight}>
            <MobileInformationTabs
              containerWidth={
                isChartFullscreen ? fullscreenLayout.contentWidth : undefined
              }
              onScrollEnd={noop}
              renderHeader={renderInformationHeader}
              scrollEnabled={!isChartFullscreen && !isTradingViewScrollLocked}
              portfolioData={portfolioData}
              isRefreshing={isRefreshing}
              tokenLogoUrl={tokenDetail?.logoUrl}
            />
          </YStack>
        );
      }
      return (
        <YStack flex={1} height={layoutHeight}>
          <ScrollView
            onTouchStart={handleSecondTabTouchStart}
            onTouchEnd={handleSecondTabTouchEnd}
          >
            {isStockToken ? (
              <LazyStockTokenOverview />
            ) : (
              <>
                <LazyTokenOverview />
                {isBTCMainnet ? null : <LazyTokenActivityOverview />}
              </>
            )}
            <Stack h={100} w="100%" />
          </ScrollView>
        </YStack>
      );
    },
    [
      fullscreenLayout.contentWidth,
      isChartFullscreen,
      layoutHeight,
      renderInformationHeader,
      isTradingViewScrollLocked,
      portfolioData,
      isRefreshing,
      tokenDetail?.logoUrl,
      handleSecondTabTouchStart,
      handleSecondTabTouchEnd,
      isStockToken,
      isBTCMainnet,
    ],
  );

  const toSwapPanelToken = useMemo(() => {
    return {
      networkId,
      contractAddress: tokenDetail?.address || '',
      symbol: tokenDetail?.symbol || '',
      decimals: tokenDetail?.decimals ?? 0,
      logoURI: tokenDetail?.logoUrl,
      price: tokenDetail?.price,
      isNative: tokenDetail?.isNative,
      isStock: isStockToken,
    };
  }, [
    networkId,
    tokenDetail?.address,
    tokenDetail?.decimals,
    tokenDetail?.logoUrl,
    tokenDetail?.price,
    tokenDetail?.symbol,
    tokenDetail?.isNative,
    isStockToken,
  ]);
  const isSwapTokenReady =
    tokenDetail?.decimalsResolved !== false &&
    typeof tokenDetail?.decimals === 'number' &&
    Number.isInteger(tokenDetail.decimals) &&
    tokenDetail.decimals >= 0;

  const showSwapDialog = (swapToken?: ISwapToken) => {
    if (swapToken) {
      dialogRef.current = inPageDialog.show({
        onClose: () => {
          appEventBus.emit(
            EAppEventBusNames.SwapPanelDismissKeyboard,
            undefined,
          );
          void dismissKeyboardWithDelay(100);
        },
        title: intl.formatMessage({ id: ETranslations.global_swap }),
        showFooter: false,
        showExitButton: true,
        renderContent: (
          <View>
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
                <LazySwapPanelWrap
                  onCloseDialog={() => dialogRef.current?.close()}
                />
              </MarketWatchListProviderMirrorV2>
            </AccountSelectorProviderMirror>
          </View>
        ),
      });
    }
  };

  return (
    <YStack
      flex={1}
      position={isChartFullscreen ? 'absolute' : 'relative'}
      top={isChartFullscreen ? 0 : undefined}
      right={isChartFullscreen ? 0 : undefined}
      bottom={isChartFullscreen ? 0 : undefined}
      left={isChartFullscreen ? 0 : undefined}
      pt={isChartFullscreen ? fullscreenLayout.insets.top : undefined}
      pr={isChartFullscreen ? fullscreenLayout.insets.right : undefined}
      pb={isChartFullscreen ? fullscreenLayout.insets.bottom : undefined}
      pl={isChartFullscreen ? fullscreenLayout.insets.left : undefined}
      overflow="hidden"
      bg="$bgApp"
      zIndex={isChartFullscreen ? 10 : undefined}
      onLayout={handleContainerLayout}
    >
      <Stack display={isChartFullscreen ? 'none' : undefined}>
        <Tabs.TabBar
          divider={false}
          onTabPress={handleTabChange}
          tabNames={tabNames}
          focusedTab={focusedTab}
        />
      </Stack>
      <ScrollView horizontal ref={scrollViewRef} flex={1} scrollEnabled={false}>
        {tabNames.map((_, index) => (
          <YStack
            key={index}
            h={layoutHeight}
            overflow="hidden"
            w={layoutPageWidth}
          >
            {renderItem({ index })}
          </YStack>
        ))}
      </ScrollView>
      {disableTrade || !isSwapTokenReady || isChartFullscreen ? null : (
        <LazySwapPanel
          swapToken={toSwapPanelToken}
          portfolioData={portfolioData}
          onShowSwapDialog={showSwapDialog}
        />
      )}
    </YStack>
  );
}
