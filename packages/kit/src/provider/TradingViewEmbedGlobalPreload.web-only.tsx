import { Suspense, lazy } from 'react';

const LazyTradingViewEmbedGlobalPreloadRuntime = lazy(() =>
  import(
    /* webpackChunkName: "tradingview-embed-global-preload" */ './TradingViewEmbedGlobalPreloadRuntime.web-only'
  ).then(({ TradingViewEmbedGlobalPreloadRuntime }) => ({
    default: TradingViewEmbedGlobalPreloadRuntime,
  })),
);

export function TradingViewEmbedGlobalPreload() {
  return (
    <Suspense fallback={null}>
      <LazyTradingViewEmbedGlobalPreloadRuntime />
    </Suspense>
  );
}
