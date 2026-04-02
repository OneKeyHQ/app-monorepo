import { memo } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';

function InformationPanelSkeletonBase() {
  return (
    <XStack px="$5" py="$4" gap="$4" jc="space-between" width="100%">
      {/* Left price section skeleton */}
      <YStack gap="$2">
        <Skeleton width="$32" height="$9" borderRadius="$2" />
        <Skeleton width="$20" height="$4" borderRadius="$1" />
      </YStack>

      {/* Stats section skeleton */}
      <YStack gap="$1" width="$40">
        {Array.from({ length: 4 }).map((_, idx) => (
          <XStack key={idx} gap="$1" jc="space-between" width="100%">
            <Skeleton width="$20" height="$3" borderRadius="$1" />
            <Skeleton width="$20" height="$3" borderRadius="$1" />
          </XStack>
        ))}
      </YStack>
    </XStack>
  );
}

const InformationPanelSkeleton = memo(InformationPanelSkeletonBase);

export { InformationPanelSkeleton };
