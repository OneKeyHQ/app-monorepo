import type { FC } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';

interface ITokenListSkeletonProps {
  count?: number;
}

export const TokenListSkeleton: FC<ITokenListSkeletonProps> = ({
  count = 10,
}) => {
  return (
    <YStack>
      {Array.from({ length: count }).map((_, idx) => (
        <XStack key={idx} px="$3" py="$3" alignItems="center">
          {/* Left side: Token icon + text skeleton */}
          <XStack flex={1} alignItems="center" gap="$3">
            {/* Token icon with network badge */}
            <XStack position="relative">
              <Skeleton width={32} height={32} borderRadius="$full" />
            </XStack>
            {/* Token name and volume */}
            <YStack gap="$1">
              <Skeleton width={80} height={16} />
              <Skeleton width={60} height={12} />
            </YStack>
          </XStack>

          {/* Right side: Price skeleton */}
          <YStack alignItems="flex-end" gap="$1">
            <Skeleton width={80} height={18} />
            <Skeleton width={60} height={14} />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
};
