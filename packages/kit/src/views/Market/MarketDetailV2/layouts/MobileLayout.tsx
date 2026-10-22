import {
  cloneElement,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { View, useWindowDimensions } from 'react-native';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  DelayedFreeze,
  Divider,
  EInPageDialogType,
  HeaderScrollGestureContext,
  IconButton,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  useInPageDialog,
  useIsOverlayPage,
  usePageWidth,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TradingViewChartLoadingMask } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartLoadingMask';
import {
  TradingViewNative,
  getTradingViewNativeSourceKey,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/chartConstants';
import { getTradingViewNativeIntervalStorageNamespace } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervalStorage';
import type { ITradingViewNativeIntervalStorageNamespace } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervalStorage';
import { TradingViewNativeTokenHeader } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewNativeTokenHeader';
import { shouldReserveTradingViewNativeIndicatorQuickBar } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type { ITradingViewNativeIndicatorQuickBarState } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import {
  TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT,
  TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewV2ChartControls';
import type { IMarketKLineDataFallback } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';
import { useMobileTabTouchScrollBridge } from '@onekeyhq/kit/src/hooks/useMobileTabTouchScrollBridge';
import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { useMarketPerpsInfoStatusAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import {
  EJotaiContextStoreNames,
  useMarketDetailChartDisplayModePersistAtom,
  useMarketPriceSourceAtom,
  useMarketTradingViewSubIndicatorCountPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketTradingViewStorageNamespace } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { usePerpsNavigation } from '../../hooks/usePerpsNavigation';
import { MarketWatchListProviderMirrorV2 } from '../../MarketWatchListProviderMirrorV2';
import { MarketTestIDs } from '../../testIDs';
import { InformationPanel } from '../components/InformationPanel/InformationPanel';
import { usePortfolioData } from '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData';
import { useNetworkAccount } from '../components/InformationTabs/hooks/useNetworkAccount';
import { MarketDetailHeaderGesture } from '../components/InformationTabs/layout/MarketDetailScroll';
import { MobileInformationTabs } from '../components/InformationTabs/layout/MobileInformationTabs';
import { resolveMarketDetailHeaderIdentity } from '../components/MarketDetailHeader/marketDetailHeaderIdentity';
import { LazyMobileMarketTradingView } from '../components/MarketTradingView/LazyMarketTradingView';
import { useStockDetail } from '../hooks/StockDetailContext';
import { useMarketDetailDisplayData } from '../hooks/useMarketDetailDisplayData';
import { useMarketKlineLivePrice } from '../hooks/useMarketKlineLivePrice';
import { useMarketNativeChartLayout } from '../hooks/useMarketNativeChartLayout';
import { useMarketNativeChartPriceUpdate } from '../hooks/useMarketNativeChartPriceUpdate';
import { resolveDisplayedStockPriceMode } from '../hooks/useStockPriceSource';
import { useMarketTradingViewParams } from '../hooks/useTokenDetail';
import { useTradingViewSubIndicatorCount } from '../hooks/useTradingViewSubIndicatorCount';
import { getMarketDetailTradingViewNativeSource } from '../utils/getMarketDetailTradingViewNativeSource';
import {
  resolveMarketDetailFooterMode,
  resolveMarketMobileDetailKind,
} from '../utils/marketMobileDetailKind';
import { resolveMarketNativeChartFallbackQuoteEnabled } from '../utils/marketNativeChartFallbackQuote';
import { getMarketStockChartPreviousClose } from '../utils/marketStockPreviousClose';
import {
  hasMarketContractAddress,
  isMarketTokenDecimalsReady,
  isMatchingMarketTokenIdentity,
} from '../utils/marketTokenIdentity';
import {
  getMarketTradingViewSubIndicatorCount,
  normalizeMarketTradingViewSubIndicatorCountPersist,
  setMarketTradingViewSubIndicatorCount,
} from '../utils/marketTradingViewSubIndicatorCount';
import { buildMarketStockTokenMetadata } from '../utils/resolveIsStockToken';

import { shouldShowMobileSimpleChart } from './mobileChartVisibility';
import { MobileChartModeControl, MobileSimpleChart } from './MobileSimpleChart';

import type { SwapPanel } from '../components/SwapPanel/SwapPanel';
import type { SwapPanelWrap } from '../components/SwapPanel/SwapPanelWrap';

type ISwapPanelProps = ComponentProps<typeof SwapPanel>;
type ISwapPanelWrapProps = ComponentProps<typeof SwapPanelWrap>;
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

// Large Button: 12pt vertical padding x2, 24pt line, 1pt border x2.
const SWAP_PANEL_BUTTON_HEIGHT = 50;

// Stands in for the chart's interval row until the chart can mount, so that
// row is not an empty band while the token identity resolves.
function ChartControlsSkeleton() {
  return (
    <XStack
      h={TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT}
      px="$5"
      gap="$4"
      ai="center"
    >
      {[28, 40, 32, 36].map((width) => (
        <Skeleton key={width} width={width} height={18} radius="round" />
      ))}
      <Stack flex={1} />
      <Skeleton width={20} height={20} borderRadius="$1" />
    </XStack>
  );
}

// Mirrors the native SwapPanel footer so the trade area holds its final
// height while the token detail (and the panel module) load.
function SwapPanelFooterSkeleton() {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  return (
    <YStack testID="market-detail-swap-panel-skeleton">
      <Divider />
      <XStack px="$5" pt="$2.5" gap="$2" alignItems="center">
        <SizableText size="$bodySmMedium">
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_myposition,
          })}
        </SizableText>
        <Skeleton.BodySm w={40} />
      </XStack>
      <XStack px="$5" pb={bottom || '$4'} pt="$2.5" gap="$2.5">
        <Stack flex={1}>
          <Skeleton h={SWAP_PANEL_BUTTON_HEIGHT} radius="round" />
        </Stack>
        <Stack flex={1}>
          <Skeleton h={SWAP_PANEL_BUTTON_HEIGHT} radius="round" />
        </Stack>
      </XStack>
    </YStack>
  );
}

const swapPanelLoadingFallback = <ModuleLoadingFallback minHeight={96} />;
const swapPanelFooterLoadingFallback = platformEnv.isNative ? (
  <SwapPanelFooterSkeleton />
) : (
  swapPanelLoadingFallback
);
// The pages viewport is only known after layout. Remember it per window and
// page shape so later iOS detail pages size their chart on the first frame.
const measuredPageViewportHeights = new Map<string, number>();

function getPageViewportCacheKey({
  windowWidth,
  windowHeight,
  isModalPage,
  hasFooter,
}: {
  windowWidth: number;
  windowHeight: number;
  isModalPage: boolean;
  hasFooter: boolean;
}) {
  return [
    windowWidth,
    windowHeight,
    isModalPage ? 'modal' : 'page',
    hasFooter ? 'footer' : 'plain',
  ].join(':');
}

const LazySwapPanel = LazyLoad<ISwapPanelProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-swap-panel" */ '../components/SwapPanel/SwapPanel'
    ).then(({ SwapPanel }) => ({
      default: SwapPanel,
    })),
  undefined,
  swapPanelFooterLoadingFallback,
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
  intervalStorageNamespace,
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
  intervalStorageNamespace: ITradingViewNativeIntervalStorageNamespace;
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
      intervalStorageNamespace={intervalStorageNamespace}
      pageWidth={pageWidth}
      nativeControlsLayoutMode="mobile"
      mobileToolbarExtra={<MobileChartModeControl />}
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
  active?: boolean;
  isLayoutPending?: boolean;
  isInitialContentPending?: boolean;
  disablePerpsBanner?: boolean;
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
  marketAssetDetail?: IMarketAssetDetailData;
  isMarketAssetDetailLoading?: boolean;
}

export function MobileLayout({
  active,
  isLayoutPending,
  isInitialContentPending,
  disablePerpsBanner = false,
  disableTrade,
  isChartFullscreen,
  isTradingViewNative: preferredIsTradingViewNative,
  onChartFullscreenChange,
  onChartSwitch,
  isNative: routeIsNative = false,
  networkId: routeNetworkId = '',
  tokenAddress: routeTokenAddress = '',
  marketTokenId,
  marketTokenCategory,
  marketAssetDetail,
  isMarketAssetDetailLoading,
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
  } = useMarketDetailDisplayData();
  const {
    isStockRoute,
    selectedTokenVariant,
    stockDetail,
    stockPreview,
    stockId,
    isStockDetailError,
  } = useStockDetail();
  const [{ source: storedPriceMode }] = useMarketPriceSourceAtom();
  const priceMode = resolveDisplayedStockPriceMode({
    stockId,
    isStockDetailError,
    storedPriceMode,
  });
  // The legacy token-only chart cannot render the selected share series.
  const isTradingViewNative =
    preferredIsTradingViewNative || priceMode === 'share';
  const detailKind = resolveMarketMobileDetailKind({
    isStockToken: Boolean(isStockToken || isStockRoute),
    marketTokenCategory,
  });
  const { perpDisabled } = usePerpTabConfig();
  const [marketPerpsInfoStatus] = useMarketPerpsInfoStatusAtom();
  const isPerpsInfoPending =
    !perpDisabled &&
    !perpsInfo?.hlTicker &&
    marketPerpsInfoStatus === 'pending';
  const footerMode = resolveMarketDetailFooterMode(
    !perpDisabled && Boolean(perpsInfo?.hlTicker),
    isPerpsInfoPending,
    disablePerpsBanner,
  );
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.MarketBanner,
  );
  const handleOpenPerps = useCallback(() => {
    const ticker = perpsInfo?.hlTicker;
    if (!ticker) {
      return;
    }
    navigateToPerps(ticker);
  }, [navigateToPerps, perpsInfo?.hlTicker]);
  const [{ mode: chartDisplayMode }] =
    useMarketDetailChartDisplayModePersistAtom();
  const isSimpleChart = shouldShowMobileSimpleChart({
    mode: chartDisplayMode,
    isChartFullscreen,
  });
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
  const isStockDetailChart = isStockRoute && Boolean(stockId);
  const stockPreviousClose = isStockDetailChart
    ? getMarketStockChartPreviousClose({
        priceSource: priceMode,
        stockDetail,
        selectedTokenVariant,
        tokenDetail,
        tokenDetailNetworkId: storeNetworkId,
      })
    : undefined;
  const handleNativeChartPriceUpdate = useMarketNativeChartPriceUpdate({
    networkId,
    tokenAddress,
    enabled: active !== false && !isSimpleChart && priceMode === 'token',
  });
  const marketTradingViewParams = useMarketTradingViewParams({
    tokenAddress,
    networkId,
    tokenDetail,
    tokenDetailPreview,
    isNative,
    websocketConfig,
  });
  let marketTradingViewKey = 'v2';
  if (!isTradingViewNative && marketTradingViewParams) {
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
  const { subIndicatorCount: nativeSubIndicatorCount } =
    useMarketNativeChartLayout();
  let initialSubIndicatorCount =
    MARKET_DETAIL_TRADING_VIEW_DEFAULT_SUB_INDICATOR_COUNT;
  if (isTradingViewNative) {
    initialSubIndicatorCount = nativeSubIndicatorCount;
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
  const tradingViewNativeSource = useMemo(
    () =>
      getMarketDetailTradingViewNativeSource({
        hyperliquidCoin: nativeHyperliquidCoin,
        isNative,
        marketDataSource: marketTradingViewParams?.dataSource,
        networkId,
        symbol: tokenSymbol ?? '',
        tokenAddress,
        stockId,
        priceMode,
      }),
    [
      stockId,
      priceMode,
      marketTradingViewParams?.dataSource,
      nativeHyperliquidCoin,
      isNative,
      networkId,
      tokenAddress,
      tokenSymbol,
    ],
  );
  const {
    symbol: chartHeaderSymbol,
    logoUrl: chartHeaderLogoUrl,
    logoUrls: chartHeaderLogoUrls,
  } = resolveMarketDetailHeaderIdentity({
    isStockToken: tradingViewNativeSource.kind === 'stock',
    stockSymbol: stockDetail?.symbol || stockPreview?.symbol || stockId,
    stockLogoUrl: stockDetail?.logoUrl || stockPreview?.logoUrl,
    tokenSymbol: tokenSymbol || tokenDetail?.name,
    tokenLogoUrl: tokenDetail?.logoUrl,
    tokenLogoUrls: tokenDetail?.logoUrls,
    tokenVariant: selectedTokenVariant,
  });
  // Polling can return the same logos in a new array without changing identity.
  const stableChartHeaderLogoUrlsRef = useRef(chartHeaderLogoUrls);
  if (
    stableChartHeaderLogoUrlsRef.current?.length !==
      chartHeaderLogoUrls?.length ||
    chartHeaderLogoUrls?.some(
      (url, index) => url !== stableChartHeaderLogoUrlsRef.current?.[index],
    )
  ) {
    stableChartHeaderLogoUrlsRef.current = chartHeaderLogoUrls;
  }
  const stableChartHeaderLogoUrls = stableChartHeaderLogoUrlsRef.current;
  if (isTradingViewNative) {
    marketTradingViewKey = `native:${marketTokenId ?? ''}:${getTradingViewNativeSourceKey(tradingViewNativeSource)}`;
  }
  useMarketKlineLivePrice({
    enabled: resolveMarketNativeChartFallbackQuoteEnabled({
      active,
      isTradingViewNative,
      isNativeChartMounted: !isSimpleChart,
      source: tradingViewNativeSource,
      isNative,
      networkId,
      tokenAddress,
    }),
    networkId,
    tokenAddress,
  });
  const { accountAddress, xpub } = useNetworkAccount(networkId);
  const accountMarksContext = useMemo(
    () => ({ accountAddress, networkId, tokenAddress }),
    [accountAddress, networkId, tokenAddress],
  );

  const { portfolioData, isRefreshing, isPortfolioPending } = usePortfolioData({
    tokenAddress,
    networkId,
    accountAddress,
    xpub,
  });
  const isModalPage = useIsOverlayPage();
  const inPageDialog = useInPageDialog(
    isModalPage ? EInPageDialogType.inModalPage : EInPageDialogType.inTabPages,
  );
  const dialogRef = useRef<IDialogInstance>(null);

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { excludeStartEdgeWidth } = useContext(HeaderScrollGestureContext);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const pageViewportCacheKey = getPageViewportCacheKey({
    windowWidth,
    windowHeight,
    isModalPage,
    hasFooter: !disableTrade,
  });
  const [pageViewportHeight, setPageViewportHeight] = useState(() =>
    platformEnv.isNativeIOS
      ? (measuredPageViewportHeights.get(pageViewportCacheKey) ?? 0)
      : 0,
  );
  const { top, bottom } = useSafeAreaInsets();

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
  // iOS sizes pages from the measured viewport: its header and footer heights
  // vary by OS version, so the estimate above only covers the first layout
  // pass. Android keeps the estimate on tab pages because adjustResize shrinks
  // the measured viewport while a keyboard is up; its overlays already hide
  // the main tab bar, so they use the actual page viewport.
  const usesMeasuredPageViewport =
    platformEnv.isNativeIOS || (platformEnv.isNativeAndroid && isModalPage);
  const preservesAndroidTabHeight = platformEnv.isNativeAndroid && !isModalPage;
  const layoutHeight =
    usesMeasuredPageViewport && pageViewportHeight > 0
      ? pageViewportHeight
      : height;
  const layoutPageWidth = effectivePageWidth;

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
  const chartSubIndicatorCount = isTradingViewNative
    ? nativeSubIndicatorCount
    : tradingViewSubIndicatorCount;
  const isTradingViewScrollLocked =
    isTradingViewIndicatorsDialogOpen || isTradingViewInteractionOverlayOpen;

  const preservesPortraitLayout =
    platformEnv.isNativeIOS && !platformEnv.isNativeIOSPad;
  const preserveInlineViewport =
    preservesPortraitLayout &&
    (isChartFullscreen || windowWidth > windowHeight);

  const handleContainerLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number; width: number } } }) => {
      if (
        preserveInlineViewport ||
        (preservesPortraitLayout &&
          Math.round(event.nativeEvent.layout.width) >
            Math.round(Math.min(windowWidth, windowHeight)))
      ) {
        return;
      }
      const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
      if (nextWidth > 0) {
        setContainerWidth((previousWidth) =>
          previousWidth === nextWidth ? previousWidth : nextWidth,
        );
      }
      if (preservesPortraitLayout && nextHeight > 0) {
        setContainerHeight((previousHeight) =>
          previousHeight === nextHeight ? previousHeight : nextHeight,
        );
      }
    },
    [
      preserveInlineViewport,
      preservesPortraitLayout,
      windowHeight,
      windowWidth,
    ],
  );

  const handlePageViewportLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number; width: number } } }) => {
      // The fullscreen canvas measures its window independently. Keep the
      // hidden page's portrait layout ready for the return transition.
      if (
        !usesMeasuredPageViewport ||
        preserveInlineViewport ||
        // A queued landscape layout can arrive after Dimensions is portrait.
        (preservesPortraitLayout &&
          Math.round(event.nativeEvent.layout.width) >
            Math.round(Math.min(windowWidth, windowHeight)))
      ) {
        return;
      }
      const { height: nextHeight } = event.nativeEvent.layout;
      if (nextHeight > 0) {
        if (platformEnv.isNativeIOS) {
          measuredPageViewportHeights.set(pageViewportCacheKey, nextHeight);
        }
        setPageViewportHeight((previousHeight) =>
          previousHeight === nextHeight ? previousHeight : nextHeight,
        );
      }
    },
    [
      pageViewportCacheKey,
      preserveInlineViewport,
      preservesPortraitLayout,
      usesMeasuredPageViewport,
      windowHeight,
      windowWidth,
    ],
  );

  useEffect(() => {
    setIsTradingViewIndicatorsDialogOpen(false);
    setIsTradingViewInteractionOverlayOpen(false);
    if (isTradingViewNative && !platformEnv.isNative) {
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
  const tradingViewHeight = useMemo(() => {
    if (platformEnv.isNative) {
      const baseChartHeight = Math.round(
        Number(layoutHeight) *
          MARKET_DETAIL_MOBILE_TRADING_VIEW_BASE_HEIGHT_RATIO,
      );
      const fixedMainChartHeight =
        baseChartHeight +
        TRADING_VIEW_NATIVE_CHART_CONTROLS_HEIGHT +
        TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT -
        TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT;
      return (
        fixedMainChartHeight +
        chartSubIndicatorCount * TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT
      );
    }
    return 'calc(100vh - 96px - 74px - 250px)';
  }, [chartSubIndicatorCount, layoutHeight]);

  const shouldReserveNativeIndicatorQuickBar =
    platformEnv.isNative &&
    shouldReserveTradingViewNativeIndicatorQuickBar(
      nativeIndicatorQuickBarState,
    );

  const tradingViewChartHeight = useMemo(() => {
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
  }, [shouldReserveNativeIndicatorQuickBar, tradingViewHeight]);

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
    const chartAreaPanFailOffsetX: [number, number] =
      isTradingViewNative || platformEnv.isNativeAndroid
        ? [-12, 12]
        : [-40, 40];
    const chartAreaExcludeRightEdgeRatio = platformEnv.isNativeAndroid
      ? 0.16
      : 0.1;

    return (
      <YStack bg="$bgApp" pointerEvents="box-none">
        <MarketDetailHeaderGesture
          disabled={isChartFullscreen}
          panActiveOffsetY={[-4, 4]}
          scrollScale={1}
          horizontalSwipeThreshold={36}
        >
          <YStack>
            <DelayedFreeze
              freeze={isChartFullscreen && !platformEnv.isNativeIOS}
            >
              <InformationPanel mobileDetailKind={detailKind} />
            </DelayedFreeze>
          </YStack>
        </MarketDetailHeaderGesture>
        <Stack position="relative">
          {isSimpleChart ? (
            <MarketDetailHeaderGesture
              disabled={isChartFullscreen}
              panActiveOffsetY={[-4, 4]}
              panFailOffsetX={chartAreaPanFailOffsetX}
              scrollScale={1.2}
              simultaneousWithNativeGesture
              cancelChildTouches={false}
            >
              <MobileSimpleChart marketAssetId={marketTokenId} />
            </MarketDetailHeaderGesture>
          ) : null}
          {isSimpleChart ? null : (
            <MarketDetailHeaderGesture
              disabled={isChartFullscreen || isTradingViewScrollLocked}
              panActiveOffsetY={isTradingViewNative ? [-12, 12] : [-4, 4]}
              panFailOffsetX={chartAreaPanFailOffsetX}
              excludeRightEdgeRatio={chartAreaExcludeRightEdgeRatio}
              excludeBottomEdgeHeight={
                isTradingViewNative
                  ? 0
                  : TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT
              }
              scrollScale={1.2}
              verticalPanMaxPointers={isTradingViewNative ? 1 : undefined}
              horizontalSwipeThreshold={24}
              horizontalSwipeVelocityThreshold={900}
              simultaneousWithNativeGesture
              cancelChildTouches={false}
            >
              <Stack h={tradingViewChartHeight} overflow="hidden">
                {(() => {
                  if (isTradingViewNative) {
                    return networkId ||
                      tradingViewNativeSource.kind === 'stock' ? (
                      <TradingViewNative
                        key={marketTradingViewKey}
                        testID={MarketTestIDs.detailChart}
                        source={tradingViewNativeSource}
                        useFullscreenOverlay={platformEnv.isWeb || undefined}
                        accountMarksContext={
                          tradingViewNativeSource.kind === 'stock'
                            ? undefined
                            : accountMarksContext
                        }
                        onPriceUpdate={handleNativeChartPriceUpdate}
                        enablePreviousClose={isStockDetailChart}
                        previousClose={stockPreviousClose}
                        enableNativeChartSettings
                        enableDrawings={!platformEnv.isNative}
                        prioritizePageScroll
                        nativeChartSettingsInToolbar={
                          platformEnv.isNative || platformEnv.isWeb
                        }
                        showNativeIndicatorQuickBar={platformEnv.isNative}
                        onNativeIndicatorQuickBarChange={
                          platformEnv.isNative
                            ? handleNativeIndicatorQuickBarChange
                            : undefined
                        }
                        maxSelectableSubIndicatorCount={
                          MARKET_DETAIL_MOBILE_TRADING_VIEW_MAX_SELECTABLE_SUB_INDICATOR_COUNT
                        }
                        nativeControlsLayoutMode="mobile"
                        mobileToolbarExtra={
                          <>
                            {!isChartFullscreen ? (
                              <MobileChartModeControl />
                            ) : null}
                            {platformEnv.isWeb ? (
                              <IconButton
                                testID="market-mobile-chart-fullscreen-toggle"
                                size="small"
                                variant="tertiary"
                                icon={
                                  isChartFullscreen
                                    ? 'TradingViewExitFullscreenCustom'
                                    : 'TradingViewFullscreenCustom'
                                }
                                title={intl.formatMessage({
                                  id: isChartFullscreen
                                    ? ETranslations.global_collapse
                                    : ETranslations.global_expand,
                                })}
                                onPress={() =>
                                  onChartFullscreenChange?.(!isChartFullscreen)
                                }
                              />
                            ) : null}
                          </>
                        }
                        isNativeChartFullscreen={isChartFullscreen}
                        nativeChartFullscreenHeader={
                          platformEnv.isNative && chartHeaderSymbol ? (
                            <TradingViewNativeTokenHeader
                              name={chartHeaderSymbol}
                              tokenImageUri={chartHeaderLogoUrl}
                              tokenImageUris={stableChartHeaderLogoUrls}
                            />
                          ) : undefined
                        }
                        isChartSwitchDisabled={
                          priceMode === 'share' || !marketTradingViewParams
                        }
                        onChartSwitch={onChartSwitch}
                        onNativeChartFullscreenChange={onChartFullscreenChange}
                      />
                    ) : (
                      // Same controls row + masked canvas the chart mounts with.
                      <YStack h="100%">
                        <ChartControlsSkeleton />
                        <Stack flex={1} position="relative">
                          <TradingViewChartLoadingMask />
                        </Stack>
                      </YStack>
                    );
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
                        intervalStorageNamespace={getTradingViewNativeIntervalStorageNamespace(
                          tradingViewNativeSource,
                        )}
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
                      />
                    );
                  }
                  return (
                    <LazyMobileMarketTradingView
                      intervalStorageNamespace={getTradingViewNativeIntervalStorageNamespace(
                        tradingViewNativeSource,
                      )}
                      tokenAddress={marketTradingViewParams.tokenAddress}
                      networkId={marketTradingViewParams.networkId}
                      tokenSymbol={marketTradingViewParams.tokenSymbol}
                      decimal={marketTradingViewParams.decimal}
                      dataSource={marketTradingViewParams.dataSource}
                      pageWidth={layoutPageWidth}
                      mobileToolbarExtra={<MobileChartModeControl />}
                      onChartSwitch={onChartSwitch}
                    />
                  );
                })()}
              </Stack>
            </MarketDetailHeaderGesture>
          )}
          {/* Reserve the async quick bar until its availability is known. */}
          {isSimpleChart ? null : nativeIndicatorQuickBarContent}
          {platformEnv.isNativeIOS &&
          !isTradingViewNative &&
          !isChartFullscreen &&
          !isSimpleChart ? (
            <View
              style={{
                position: 'absolute',
                start: 0,
                top: 50,
                bottom: 0,
                width: excludeStartEdgeWidth,
                zIndex: 9999,
              }}
            />
          ) : null}
        </Stack>
      </YStack>
    );
  }, [
    excludeStartEdgeWidth,
    accountMarksContext,
    chartHeaderLogoUrl,
    chartHeaderSymbol,
    detailKind,
    handleIndicatorsDialogOpenChange,
    handleInteractionOverlayOpenChange,
    handleNativeChartPriceUpdate,
    handleNativeIndicatorQuickBarChange,
    handleNativeSubIndicatorCountChange,
    intl,
    isChartFullscreen,
    isSimpleChart,
    isStockDetailChart,
    isTradingViewScrollLocked,
    isTradingViewNative,
    layoutPageWidth,
    marketTokenId,
    marketTradingViewKey,
    marketTradingViewParams,
    marketTradingViewStorageNamespace,
    nativeIndicatorQuickBarContent,
    networkId,
    onChartFullscreenChange,
    onChartSwitch,
    stockPreviousClose,
    stableChartHeaderLogoUrls,
    priceMode,
    tradingViewNativeSource,
    tradingViewChartHeight,
  ]);

  const renderInformationHeader = useCallback(
    () => informationHeader,
    [informationHeader],
  );

  const hasSwapContract = hasMarketContractAddress(tokenDetail?.address);
  const toSwapPanelToken = useMemo(() => {
    return {
      networkId,
      contractAddress: hasSwapContract ? tokenDetail?.address || '' : '',
      symbol: tokenDetail?.symbol || '',
      decimals: tokenDetail?.decimals ?? 0,
      logoURI: tokenDetail?.logoUrl,
      price: tokenDetail?.price,
      isNative: Boolean(tokenDetail?.isNative) || isNative || !hasSwapContract,
      isStock: Boolean(isStockToken || isStockRoute),
      stock: buildMarketStockTokenMetadata(tokenDetail?.stock, stockId),
    };
  }, [
    networkId,
    hasSwapContract,
    tokenDetail?.address,
    tokenDetail?.decimals,
    tokenDetail?.logoUrl,
    tokenDetail?.price,
    tokenDetail?.symbol,
    tokenDetail?.isNative,
    isNative,
    isStockToken,
    isStockRoute,
    stockId,
    tokenDetail?.stock,
  ]);
  const isSwapTokenReady = Boolean(
    tokenDetail &&
    isMatchingMarketTokenIdentity(tokenDetail, {
      tokenAddress,
      networkId,
      isNative,
    }),
  );
  const isSwapExecutionReady = isMarketTokenDecimalsReady(tokenDetail);

  const showSwapDialog = (swapToken?: ISwapToken) => {
    if (!isSwapTokenReady || !isSwapExecutionReady) {
      return;
    }
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
                  isStock={swapToken.isStock}
                  onCloseDialog={() => dialogRef.current?.close()}
                />
              </MarketWatchListProviderMirrorV2>
            </AccountSelectorProviderMirror>
          </View>
        ),
      });
    }
  };

  // Resolve the complete button group before revealing it. Chart rendering
  // remains independent, and unknown support never creates a phantom entry.
  let swapPanelFooter: ReactNode = null;
  if (!disableTrade) {
    swapPanelFooter = footerMode ? (
      <LazySwapPanel
        swapToken={toSwapPanelToken}
        portfolioData={portfolioData}
        onShowSwapDialog={showSwapDialog}
        isPortfolioPending={isPortfolioPending}
        executionReady={isSwapTokenReady && isSwapExecutionReady}
        footerMode={footerMode}
        mobileLayout
        detailKind={detailKind}
        onPerps={handleOpenPerps}
        perpsDisabled={perpDisabled || !perpsInfo?.hlTicker}
      />
    ) : (
      <SwapPanelFooterSkeleton />
    );
  }

  // Reveal quotes and the chart only after the first detail request has
  // also determined whether the perps banner exists. Polling keeps them mounted.
  if (platformEnv.isNative && (isLayoutPending || isInitialContentPending)) {
    return (
      <Stack
        flex={1}
        bg="$bgApp"
        alignItems="center"
        justifyContent="center"
        testID="market-detail-initial-loading"
      >
        <Spinner size="large" />
      </Stack>
    );
  }

  // Keep the iPhone chart owner's layout intact while its canvas is in the
  // fullscreen host. display:none collapses it and causes extra layout work.
  return (
    <YStack flex={1} overflow="hidden" onLayout={handleContainerLayout}>
      <YStack
        flex={preservesPortraitLayout && containerHeight > 0 ? undefined : 1}
        height={
          preservesPortraitLayout && containerHeight > 0
            ? containerHeight
            : undefined
        }
        width={preservesPortraitLayout ? layoutPageWidth : undefined}
        display={
          isChartFullscreen && !platformEnv.isNativeIOS ? 'none' : undefined
        }
        pointerEvents={isChartFullscreen ? 'none' : 'auto'}
        accessibilityElementsHidden={isChartFullscreen}
        overflow="hidden"
        bg="$bgApp"
      >
        <YStack flex={1} overflow="hidden" onLayout={handlePageViewportLayout}>
          {/* Let the viewport shrink around the keyboard without resizing its tabs. */}
          <YStack
            flex={preservesAndroidTabHeight ? undefined : 1}
            height={preservesAndroidTabHeight ? layoutHeight : undefined}
          >
            <MobileInformationTabs
              containerWidth={layoutPageWidth}
              freezeContent={isChartFullscreen && !platformEnv.isNativeIOS}
              onScrollEnd={noop}
              renderHeader={renderInformationHeader}
              pendingHeader={informationHeader}
              scrollEnabled={!isChartFullscreen && !isTradingViewScrollLocked}
              portfolioData={portfolioData}
              isRefreshing={isRefreshing}
              isPortfolioPending={isPortfolioPending}
              tokenLogoUrl={tokenDetail?.logoUrl}
              detailKind={detailKind}
              marketAssetDetail={marketAssetDetail}
              isMarketAssetDetailLoading={isMarketAssetDetailLoading}
            />
          </YStack>
        </YStack>
        <DelayedFreeze freeze={isChartFullscreen && !platformEnv.isNativeIOS}>
          {swapPanelFooter}
        </DelayedFreeze>
      </YStack>
    </YStack>
  );
}
