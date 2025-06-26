import { memo } from 'react';

import { Skeleton, XStack } from '@onekeyhq/components';

function MarketTokenListNetworkSelectorSmallSkeleton() {
  return (
    <XStack alignItems="center" gap="$3">
      {/* Network Icon and Name Skeleton */}
      <XStack alignItems="center" gap="$2">
        <Skeleton height="$6" width="$6" borderRadius="$full" />
        <Skeleton height="$4" width="$16" borderRadius="$1" />
      </XStack>

      {/* More Button Skeleton */}
      <Skeleton height="$8" width="$16" borderRadius="$2" />
    </XStack>
  );
}

const MarketTokenListNetworkSelectorSmallSkeletonComponent = memo(
  MarketTokenListNetworkSelectorSmallSkeleton,
);

export { MarketTokenListNetworkSelectorSmallSkeletonComponent as MarketTokenListNetworkSelectorSmallSkeleton };
