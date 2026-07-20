import { Suspense, lazy, memo } from 'react';

import type { IMarketStarV2Props } from './MarketStarV2.types';

const LazyMarketStarV2 = lazy(async () => {
  const { MarketStarV2 } = await import('./MarketStarV2');
  return { default: MarketStarV2 };
});

function BasicMarketStarV2Deferred(props: IMarketStarV2Props) {
  return (
    <Suspense fallback={null}>
      <LazyMarketStarV2 {...props} />
    </Suspense>
  );
}

// Native search/token-selector segments use this async wrapper so they do not
// sync-require the MarketDetail segment that owns the shared star component.
export const MarketStarV2Deferred = memo(BasicMarketStarV2Deferred);
