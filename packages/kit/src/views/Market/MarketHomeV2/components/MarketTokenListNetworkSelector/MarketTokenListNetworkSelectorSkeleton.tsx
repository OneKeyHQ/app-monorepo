import { memo } from 'react';

import { Skeleton, XStack } from '@onekeyhq/components';

interface IMarketTokenListNetworkSelectorSkeletonProps {
  count?: number;
}

function MarketTokenListNetworkSelectorSkeleton({
  count = 6,
}: IMarketTokenListNetworkSelectorSkeletonProps) {
  return (
    <XStack
      py="$1"
      gap="$2"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$2"
    >
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

const MarketTokenListNetworkSelectorSkeletonComponent = memo(
  MarketTokenListNetworkSelectorSkeleton,
);

export default MarketTokenListNetworkSelectorSkeletonComponent;
