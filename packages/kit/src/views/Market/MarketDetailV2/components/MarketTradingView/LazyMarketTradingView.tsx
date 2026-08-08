import { Spinner, Stack } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import type { IMarketTradingViewProps } from './MarketTradingView';

function ChartLoadingFallback({ minHeight }: { minHeight: number }) {
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

const loadMarketTradingViewModule = () =>
  import(
    /* webpackChunkName: "market-detail-v2-tradingview" */ './MarketTradingView'
  );

export const LazyDesktopMarketTradingView = LazyLoad<IMarketTradingViewProps>(
  () =>
    loadMarketTradingViewModule().then(({ MarketTradingView }) => ({
      default: MarketTradingView,
    })),
  undefined,
  <ChartLoadingFallback minHeight={550} />,
);

export const LazyMobileMarketTradingView = LazyLoad<IMarketTradingViewProps>(
  () =>
    loadMarketTradingViewModule().then(({ MarketTradingView }) => ({
      default: (props: IMarketTradingViewProps) => (
        <MarketTradingView {...props} />
      ),
    })),
  undefined,
  <ChartLoadingFallback minHeight={240} />,
);

export async function preloadMarketTradingView() {
  await Promise.all([
    LazyDesktopMarketTradingView.preload(),
    LazyMobileMarketTradingView.preload(),
  ]);
}
