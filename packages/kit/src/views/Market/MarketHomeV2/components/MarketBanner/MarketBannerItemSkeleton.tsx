import { Skeleton, XStack, YStack } from '@onekeyhq/components';
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
          <Skeleton w="$16" h="$3.5" />
          <Skeleton w="$10" h="$3" />
        </YStack>
        <XStack>
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              w="$6"
              h="$6"
              radius="round"
              {...(i !== 0 && { ml: '$-3' })}
            />
          ))}
        </XStack>
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
      <XStack>
        {[0, 1, 2].map((i) => (
          <Skeleton
            key={i}
            w="$6"
            h="$6"
            radius="round"
            {...(i !== 0 && { ml: '$-3' })}
          />
        ))}
      </XStack>
    </XStack>
  );
}
