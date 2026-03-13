import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

import { Divider, Stack, XStack, YStack } from '@onekeyhq/components';
import {
  TRADING_VIEW_LOCALHOST_ORIGIN,
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import {
  MarketTradingView,
  PerpetualTradingBanner,
  SwapPanel,
  TokenActivityOverview,
  TokenDetailHeader,
  TokenSupplementaryInfo,
} from '../components';
import { usePortfolioData } from '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData';
import { useNetworkAccount } from '../components/InformationTabs/hooks/useNetworkAccount';
import { DesktopInformationTabs } from '../components/InformationTabs/layout/DesktopInformationTabs';
import { useTokenDetail } from '../hooks/useTokenDetail';

const MARKET_DETAIL_LAYOUT = {
  chartHeight: 550,
  infoTabsHeight: 480,
} as const;

const SCROLL_CONTAINER_STYLE = { overflowY: 'auto' } as const;
const IFRAME_WHEEL_EVENT_TYPE = 'wheelEvent' as const;

interface IIframeWheelEventMessage {
  type: typeof IFRAME_WHEEL_EVENT_TYPE;
  deltaY: number;
}

const ALLOWED_TRADING_VIEW_ORIGINS = new Set([
  new URL(TRADING_VIEW_URL).origin,
  new URL(TRADING_VIEW_URL_TEST).origin,
  ...(platformEnv.isDev ? [TRADING_VIEW_LOCALHOST_ORIGIN] : []),
]);

// Listen for wheel events forwarded from TradingView iframe via postMessage.
// TradingView side needs: window.parent.postMessage({ type: 'wheelEvent', deltaY }, '*')
function useIframeWheelPassthrough(scrollRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (platformEnv.isNative) {
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
  }, [scrollRef]);
}

export function DesktopLayout() {
  const { tokenAddress, networkId, tokenDetail, isNative, websocketConfig } =
    useTokenDetail();

  const { accountAddress, xpub } = useNetworkAccount(networkId);

  const { portfolioData, isRefreshing } = usePortfolioData({
    tokenAddress,
    networkId,
    accountAddress,
    xpub,
  });

  const isBTCNetwork = networkUtils.isBTCNetwork(networkId);

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
  useIframeWheelPassthrough(scrollContainerRef);
  const handleTradingViewTouchScroll = useCallback((deltaY: number) => {
    scrollContainerRef.current?.scrollBy({ top: deltaY });
  }, []);

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
          <TokenDetailHeader />

          <Stack h={MARKET_DETAIL_LAYOUT.chartHeight} overflow="hidden">
            {networkId && tokenDetail?.symbol ? (
              <MarketTradingView
                tokenAddress={tokenAddress}
                networkId={networkId}
                tokenSymbol={tokenDetail?.symbol}
                isNative={isNative}
                dataSource={websocketConfig?.kline ? 'websocket' : 'polling'}
                onTouchScroll={handleTradingViewTouchScroll}
              />
            ) : null}
          </Stack>

          <Stack
            minHeight={MARKET_DETAIL_LAYOUT.infoTabsHeight}
            borderTopWidth="$px"
            borderTopColor="$borderSubdued"
          >
            <DesktopInformationTabs
              portfolioData={portfolioData}
              isRefreshing={isRefreshing}
              isBTCNetwork={isBTCNetwork}
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

            <TokenActivityOverview pl="$3" pr="$5" />

            <Divider />

            <TokenSupplementaryInfo />
          </Stack>
        </Stack>
      </XStack>
    </Stack>
  );
}
