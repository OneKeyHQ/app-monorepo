import { memo } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';

function HoldersSkeletonBase() {
  return (
    <YStack gap="$3" p="$4">
      {Array.from({ length: 10 }).map((_, index) => (
        <XStack key={index} alignItems="center" gap="$3">
          {/* Rank */}
          <Skeleton height="$4" width="$6" />

          {/* Address */}
          <Skeleton height="$4" width="$32" />

          {/* Percentage */}
          <Skeleton height="$4" width="$16" />

          {/* Amount */}
          <Skeleton height="$4" width="$16" />

          {/* Value */}
          <Skeleton height="$4" width="$20" />
        </XStack>
      ))}
    </YStack>
  );
}

const HoldersSkeleton = memo(HoldersSkeletonBase);

export { HoldersSkeleton };
