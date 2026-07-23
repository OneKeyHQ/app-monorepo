import {
  Divider,
  Skeleton,
  Spinner,
  Stack,
  TAB_BAR_ITEM_HEIGHT,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { MarketBannerItemSkeleton } from './MarketBanner/MarketBannerItemSkeleton';

const BANNER_SKELETON_COUNT = 3;
const TAB_LABEL_SKELETON_WIDTHS = [32, 32, 32, 32] as const;

export function MarketHomeLoadingFallback() {
  return (
    <YStack flex={1} bg="$bgApp" testID="market-home-loading-fallback">
      <XStack
        flexShrink={0}
        alignItems="center"
        px="$4"
        py="$2"
        gap="$3"
        overflow="hidden"
        testID="market-home-banner-skeleton"
      >
        {Array.from({ length: BANNER_SKELETON_COUNT }, (_, index) => (
          <MarketBannerItemSkeleton key={index} />
        ))}
      </XStack>
      <YStack flexShrink={0} testID="market-home-tab-bar-skeleton">
        <XStack h={TAB_BAR_ITEM_HEIGHT} alignItems="center" px="$5" gap="$5">
          {TAB_LABEL_SKELETON_WIDTHS.map((width, index) => (
            <Skeleton key={index} h="$4" w={width} radius="round" />
          ))}
        </XStack>
        <Divider />
      </YStack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </Stack>
    </YStack>
  );
}
