import { memo } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';

import { MarketTestIDs } from '../../testIDs';

function MarketBannerItemSkeletonComponent() {
  return (
    <YStack
      testID={MarketTestIDs.bannerItemSkeleton}
      bg="$bgSubdued"
      borderRadius="$3"
      px="$4"
      py="$5"
      width={336}
      flexShrink={0}
      gap="$5"
    >
      <XStack h="$6" alignItems="center">
        <Skeleton w="$40" h="$4" />
      </XStack>
      <YStack gap="$4" minHeight={104}>
        {[0, 1, 2].map((index) => (
          <XStack key={index} h="$6" gap="$2" alignItems="center">
            <Skeleton w="$6" h="$6" radius="round" />
            <Skeleton w="$16" h="$3" />
            <XStack flex={1} />
            <Skeleton w="$16" h="$3" />
            <Skeleton w="$20" h="$3" />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

export const MarketBannerItemSkeleton = memo(MarketBannerItemSkeletonComponent);
