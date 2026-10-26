import { memo } from 'react';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';

// Line boxes of the loaded panel, so the body does not move when the first
// detail lands: the price line ($heading3xl), the 24h change ($bodyLgMedium
// under a 4pt gap), the badge row, and the stat rows ($bodySm) under a 4pt
// top padding with 4pt gaps.
const PRICE_LINE_HEIGHT = 36;
const CHANGE_LINE_HEIGHT = 28;
const TAG_ROW_HEIGHT = 20;
const STAT_ROW_HEIGHT = 16;
const STAT_ROW_COUNT = 4;

function InformationPanelSkeletonBase() {
  return (
    <XStack
      px="$5"
      py="$4"
      gap="$4"
      jc="space-between"
      ai="flex-start"
      width="100%"
    >
      <YStack>
        <Stack h={PRICE_LINE_HEIGHT} jc="center">
          <Skeleton width="$32" height={24} borderRadius="$2" />
        </Stack>
        <Stack h={CHANGE_LINE_HEIGHT} pt="$1" jc="center">
          <Skeleton width="$16" height={18} borderRadius="$1" />
        </Stack>
        <Stack h={TAG_ROW_HEIGHT} pt="$1" jc="center">
          <Skeleton width="$24" height={16} borderRadius="$1" />
        </Stack>
      </YStack>

      <YStack gap="$1" width="$40" pt="$1">
        {Array.from({ length: STAT_ROW_COUNT }).map((_, idx) => (
          <XStack
            key={idx}
            h={STAT_ROW_HEIGHT}
            gap="$1"
            ai="center"
            jc="space-between"
            width="100%"
          >
            <Skeleton width="$16" height={12} borderRadius="$1" />
            <Skeleton width="$12" height={12} borderRadius="$1" />
          </XStack>
        ))}
      </YStack>
    </XStack>
  );
}

const InformationPanelSkeleton = memo(InformationPanelSkeletonBase);

export { InformationPanelSkeleton };
