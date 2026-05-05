import { memo } from 'react';

import { Skeleton, XStack } from '@onekeyhq/components';

interface IMarketTokenListNetworkSelectorNormalSkeletonProps {
  count?: number;
}

function MarketTokenListNetworkSelectorNormalSkeleton({
  count = 8,
}: IMarketTokenListNetworkSelectorNormalSkeletonProps) {
  return (
    <XStack
      p="$1"
      gap="$1"
      mt="$3"
      mb="$2"
      borderWidth={1}
      borderColor="$neutral4"
      borderRadius="$3"
      overflow="hidden"
    >
      {Array.from({ length: count }).map((_, index) => (
        <XStack
          key={index}
          alignItems="center"
          justifyContent="center"
          px="$2.5"
          py="$1.5"
          gap="$2"
        >
          {/* Network image skeleton */}
          <Skeleton height="$4.5" width="$4.5" borderRadius="$full" />
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
