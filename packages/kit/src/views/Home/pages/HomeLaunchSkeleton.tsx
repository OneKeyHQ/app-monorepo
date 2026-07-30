import { Stack, XStack, YStack } from '@onekeyhq/components';

import { HomeTestIDs } from '../testIDs';

const HOME_LAUNCH_SKELETON_ROWS = [0, 1, 2, 3] as const;
const HOME_LAUNCH_SKELETON_ACTION_WIDTHS = [108, 128, 144, 48] as const;
const HOME_LAUNCH_SKELETON_BANNERS = [0, 1, 2, 3] as const;
const HOME_LAUNCH_SKELETON_TABS = [64, 64, 56, 48, 76] as const;
const HOME_LAUNCH_SKELETON_MD_TABS = [40, 48, 36, 30, 56] as const;

export function HomeLaunchSkeleton() {
  return (
    <YStack
      flex={1}
      bg="$bgApp"
      pointerEvents="none"
      testID={HomeTestIDs.launchSkeleton}
    >
      <XStack
        h={72}
        px="$pagePadding"
        alignItems="center"
        gap="$2"
        testID={HomeTestIDs.launchSkeletonAccount}
        $md={{
          h: 52,
          justifyContent: 'space-between',
        }}
      >
        <XStack alignItems="center" gap="$2">
          <Stack
            w="$8"
            h="$8"
            borderRadius={8}
            bg="$bgSubdued"
            $md={{ w: '$6', h: '$6', borderRadius: 6 }}
          />
          <Stack
            w={112}
            h="$5"
            borderRadius={4}
            bg="$bgSubdued"
            $md={{ w: 88 }}
          />
          <Stack w="$4" h="$4" borderRadius={4} bg="$bgSubdued" />
        </XStack>
        <XStack alignItems="center" gap="$1">
          <Stack
            w="$8"
            h="$8"
            borderRadius={999}
            bg="$bgSubdued"
            $md={{ w: '$6', h: '$6' }}
          />
          <Stack
            w="$8"
            h="$8"
            borderRadius={999}
            bg="$bgSubdued"
            $md={{ w: '$6', h: '$6' }}
          />
          <Stack
            w="$12"
            h="$7"
            borderRadius={999}
            bg="$bgSubdued"
            $md={{ w: '$9', h: '$6' }}
          />
        </XStack>
      </XStack>
      <YStack px="$pagePadding" pt="$5" gap="$5" $md={{ pt: '$4', gap: '$4' }}>
        <Stack
          w={180}
          h={48}
          testID={HomeTestIDs.launchSkeletonBalance}
          $md={{ w: 160 }}
        >
          <Stack w="100%" h="100%" borderRadius={8} bg="$bgSubdued" />
        </Stack>
        <XStack
          gap="$3"
          alignItems="center"
          testID={HomeTestIDs.launchSkeletonActions}
        >
          {HOME_LAUNCH_SKELETON_ACTION_WIDTHS.map((width, index) => (
            <Stack
              key={width}
              w={width}
              h={48}
              borderRadius={999}
              bg="$bgSubdued"
              $sm={{
                flex: 1,
                w:
                  index === HOME_LAUNCH_SKELETON_ACTION_WIDTHS.length - 1
                    ? 48
                    : undefined,
              }}
            />
          ))}
        </XStack>
      </YStack>
      <XStack
        pt="$8"
        pb="$8"
        px="$pagePadding"
        gap="$3"
        overflow="hidden"
        testID={HomeTestIDs.launchSkeletonBanners}
        $md={{ pt: '$6' }}
      >
        {HOME_LAUNCH_SKELETON_BANNERS.map((banner) => (
          <Stack
            key={banner}
            w={280}
            flexShrink={0}
            h={90}
            borderRadius={16}
            bg="$bgSubdued"
          />
        ))}
      </XStack>
      <XStack
        h={52}
        px="$pagePadding"
        gap="$2"
        alignItems="center"
        testID={HomeTestIDs.launchSkeletonTabs}
        $md={{ gap: '$5' }}
      >
        {HOME_LAUNCH_SKELETON_TABS.map((width, index) => (
          <Stack
            key={`${width}-${index}`}
            h={index === 0 ? 36 : '$5'}
            w={width}
            borderRadius={index === 0 ? 999 : 4}
            bg="$bgSubdued"
            $md={{
              h: '$5',
              w: HOME_LAUNCH_SKELETON_MD_TABS[index],
              borderRadius: 4,
            }}
          />
        ))}
      </XStack>
      <YStack
        px="$pagePadding"
        pt={72}
        gap="$5"
        testID={HomeTestIDs.launchSkeletonList}
        $md={{ pt: '$8' }}
      >
        <XStack justifyContent="space-between" alignItems="center">
          <Stack h="$4" w="$20" borderRadius="$1" bg="$bgSubdued" />
          <Stack h="$4" w="$12" borderRadius="$1" bg="$bgSubdued" />
        </XStack>
        {HOME_LAUNCH_SKELETON_ROWS.map((row) => (
          <XStack key={row} alignItems="center" gap="$3">
            <Stack w="$10" h="$10" borderRadius={999} bg="$bgSubdued" />
            <YStack flex={1} gap="$2">
              <Stack
                w={row % 2 === 0 ? 112 : 136}
                h="$4"
                borderRadius="$1"
                bg="$bgSubdued"
              />
              <Stack w={72} h="$3" borderRadius="$1" bg="$bgSubdued" />
            </YStack>
            <Stack alignItems="flex-end" gap="$2">
              <Stack w={76} h="$4" borderRadius="$1" bg="$bgSubdued" />
              <Stack w={52} h="$3" borderRadius="$1" bg="$bgSubdued" />
            </Stack>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
