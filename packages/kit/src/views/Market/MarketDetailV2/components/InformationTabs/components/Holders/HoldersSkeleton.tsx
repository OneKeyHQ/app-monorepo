import { memo } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';

function HoldersSkeleton() {
  return (
    <YStack gap="$3" p="$4">
      {Array.from({ length: 10 }).map((_, index) => (
        <XStack key={index} alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap="$3" flex={1}>
            <Skeleton height="$4" width="$6" />
            <Skeleton height="$4" width="$32" />
          </XStack>
          <YStack gap="$2" alignItems="flex-end">
            <Skeleton height="$4" width="$16" />
            <Skeleton height="$3" width="$20" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

export default memo(HoldersSkeleton);
