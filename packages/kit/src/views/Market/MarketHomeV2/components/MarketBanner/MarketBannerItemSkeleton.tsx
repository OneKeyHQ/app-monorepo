import { Skeleton, XStack, YStack } from '@onekeyhq/components';
import { TokenGroupSkeleton } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function MarketBannerItemSkeleton({ compact }: { compact?: boolean }) {
  // Compact layout: Native or md screens
  if (platformEnv.isNative || compact) {
    return (
      <YStack
        bg="$bgSubdued"
        borderRadius="$3"
        p="$2.5"
        flex={1}
        justifyContent="space-between"
      >
        <YStack gap="$1">
          <Skeleton w="$16" h="$3" />
          <Skeleton w="$10" h="$3" />
        </YStack>
        <TokenGroupSkeleton size="xs" count={3} overlapOffset="$-3" />
      </YStack>
    );
  }

  // Desktop layout
  return (
    <XStack
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3"
      gap="$4"
      alignItems="center"
      justifyContent="space-between"
      flex={1}
    >
      <YStack gap="$1">
        <Skeleton w="$20" h="$4" />
        <Skeleton w="$12" h="$3" />
      </YStack>
      <TokenGroupSkeleton size="xs" count={3} overlapOffset="$-3" />
    </XStack>
  );
}
