import { memo } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';

function PortfolioSkeletonBase() {
  return (
    <YStack gap="$3" p="$4">
      {Array.from({ length: 1 }).map((_, index) => (
        <XStack key={index} alignItems="center" gap="$3">
          {/* Amount */}
          <Skeleton height="$4" width="$20" />

          {/* Total Value */}
          <Skeleton height="$4" width="$20" />
        </XStack>
      ))}
    </YStack>
  );
}

const PortfolioSkeleton = memo(PortfolioSkeletonBase);

export { PortfolioSkeleton };
