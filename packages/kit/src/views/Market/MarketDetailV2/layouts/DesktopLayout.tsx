import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComponentProps, RefObject } from 'react';

import { Spinner, Stack, useOverlayZIndex } from '@onekeyhq/components';
import {
  type ITradingViewNativeSource,
  TradingViewNative,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { fetchMarketAssetKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData';
import type { IMarketKLineDataFallback } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';
import { fetchMarketStockKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketStockKLineData';
import { useMarketPriceSourceAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  TRADING_VIEW_LOCALHOST_ORIGIN,
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

import { MarketTestIDs } from '../../testIDs';
import { usePortfolioData } from '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData';
import { useNetworkAccount } from '../components/InformationTabs/hooks/useNetworkAccount';
import { LazyDesktopMarketTradingView } from '../components/MarketTradingView/LazyMarketTradingView';
import { MarketChartFullscreenHeader } from '../components/MarketTradingView/MarketChartFullscreenHeader';
import { useStockDetail } from '../hooks/StockDetailContext';
import { useMarketDetailDisplayData } from '../hooks/useMarketDetailDisplayData';
import {
  useMarketTradingViewParams,
  useTokenDetail,
} from '../hooks/useTokenDetail';
import { getMarketDetailTradingViewNativeSource } from '../utils/getMarketDetailTradingViewNativeSource';

import { StockDesktopLayout } from './StockDesktopLayout';
import { TokenDesktopLayout } from './TokenDesktopLayout';
import { TopCoinsDesktopLayout } from './TopCoinsDesktopLayout';

import type { DesktopInformationTabs } from '../components/InformationTabs/layout/DesktopInformationTabs';

const MARKET_DETAIL_LAYOUT = {
  chartHeight: 360,
  infoTabsHeight: 480,
} as const;

const SCROLL_CONTAINER_STYLE = { overflowY: 'auto' } as const;
const IFRAME_WHEEL_EVENT_TYPE = 'wheelEvent' as const;

type IDesktopInformationTabsProps = ComponentProps<
  typeof DesktopInformationTabs
>;

interface IIframeWheelEventMessage {
  type: typeof IFRAME_WHEEL_EVENT_TYPE;
  deltaY: number;
}

const ALLOWED_TRADING_VIEW_ORIGINS = new Set([
  new URL(TRADING_VIEW_URL).origin,
  new URL(TRADING_VIEW_URL_TEST).origin,
  ...(platformEnv.isDev ? [TRADING_VIEW_LOCALHOST_ORIGIN] : []),
]);

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

const infoTabsLoadingFallback = (
  <ModuleLoadingFallback minHeight={MARKET_DETAIL_LAYOUT.infoTabsHeight} />
);

const LazyDesktopInformationTabs = LazyLoad<IDesktopInformationTabsProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-desktop-info-tabs" */ '../components/InformationTabs/layout/DesktopInformationTabs'
    ).then(({ DesktopInformationTabs }) => ({
      default: DesktopInformationTabs,
    })),
  undefined,
  infoTabsLoadingFallback,
);

// Listen for wheel events forwarded from TradingView iframe via postMessage.
// TradingView side needs: window.parent.postMessage({ type: 'wheelEvent', deltaY }, '*')
function useIframeWheelPassthrough({
  disabled,
  scrollRef,
}: {
  disabled: boolean;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (platformEnv.isNative || disabled) {
      return;
    }
    const handleMessage = (e: MessageEvent) => {
      if (!ALLOWED_TRADING_VIEW_ORIGINS.has(e.origin)) {
        return;
      }
      const data = e.data as IIframeWheelEventMessage | undefined;
      if (
        data?.type === IFRAME_WHEEL_EVENT_TYPE &&
        typeof data.deltaY === 'number'
      ) {
        scrollRef.current?.scrollBy({ top: data.deltaY });
      }
    };
    globalThis.addEventListener('message', handleMessage);
    return () => {
      globalThis.removeEventListener('message', handleMessage);
    };
  }, [disabled, scrollRef]);
}

export interface IDesktopLayoutProps {
  isChartFullscreen: boolean;
  isTradingViewNative: boolean;
  onChartSwitch: () => void;
  onChartFullscreenChange: (isFullscreen: boolean) => void;
  isNative: boolean;
  networkId: string;
  tokenAddress: string;
  marketTokenId?: string;
  marketAssetDetail?: IMarketAssetDetailData;
  isMarketAssetDetailLoading?: boolean;
  marketTokenCategory?: string;
  disableTrade?: boolean;
  showFavoriteButton?: boolean;
}

export function DesktopLayout({
  isChartFullscreen,
  isTradingViewNative,
  onChartSwitch,
  onChartFullscreenChange,
  isNative: routeIsNative,
  networkId: routeNetworkId,
  tokenAddress: routeTokenAddress,
  marketTokenId,
  marketAssetDetail,
  isMarketAssetDetailLoading,
  marketTokenCategory,
  disableTrade,
  showFavoriteButton = true,
}: IDesktopLayoutProps) {
  const {
    tokenAddress: storeTokenAddress,
    networkId: storeNetworkId,
    tokenDetail,
    tokenDetailPreview,
    isNative: storeIsNative,
    websocketConfig,
    perpsInfo,
  } = useTokenDetail();
  const { tokenDetail: displayTokenDetail } = useMarketDetailDisplayData();
  const { isStockRoute, selectedTokenVariant, stockId } = useStockDetail();
  const shouldUseStockDesktopLayout = isStockRoute && Boolean(stockId);
  const shouldUseTopCoinsDesktopLayout =
    !shouldUseStockDesktopLayout &&
    marketTokenCategory === MARKET_TOP_COINS_CATEGORY_ID;
  const marketAssetId = shouldUseTopCoinsDesktopLayout
    ? marketTokenId?.trim()
    : undefined;
  const [{ source: stockPriceSource }] = useMarketPriceSourceAtom();
  const isStockSharePrice =
    shouldUseStockDesktopLayout && stockPriceSource === 'share';
  const stockNetworkId = selectedTokenVariant?.networkId || routeNetworkId;
  const stockTokenAddress =
    selectedTokenVariant?.contractAddress || routeTokenAddress;
  const tokenDetailNetworkId = storeNetworkId || routeNetworkId;
  const tokenDetailAddress = storeNetworkId
    ? storeTokenAddress
    : routeTokenAddress;
  const networkId = shouldUseStockDesktopLayout
    ? stockNetworkId
    : tokenDetailNetworkId;
  const tokenAddress = shouldUseStockDesktopLayout
    ? stockTokenAddress
    : tokenDetailAddress;
  const tokenDetailIsNative =
    tokenDetailNetworkId === routeNetworkId &&
    tokenDetailAddress === routeTokenAddress
      ? routeIsNative
      : storeIsNative;
  const isNative = shouldUseStockDesktopLayout ? false : tokenDetailIsNative;

  const { accountAddress, xpub } = useNetworkAccount(networkId);
  const chartFullscreenZIndex = useOverlayZIndex(isChartFullscreen);

  const { portfolioData, isRefreshing } = usePortfolioData({
    tokenAddress,
    networkId,
    accountAddress: shouldUseStockDesktopLayout ? undefined : accountAddress,
    xpub: shouldUseStockDesktopLayout ? undefined : xpub,
  });

  const isBTCNetwork = networkUtils.isBTCNetwork(networkId);
  const isBTCMainnet = networkUtils.isBTCMainnet(networkId);
  const nativeHyperliquidCoin =
    isBTCMainnet && isNative ? (perpsInfo?.hlTicker ?? '') : '';

  const swapToken = useMemo(
    () => ({
      networkId: selectedTokenVariant?.networkId || networkId,
      contractAddress:
        displayTokenDetail?.address ||
        selectedTokenVariant?.contractAddress ||
        '',
      symbol: displayTokenDetail?.symbol || selectedTokenVariant?.symbol || '',
      decimals: displayTokenDetail?.decimals ?? 0,
      logoURI: displayTokenDetail?.logoUrl || selectedTokenVariant?.logoUrl,
      price: displayTokenDetail?.price || selectedTokenVariant?.price,
      isNative,
    }),
    [
      networkId,
      selectedTokenVariant,
      displayTokenDetail?.address,
      displayTokenDetail?.symbol,
      displayTokenDetail?.decimals,
      displayTokenDetail?.logoUrl,
      displayTokenDetail?.price,
      isNative,
    ],
  );
  const isSwapTokenReady =
    displayTokenDetail?.decimalsResolved !== false &&
    typeof displayTokenDetail?.decimals === 'number' &&
    Number.isInteger(displayTokenDetail.decimals) &&
    displayTokenDetail.decimals >= 0;
  const shouldDisableTrade = disableTrade || !isSwapTokenReady;

  const scrollContainerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [networkId, stockId, tokenAddress]);
  useIframeWheelPassthrough({
    disabled: isChartFullscreen || isTradingViewNative,
    scrollRef: scrollContainerRef,
  });
  const handleChartFullscreenChange = useCallback(
    (isFullscreen: boolean) => {
      onChartFullscreenChange(isFullscreen);
    },
    [onChartFullscreenChange],
  );
  const handleTradingViewTouchScroll = useCallback(
    (deltaY: number) => {
      if (!isChartFullscreen) {
        scrollContainerRef.current?.scrollBy({ top: deltaY });
      }
    },
    [isChartFullscreen],
  );
  const marketTradingViewParams = useMarketTradingViewParams({
    tokenAddress,
    networkId,
    tokenDetail,
    tokenDetailPreview,
    isNative,
    websocketConfig,
  });
  const effectiveMarketTradingViewParams = marketTradingViewParams;
  const tradingViewNativeSource = useMemo<ITradingViewNativeSource>(() => {
    if (isStockSharePrice && stockId) {
      return { kind: 'stock', stockId };
    }
    if (marketAssetId) {
      return { kind: 'asset', assetId: marketAssetId };
    }
    return getMarketDetailTradingViewNativeSource({
      hyperliquidCoin: nativeHyperliquidCoin,
      isNative,
      marketDataSource: marketTradingViewParams?.dataSource,
      networkId,
      symbol: tokenDetail?.symbol ?? displayTokenDetail?.symbol ?? '',
      tokenAddress,
    });
  }, [
    isStockSharePrice,
    marketAssetId,
    marketTradingViewParams?.dataSource,
    nativeHyperliquidCoin,
    isNative,
    networkId,
    stockId,
    tokenAddress,
    tokenDetail?.symbol,
    displayTokenDetail?.symbol,
  ]);
  const stockKLineDataFallback = useMemo<IMarketKLineDataFallback | undefined>(
    () =>
      stockId
        ? ({ interval, timeFrom, timeTo }) =>
            fetchMarketStockKLineData({
              interval,
              stockId,
              timeFrom,
              timeTo,
            })
        : undefined,
    [stockId],
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
  // Redesigned desktop detail pages lay their Simple/Pro switch over the
  // trailing edge of the Pro widget's control row. Drop the row's own trailing
  // controls there to make room for the stable outer switch.
  // The outer overlay renders the chart-source and expand controls alongside
  // Simple/Pro, so the complete trailing group stays pinned to one place.
  // In fullscreen the widget restores its own expand toggle so it remains the
  // way back out.
  const hideChartTrailingControls = !isChartFullscreen;
  const stockAwareChartSwitch = hideChartTrailingControls
    ? undefined
    : onChartSwitch;
  const stockAwareFullscreenChange = hideChartTrailingControls
    ? undefined
    : handleChartFullscreenChange;
  // Handed to the stock layout's own expand button, which stands in for the
  // control row's hidden one. Routed through the same handler the row's toggle
  // reaches, so both buttons enter fullscreen by exactly one path. Exiting is
  // untouched: fullscreen restores the row, and its toggle is the way out.
  const handleEnterChartFullscreen = useCallback(
    () => handleChartFullscreenChange(true),
    [handleChartFullscreenChange],
  );
  let marketTradingViewKey = 'token';
  if (isStockSharePrice) {
    marketTradingViewKey = `stock-share:${stockId ?? ''}`;
  } else if (marketAssetId) {
    marketTradingViewKey = `asset:${marketAssetId}`;
  }
  const proKLineDataFallback = isStockSharePrice
    ? stockKLineDataFallback
    : assetKLineDataFallback;
  const proKLineDataSource =
    isStockSharePrice || marketAssetId
      ? 'polling'
      : (effectiveMarketTradingViewParams?.dataSource ?? 'polling');
  const marketTradingView = useMemo(() => {
    if (isTradingViewNative) {
      return networkId ||
        tradingViewNativeSource.kind === 'asset' ||
        tradingViewNativeSource.kind === 'stock' ? (
        <TradingViewNative
          testID={MarketTestIDs.detailChart}
          source={tradingViewNativeSource}
          forcedChartType={
            shouldUseStockDesktopLayout ? 'candlestick' : undefined
          }
          enableNativeChartSettings
          nativeControlsLayoutMode="desktop"
          isNativeChartFullscreen={isChartFullscreen}
          nativeChartFullscreenHeader={<MarketChartFullscreenHeader />}
          isChartSwitchDisabled={
            !effectiveMarketTradingViewParams && !marketAssetId
          }
          // The stock layout embeds the widget flush in its own chart block, so
          // the control row's inset would push the first interval clear of the
          // plot's leading edge instead of sitting over it.
          nativeControlsFlushHorizontalInset={hideChartTrailingControls}
          onChartSwitch={stockAwareChartSwitch}
          onNativeChartFullscreenChange={stockAwareFullscreenChange}
        />
      ) : null;
    }

    if (
      !effectiveMarketTradingViewParams &&
      !isStockSharePrice &&
      !marketAssetId
    ) {
      return null;
    }

    return (
      <LazyDesktopMarketTradingView
        key={marketTradingViewKey}
        tokenAddress={
          isStockSharePrice
            ? ''
            : (effectiveMarketTradingViewParams?.tokenAddress ?? '')
        }
        networkId={
          isStockSharePrice
            ? ''
            : (effectiveMarketTradingViewParams?.networkId ?? '')
        }
        tokenSymbol={
          isStockSharePrice
            ? stockId
            : effectiveMarketTradingViewParams?.tokenSymbol
        }
        isNative={
          isStockSharePrice ? false : effectiveMarketTradingViewParams?.isNative
        }
        decimal={
          isStockSharePrice ? undefined : marketTradingViewParams?.decimal
        }
        dataSource={proKLineDataSource}
        onTouchScroll={handleTradingViewTouchScroll}
        nativeChartTypeControlMode="select"
        nativeIndicatorControlMode="popover"
        nativeIntervalControlMode="popover"
        nativePriceMarketCapControlMode="select"
        nativeControlsLayoutMode="desktop"
        isNativeChartFullscreen={isChartFullscreen}
        showNativeIndicatorQuickBar={false}
        forceCandlestickChart={shouldUseStockDesktopLayout}
        kLineDataFallback={proKLineDataFallback}
        primaryKLineDataUnavailable={
          isStockSharePrice || Boolean(marketAssetId)
        }
        disableChartPriceUpdate={isStockSharePrice}
        onChartSwitch={stockAwareChartSwitch}
        onNativeChartFullscreenChange={stockAwareFullscreenChange}
      />
    );
  }, [
    handleTradingViewTouchScroll,
    hideChartTrailingControls,
    isChartFullscreen,
    isTradingViewNative,
    isStockSharePrice,
    marketTradingViewKey,
    marketAssetId,
    shouldUseStockDesktopLayout,
    effectiveMarketTradingViewParams,
    marketTradingViewParams?.decimal,
    networkId,
    stockAwareChartSwitch,
    stockAwareFullscreenChange,
    stockId,
    proKLineDataFallback,
    proKLineDataSource,
    tradingViewNativeSource,
  ]);

  if (shouldUseStockDesktopLayout) {
    return (
      <Stack
        ref={scrollContainerRef as any}
        flex={1}
        style={SCROLL_CONTAINER_STYLE}
      >
        <StockDesktopLayout
          marketTradingView={marketTradingView}
          swapToken={swapToken}
          chartMode={isTradingViewNative ? 'native' : 'tradingView'}
          isChartSwitchDisabled={
            !effectiveMarketTradingViewParams && !isStockSharePrice
          }
          disableTrade={shouldDisableTrade}
          showFavoriteButton={showFavoriteButton}
          isChartFullscreen={isChartFullscreen}
          chartFullscreenZIndex={chartFullscreenZIndex}
          onChartSwitch={onChartSwitch}
          onEnterChartFullscreen={handleEnterChartFullscreen}
        />
      </Stack>
    );
  }

  if (shouldUseTopCoinsDesktopLayout) {
    return (
      <Stack
        ref={scrollContainerRef as any}
        flex={1}
        style={SCROLL_CONTAINER_STYLE}
      >
        <TopCoinsDesktopLayout
          marketTradingView={marketTradingView}
          swapToken={swapToken}
          portfolioData={portfolioData}
          accountAddress={accountAddress}
          isRefreshing={isRefreshing}
          tokenLogoUrl={displayTokenDetail?.logoUrl}
          marketTokenId={marketTokenId}
          assetDetail={marketAssetDetail}
          isAssetDetailLoading={isMarketAssetDetailLoading}
          disableTrade={shouldDisableTrade}
          showFavoriteButton={showFavoriteButton}
          isChartFullscreen={isChartFullscreen}
          chartFullscreenZIndex={chartFullscreenZIndex}
          chartMode={isTradingViewNative ? 'native' : 'tradingView'}
          isChartSwitchDisabled={
            !effectiveMarketTradingViewParams && !marketAssetId
          }
          onChartSwitch={onChartSwitch}
          onEnterChartFullscreen={handleEnterChartFullscreen}
        />
      </Stack>
    );
  }

  return (
    <Stack
      ref={scrollContainerRef as any}
      flex={1}
      style={SCROLL_CONTAINER_STYLE}
    >
      <TokenDesktopLayout
        marketTradingView={marketTradingView}
        swapToken={swapToken}
        portfolioData={portfolioData}
        isRefreshing={isRefreshing}
        isBTCNetwork={isBTCNetwork}
        isBTCMainnet={isBTCMainnet}
        tokenLogoUrl={tokenDetail?.logoUrl}
        showFavoriteButton={showFavoriteButton}
        isChartFullscreen={isChartFullscreen}
        chartFullscreenZIndex={chartFullscreenZIndex}
        chartMode={isTradingViewNative ? 'native' : 'tradingView'}
        isChartSwitchDisabled={!effectiveMarketTradingViewParams}
        disableTrade={shouldDisableTrade}
        onChartSwitch={onChartSwitch}
        onEnterChartFullscreen={handleEnterChartFullscreen}
        InformationTabsComponent={LazyDesktopInformationTabs}
      />
    </Stack>
  );
}
