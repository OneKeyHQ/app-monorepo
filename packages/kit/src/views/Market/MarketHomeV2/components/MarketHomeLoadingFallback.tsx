import {
  Divider,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

const MARKET_HOME_TAB_BAR_HEIGHT = 44;
const MARKET_HOME_BANNER_HEIGHT = 134;
const MARKET_HOME_BANNER_ITEM_HEIGHT = 118;
const MARKET_HOME_BANNER_ITEM_WIDTH = 128;
const BANNER_SKELETON_COUNT = 3;
const TAB_LABEL_SKELETON_WIDTHS = [32, 32, 32, 32] as const;

export function MarketHomeLoadingFallback() {
  return (
    <YStack flex={1} bg="$bgApp" testID="market-home-loading-fallback">
      <XStack
        h={MARKET_HOME_BANNER_HEIGHT}
        flexShrink={0}
        alignItems="center"
        px="$4"
        py="$2"
        gap="$3"
        overflow="hidden"
        testID="market-home-banner-skeleton"
      >
        {Array.from({ length: BANNER_SKELETON_COUNT }, (_, index) => (
          <Skeleton
            key={index}
            h={MARKET_HOME_BANNER_ITEM_HEIGHT}
            w={MARKET_HOME_BANNER_ITEM_WIDTH}
            flexShrink={0}
            radius={12}
          />
        ))}
      </XStack>
      <YStack flexShrink={0} testID="market-home-tab-bar-skeleton">
        <XStack
          h={MARKET_HOME_TAB_BAR_HEIGHT}
          alignItems="center"
          px="$5"
          gap="$5"
        >
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
