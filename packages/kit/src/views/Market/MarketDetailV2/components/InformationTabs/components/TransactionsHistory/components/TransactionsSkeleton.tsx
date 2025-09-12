import { memo } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';

function TransactionsSkeletonBase() {
  return (
    <YStack gap="$3" p="$4">
      {Array.from({ length: 5 }).map((_, index) => (
        <XStack key={index} alignItems="center" justifyContent="space-between">
          <YStack gap="$2" flex={1}>
            <Skeleton height="$4" width="$16" />
            <Skeleton height="$3" width="$24" />
          </YStack>
          <YStack gap="$2" alignItems="flex-end">
            <Skeleton height="$4" width="$12" />
            <Skeleton height="$3" width="$16" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

const TransactionsSkeleton = memo(TransactionsSkeletonBase);

export { TransactionsSkeleton };
