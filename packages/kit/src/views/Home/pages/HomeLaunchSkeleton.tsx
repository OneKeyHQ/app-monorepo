import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';

const HOME_LAUNCH_SKELETON_ROWS = [0, 1, 2, 3] as const;
const HOME_LAUNCH_SKELETON_ACTIONS = [0, 1, 2, 3] as const;

export function HomeLaunchSkeleton() {
  return (
    <YStack
      flex={1}
      bg="$bgApp"
      pointerEvents="none"
      testID="home-launch-skeleton"
    >
      <YStack px="$pagePadding" pt="$4" pb="$5" gap="$5">
        <XStack alignItems="center" gap="$3">
          <Skeleton w="$10" h="$10" radius="round" />
          <YStack gap="$2">
            <Skeleton w={112} h="$4" />
            <Skeleton w={72} h="$3" />
          </YStack>
        </XStack>
        <Skeleton w={180} h="$9" />
        <XStack gap="$3">
          {HOME_LAUNCH_SKELETON_ACTIONS.map((action) => (
            <YStack key={action} flex={1} alignItems="center" gap="$2">
              <Skeleton w="$10" h="$10" radius={12} />
              <Skeleton w={44} h="$3" />
            </YStack>
          ))}
        </XStack>
      </YStack>
      <XStack
        h={52}
        px="$pagePadding"
        gap="$5"
        alignItems="center"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        <Skeleton h="$4" w="$12" />
        <Skeleton h="$4" w="$16" />
        <Skeleton h="$4" w="$12" />
        <Skeleton h="$4" w="$16" />
      </XStack>
      <YStack px="$pagePadding" pt="$5" gap="$5">
        {HOME_LAUNCH_SKELETON_ROWS.map((row) => (
          <XStack key={row} alignItems="center" gap="$3">
            <Skeleton w="$10" h="$10" radius="round" />
            <YStack flex={1} gap="$2">
              <Skeleton w={row % 2 === 0 ? 112 : 136} h="$4" />
              <Skeleton w={72} h="$3" />
            </YStack>
            <Stack alignItems="flex-end" gap="$2">
              <Skeleton w={76} h="$4" />
              <Skeleton w={52} h="$3" />
            </Stack>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
