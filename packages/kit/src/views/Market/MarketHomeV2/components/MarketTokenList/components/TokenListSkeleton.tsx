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
        <XStack key={idx} px="$5" py="$3" alignItems="center">
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

          {/* Right side: Price + Change badge */}
          <XStack alignItems="center" gap="$2">
            <Skeleton width={80} height={18} />
            <Skeleton width={80} height={18} borderRadius="$2" />
          </XStack>
        </XStack>
      ))}
    </YStack>
  );
};
