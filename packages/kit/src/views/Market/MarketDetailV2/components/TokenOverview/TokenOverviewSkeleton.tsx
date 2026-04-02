import { memo } from 'react';

import { Skeleton, Stack, XStack } from '@onekeyhq/components';

function StatCardSkeleton() {
  return (
    <Stack
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3"
      flex={1}
      minHeight="$16"
      justifyContent="space-between"
      alignItems="center"
    >
      <Skeleton height="$4" width="$20" mb="$2" />
      <Skeleton height="$5" width="$16" />
    </Stack>
  );
}

function TokenOverviewSkeletonBase() {
  return (
    <Stack gap="$3" px="$5" py="$3">
      {/* Token Header Skeleton */}
      <XStack alignItems="center" gap="$3" mb="$2">
        <Skeleton height="$10" width="$10" radius="round" />
        <Stack flex={1}>
          <Skeleton height="$6" width="$32" mb="$1" />
          <Skeleton height="$4" width="$20" />
        </Stack>
      </XStack>

      {/* First row: Audit and Holders */}
      <XStack gap="$3">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </XStack>

      {/* Second row: Market cap and Liquidity */}
      <XStack gap="$3">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </XStack>

      {/* Third row: Circulating supply and Maximum supply */}
      <XStack gap="$3">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </XStack>
    </Stack>
  );
}

export const TokenOverviewSkeleton = memo(TokenOverviewSkeletonBase);
