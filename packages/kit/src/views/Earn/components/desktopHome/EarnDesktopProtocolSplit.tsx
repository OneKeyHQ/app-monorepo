import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { formatSharePercent } from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';

import type { IEarnDesktopShares } from './earnDesktopHome.utils';

// Lightness steps, the biggest share brightest. Color on these pages means
// status (earnings, risk), so the protocols' logos tell them apart instead
const SHARE_COLORS = ['$neutral11', '$neutral9', '$neutral7'] as const;
const REST_SHARE_COLOR = '$neutral5';

// Skeletons in the loaded boxes, so nothing below moves as they load
export function SkeletonLine({
  height,
  width,
  barHeight,
}: {
  height: number;
  width: number | string;
  barHeight: number;
}) {
  return (
    <YStack h={height} jc="center">
      <Skeleton w={width} h={barHeight} borderRadius="$2" />
    </YStack>
  );
}

export function ProtocolSplitSkeleton() {
  return (
    <YStack gap="$3.5">
      <Skeleton h="$2.5" w="100%" borderRadius="$full" />
      <XStack gap="$8">
        {Array.from({ length: 3 }).map((_, index) => (
          <YStack key={index} gap="$1">
            <SkeletonLine height={20} width={96} barHeight={14} />
            <SkeletonLine height={24} width={40} barHeight={16} />
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}

// Where a total sits: the biggest shares by name, the rest as "N more". The
// home's hero and My portfolio draw the same bar
export function ProtocolSplit({ shares }: { shares: IEarnDesktopShares }) {
  const restValue =
    shares.total - shares.top.reduce((sum, item) => sum + item.value, 0);
  return (
    <YStack gap="$3.5">
      <XStack h="$2.5" gap="$0.5" borderRadius="$full" overflow="hidden">
        {shares.top.map((item, index) => (
          <YStack key={item.key} flex={item.value} bg={SHARE_COLORS[index]} />
        ))}
        {shares.rest ? <YStack flex={restValue} bg={REST_SHARE_COLOR} /> : null}
      </XStack>
      {/* Four a row at a phone's width too */}
      <XStack gap="$8" $md={{ gap: '$5' }} flexWrap="wrap">
        {shares.top.map((item) => (
          <YStack key={item.key} gap="$1">
            <XStack gap="$1.5" ai="center">
              <Token size="xs" tokenImageUri={item.logoURI} />
              <SizableText size="$bodyMd" color="$textSubdued">
                {item.name}
              </SizableText>
            </XStack>
            <SizableText size="$bodyLgMedium">
              {formatSharePercent(item.percent)}
            </SizableText>
          </YStack>
        ))}
        {shares.rest ? (
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {EARN_DESKTOP_DEMO_COPY.more(shares.rest.count)}
            </SizableText>
            <SizableText size="$bodyLgMedium">
              {formatSharePercent(shares.rest.percent)}
            </SizableText>
          </YStack>
        ) : null}
      </XStack>
    </YStack>
  );
}
