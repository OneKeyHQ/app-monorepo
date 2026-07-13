import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComponentProps, RefObject } from 'react';

import {
  Divider,
  Spinner,
  Stack,
  XStack,
  YStack,
  useOverlayZIndex,
} from '@onekeyhq/components';
import {
  TRADING_VIEW_LOCALHOST_ORIGIN,
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { usePortfolioData } from '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData';
import { useNetworkAccount } from '../components/InformationTabs/hooks/useNetworkAccount';
import { PerpetualTradingBanner } from '../components/PerpetualTradingBanner/PerpetualTradingBanner';
import { SwapPanel } from '../components/SwapPanel/SwapPanel';
import { TokenActivityOverview } from '../components/TokenActivityOverview/TokenActivityOverview';
import { TokenDetailHeader } from '../components/TokenDetailHeader/TokenDetailHeader';
import { StockTradingActivity } from '../components/TokenSupplementaryInfo/StockTradingActivity';
import { TokenSupplementaryInfo } from '../components/TokenSupplementaryInfo/TokenSupplementaryInfo';
import {
  useMarketTradingViewParams,
  useTokenDetail,
} from '../hooks/useTokenDetail';

import type { DesktopInformationTabs } from '../components/InformationTabs/layout/DesktopInformationTabs';
import type { IMarketTradingViewProps } from '../components/MarketTradingView/MarketTradingView';

const MARKET_DETAIL_LAYOUT = {
  chartHeight: 550,
  chartFullscreenHeaderFillHeight: 48,
  infoTabsHeight: 480,
} as const;

const SCROLL_CONTAINER_STYLE = { overflowY: 'auto' } as const;
const MARKET_CHART_FULLSCREEN_STYLE = {
  position: 'fixed',
  left: 0,
  top: 0,
  right: 0,
  bottom: platformEnv.isWeb ? 40 : 0,
} as const;
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

const chartLoadingFallback = (
  <ModuleLoadingFallback minHeight={MARKET_DETAIL_LAYOUT.chartHeight} />
);

const infoTabsLoadingFallback = (
  <ModuleLoadingFallback minHeight={MARKET_DETAIL_LAYOUT.infoTabsHeight} />
);

const LazyMarketTradingView = LazyLoad<IMarketTradingViewProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-tradingview" */ '../components/MarketTradingView/MarketTradingView'
    ).then(({ MarketTradingView }) => ({
      default: (props: IMarketTradingViewProps) => (
        <MarketTradingView {...props} />
      ),
    })),
  undefined,
  chartLoadingFallback,
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
  onChartFullscreenChange: (isFullscreen: boolean) => void;
  showFavoriteButton?: boolean;
}

export function DesktopLayout({
  isChartFullscreen,
  onChartFullscreenChange,
  showFavoriteButton = true,
}: IDesktopLayoutProps) {
  const {
    tokenAddress,
    networkId,
    tokenDetail,
    isNative,
    websocketConfig,
    isStockToken,
  } = useTokenDetail();

  const { accountAddress, xpub } = useNetworkAccount(networkId);
  const chartFullscreenZIndex = useOverlayZIndex(isChartFullscreen);

  const { portfolioData, isRefreshing } = usePortfolioData({
    tokenAddress,
    networkId,
    accountAddress,
    xpub,
  });

  const isBTCNetwork = networkUtils.isBTCNetwork(networkId);
  const isBTCMainnet = networkUtils.isBTCMainnet(networkId);

  const swapToken = useMemo(
    () => ({
      networkId,
      contractAddress: tokenDetail?.address || '',
      symbol: tokenDetail?.symbol || '',
      decimals: tokenDetail?.decimals || 0,
      logoURI: tokenDetail?.logoUrl,
      price: tokenDetail?.price,
    }),
    [
      networkId,
      tokenDetail?.address,
      tokenDetail?.symbol,
      tokenDetail?.decimals,
      tokenDetail?.logoUrl,
      tokenDetail?.price,
    ],
  );

  const scrollContainerRef = useRef<HTMLElement>(null);
  useIframeWheelPassthrough({
    disabled: isChartFullscreen,
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
      if (isChartFullscreen) {
        return;
      }
      scrollContainerRef.current?.scrollBy({ top: deltaY });
    },
    [isChartFullscreen],
  );

  const marketTradingViewParams = useMarketTradingViewParams({
    tokenAddress,
    networkId,
    tokenDetail,
    isNative,
    websocketConfig,
  });

  const marketTradingView = useMemo(() => {
    if (!marketTradingViewParams) {
      return null;
    }

    return (
      <LazyMarketTradingView
        tokenAddress={marketTradingViewParams.tokenAddress}
        networkId={marketTradingViewParams.networkId}
        tokenSymbol={marketTradingViewParams.tokenSymbol}
        isNative={marketTradingViewParams.isNative}
        dataSource={marketTradingViewParams.dataSource}
        onTouchScroll={handleTradingViewTouchScroll}
        nativeChartTypeControlMode="select"
        nativeIndicatorControlMode="popover"
        nativeIntervalControlMode="popover"
        nativePriceMarketCapControlMode="select"
        nativeControlsLayoutMode="desktop"
        isNativeChartFullscreen={isChartFullscreen}
        showNativeIndicatorQuickBar={false}
        onNativeChartFullscreenChange={handleChartFullscreenChange}
      />
    );
  }, [
    handleChartFullscreenChange,
    handleTradingViewTouchScroll,
    isChartFullscreen,
    marketTradingViewParams,
  ]);

  return (
    <Stack
      ref={scrollContainerRef as any}
      flex={1}
      style={SCROLL_CONTAINER_STYLE}
    >
      <XStack>
        {/* Left column */}
        <YStack
          flex={1}
          borderRightWidth="$px"
          borderRightColor="$borderSubdued"
        >
          <TokenDetailHeader showFavoriteButton={showFavoriteButton} />

          <Stack
            h={isChartFullscreen ? undefined : MARKET_DETAIL_LAYOUT.chartHeight}
            overflow="hidden"
            bg="$bgApp"
            zIndex={isChartFullscreen ? chartFullscreenZIndex : undefined}
            style={
              isChartFullscreen ? MARKET_CHART_FULLSCREEN_STYLE : undefined
            }
          >
            {isChartFullscreen && platformEnv.isDesktop ? (
              <Stack
                h={MARKET_DETAIL_LAYOUT.chartFullscreenHeaderFillHeight}
                bg="$bgApp"
                flexShrink={0}
              />
            ) : null}
            {marketTradingView}
          </Stack>

          <Stack
            minHeight={MARKET_DETAIL_LAYOUT.infoTabsHeight}
            borderTopWidth="$px"
            borderTopColor="$borderSubdued"
          >
            <LazyDesktopInformationTabs
              portfolioData={portfolioData}
              isRefreshing={isRefreshing}
              isBTCNetwork={isBTCNetwork}
              tokenLogoUrl={tokenDetail?.logoUrl}
            />
          </Stack>
        </YStack>

        {/* Right column */}
        <Stack w={340}>
          <Stack w={340} pb={platformEnv.isWeb ? '$12' : undefined}>
            <PerpetualTradingBanner pl="$3" pr="$5" />
            <Stack pl="$3" pr="$5" pt="$4" pb="$3">
              <SwapPanel swapToken={swapToken} />
            </Stack>

            <Divider my="$1" />

            {isStockToken ? (
              <StockTradingActivity />
            ) : (
              <>
                {isBTCMainnet ? null : (
                  <>
                    <TokenActivityOverview pl="$3" pr="$5" />
                    <Divider />
                  </>
                )}
                <TokenSupplementaryInfo />
              </>
            )}
          </Stack>
        </Stack>
      </XStack>
    </Stack>
  );
}
