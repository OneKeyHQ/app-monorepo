import { Suspense, lazy } from 'react';

import type { ITradingViewNativeProps } from './types';

const LazyTradingViewNativeContainer = lazy(async () => {
  const { TradingViewNativeContainer } =
    await import('./TradingViewNativeContainer');
  return { default: TradingViewNativeContainer };
});

export function TradingViewNative(props: ITradingViewNativeProps) {
  return (
    <Suspense fallback={null}>
      <LazyTradingViewNativeContainer {...props} />
    </Suspense>
  );
}
