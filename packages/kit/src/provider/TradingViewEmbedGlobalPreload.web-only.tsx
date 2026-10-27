import { Suspense, lazy } from 'react';

import { useRouteIsFocused } from '../hooks/useRouteIsFocused';

const LazyTradingViewEmbedGlobalPreloadRuntime = lazy(async () => {
  const { TradingViewEmbedGlobalPreloadRuntime } = await import(
    /* webpackChunkName: "tradingview-global-preload" */ './TradingViewEmbedGlobalPreloadRuntime.web-only'
  );
  return { default: TradingViewEmbedGlobalPreloadRuntime };
});

function isMarketWebRoute() {
  const { hash, pathname } = globalThis.location;
  const routePath = hash.startsWith('#/') ? hash.slice(1) : pathname;
  return (
    routePath === '/' ||
    routePath === '/market' ||
    routePath.startsWith('/market/')
  );
}

export function TradingViewEmbedGlobalPreload() {
  const isFocused = useRouteIsFocused();

  if (!isFocused || !isMarketWebRoute()) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyTradingViewEmbedGlobalPreloadRuntime />
    </Suspense>
  );
}
