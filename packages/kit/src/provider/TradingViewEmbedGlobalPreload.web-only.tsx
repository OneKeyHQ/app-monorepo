import { Suspense, lazy } from 'react';

const LazyTradingViewEmbedGlobalPreloadRuntime = lazy(() =>
  import(
    /* webpackChunkName: "tradingview-embed-global-preload" */ './TradingViewEmbedGlobalPreloadRuntime.web-only'
  ).then(({ TradingViewEmbedGlobalPreloadRuntime }) => ({
    default: TradingViewEmbedGlobalPreloadRuntime,
  })),
);

export function TradingViewEmbedGlobalPreload() {
  if (!globalThis.location.pathname.startsWith('/market')) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyTradingViewEmbedGlobalPreloadRuntime />
    </Suspense>
  );
}
