import { memo } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';
import { s } from '@onekeyhq/components/src/utils/scale';

import { MarketTestIDs } from '../../testIDs';

import {
  MARKET_BANNER_ITEM_WIDTH,
  MARKET_BANNER_LIST_MIN_HEIGHT,
  MARKET_BANNER_MOBILE_ITEM_WIDTH,
} from './marketBannerLayout';

function MarketBannerItemSkeletonComponent({
  isSmallScreen = false,
}: {
  isSmallScreen?: boolean;
}) {
  return (
    <YStack
      testID={MarketTestIDs.bannerItemSkeleton}
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      pt="$3.5"
      px="$3.5"
      pb="$5"
      width={
        isSmallScreen
          ? MARKET_BANNER_MOBILE_ITEM_WIDTH
          : MARKET_BANNER_ITEM_WIDTH
      }
      flexShrink={0}
      gap="$6"
    >
      <XStack h={s(30)} alignItems="center">
        <Skeleton w="$24" h="$4" />
      </XStack>
      <YStack gap="$4" pr="$1.5" minHeight={MARKET_BANNER_LIST_MIN_HEIGHT}>
        {[0, 1, 2].map((index) => (
          <XStack key={index} h="$5" gap="$2" alignItems="center">
            <Skeleton w="$5" h="$5" radius="round" />
            <Skeleton w="$12" h="$3" />
            <XStack flex={1} />
            <Skeleton w="$14" h="$3" />
            <Skeleton w="$12" h="$3" />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

export const MarketBannerItemSkeleton = memo(MarketBannerItemSkeletonComponent);
