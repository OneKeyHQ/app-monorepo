import { useCallback, useEffect, useState } from 'react';

import { Spinner, Stack } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MARKET_DESKTOP_CHART_MIN_HEIGHT } from '../../../marketDesktopLayoutConstants';

import type { IMarketTradingViewProps } from './MarketTradingView';

const SLOW_CHART_LOADING_DELAY_MS = 1500;

export function ChartLoadingFallback({ minHeight }: { minHeight: number }) {
  return (
    <Stack
      minHeight={minHeight}
      flex={1}
      alignItems="center"
      justifyContent="center"
    >
      {platformEnv.isWeb ? null : <Spinner size="large" />}
    </Stack>
  );
}

const loadMarketTradingViewModule = () =>
  import(
    /* webpackChunkName: "market-detail-v2-tradingview" */ './MarketTradingView'
  );

const LazyDesktopMarketTradingViewModule = LazyLoad<IMarketTradingViewProps>(
  () =>
    loadMarketTradingViewModule().then(({ MarketTradingView }) => ({
      default: MarketTradingView,
    })),
  undefined,
  <ChartLoadingFallback minHeight={MARKET_DESKTOP_CHART_MIN_HEIGHT} />,
);

const LazyMobileMarketTradingViewModule = LazyLoad<IMarketTradingViewProps>(
  () =>
    loadMarketTradingViewModule().then(({ MarketTradingView }) => ({
      default: (props: IMarketTradingViewProps) => (
        <MarketTradingView {...props} />
      ),
    })),
  undefined,
  <ChartLoadingFallback minHeight={240} />,
);

function WebMarketTradingViewLoadingBoundary({
  Chart,
  minHeight,
  onChartError,
  onVisualReady,
  ...props
}: IMarketTradingViewProps & {
  Chart: typeof LazyDesktopMarketTradingViewModule;
  minHeight: number;
}) {
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [showSlowLoading, setShowSlowLoading] = useState(false);

  useEffect(() => {
    setIsChartVisible(false);
    setShowSlowLoading(false);
    const timer = setTimeout(() => {
      setShowSlowLoading(true);
    }, SLOW_CHART_LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [props.networkId, props.tokenAddress]);

  const handleVisualReady = useCallback(() => {
    setIsChartVisible(true);
    setShowSlowLoading(false);
    onVisualReady?.();
  }, [onVisualReady]);

  const handleChartError = useCallback(() => {
    setIsChartVisible(true);
    setShowSlowLoading(false);
    onChartError?.();
  }, [onChartError]);

  return (
    <Stack position="relative" minHeight={minHeight} flex={1}>
      <Chart
        {...props}
        onChartError={handleChartError}
        onVisualReady={handleVisualReady}
      />
      {showSlowLoading && !isChartVisible ? (
        <Stack
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          <Spinner size="large" />
        </Stack>
      ) : null}
    </Stack>
  );
}

function createLazyMarketTradingView(
  Chart: typeof LazyDesktopMarketTradingViewModule,
  minHeight: number,
) {
  return function LazyMarketTradingView(props: IMarketTradingViewProps) {
    if (!platformEnv.isWeb) {
      return <Chart {...props} />;
    }
    return (
      <WebMarketTradingViewLoadingBoundary
        {...props}
        Chart={Chart}
        minHeight={minHeight}
      />
    );
  };
}

export const LazyDesktopMarketTradingView = createLazyMarketTradingView(
  LazyDesktopMarketTradingViewModule,
  MARKET_DESKTOP_CHART_MIN_HEIGHT,
);

export const LazyMobileMarketTradingView = createLazyMarketTradingView(
  LazyMobileMarketTradingViewModule,
  240,
);

export async function preloadMarketTradingView() {
  await Promise.all([
    LazyDesktopMarketTradingViewModule.preload(),
    LazyMobileMarketTradingViewModule.preload(),
  ]);
}
