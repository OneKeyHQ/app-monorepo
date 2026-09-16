import { memo } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';
import { s } from '@onekeyhq/components/src/utils/scale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketTestIDs } from '../../testIDs';

import {
  MARKET_BANNER_DESKTOP_WEB_ITEM_WIDTH,
  MARKET_BANNER_DESKTOP_WEB_LIST_MIN_HEIGHT,
  MARKET_BANNER_ITEM_WIDTH,
  MARKET_BANNER_LIST_MIN_HEIGHT,
  MARKET_BANNER_MOBILE_ITEM_WIDTH,
} from './marketBannerLayout';

function MarketBannerItemSkeletonComponent({
  isSmallScreen = false,
}: {
  isSmallScreen?: boolean;
}) {
  // Mirrors MarketBannerItem: desktop web cards have no background.
  const isDesktopWeb = !isSmallScreen && !platformEnv.isNative;
  let cardWidth = MARKET_BANNER_ITEM_WIDTH;
  if (isSmallScreen) cardWidth = MARKET_BANNER_MOBILE_ITEM_WIDTH;
  if (isDesktopWeb) cardWidth = MARKET_BANNER_DESKTOP_WEB_ITEM_WIDTH;

  return (
    <YStack
      testID={MarketTestIDs.bannerItemSkeleton}
      bg={isDesktopWeb ? undefined : '$bgSubdued'}
      borderRadius="$3"
      borderCurve="continuous"
      pt={isDesktopWeb ? '$1' : '$3.5'}
      px={isDesktopWeb ? '$0' : '$3.5'}
      pb={isDesktopWeb ? '$2' : '$5'}
      width={cardWidth}
      flexShrink={0}
      gap={isDesktopWeb ? '$5' : '$6'}
    >
      <XStack h={isDesktopWeb ? '$5' : s(30)} alignItems="center">
        <Skeleton w="$24" h="$4" />
      </XStack>
      <YStack
        gap={isDesktopWeb ? '$5' : '$4'}
        pr="$1.5"
        minHeight={
          isDesktopWeb
            ? MARKET_BANNER_DESKTOP_WEB_LIST_MIN_HEIGHT
            : MARKET_BANNER_LIST_MIN_HEIGHT
        }
      >
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
