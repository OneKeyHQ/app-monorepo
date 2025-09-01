import { memo } from 'react';

import { Skeleton, XStack } from '@onekeyhq/components';

interface IMarketTokenListNetworkSelectorNormalSkeletonProps {
  count?: number;
}

function MarketTokenListNetworkSelectorNormalSkeleton({
  count = 8,
}: IMarketTokenListNetworkSelectorNormalSkeletonProps) {
  return (
    <XStack py="$1" gap="$2" borderWidth={1} borderColor="$transparent">
      {Array.from({ length: count }).map((_, index) => (
        <XStack
          key={index}
          alignItems="center"
          justifyContent="center"
          px="$2.5"
          py="$1"
          gap="$2"
        >
          {/* Network image skeleton */}
          <Skeleton height="$5" width="$5" borderRadius="$full" />
          {/* Network name skeleton */}
          <Skeleton height="$3" width="$14" />
        </XStack>
      ))}
    </XStack>
  );
}

const MarketTokenListNetworkSelectorNormalSkeletonComponent = memo(
  MarketTokenListNetworkSelectorNormalSkeleton,
);

export { MarketTokenListNetworkSelectorNormalSkeletonComponent as MarketTokenListNetworkSelectorNormalSkeleton };
