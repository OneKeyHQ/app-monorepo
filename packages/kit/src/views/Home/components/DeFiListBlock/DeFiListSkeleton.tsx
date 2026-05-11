import { memo } from 'react';

import { StyleSheet } from 'react-native';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';

// Skeleton shapes are tuned to ProtocolDesktopLayout (the tableLayout
// branch in `Protocol.tsx`) and ProtocolRow (the mobile branch). When
// real data lands the cards/rows already sit in the same outer chrome
// (radius, border, bg, padding), so the cross-fade stays in place
// instead of reflowing the page.

const DESKTOP_CARD_COUNT = 2;
const MOBILE_ROW_COUNT = 4;

// Mirrors ProtocolHeaderRow geometry: $5 horizontal / $3 vertical
// padding, md token (~32 px), $headingLg name with a $bodyMd sub-label,
// and a right-aligned $headingLg net-worth value. The chevron column on
// the right is omitted from the skeleton — it would only suggest
// interaction the loading card can't deliver.
function DesktopProtocolSkeleton({ rows }: { rows: number }) {
  return (
    <Stack
      borderRadius="$3"
      borderCurve="continuous"
      overflow="hidden"
      bg="$bgApp"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$border"
      $theme-dark={{ borderColor: '$borderSubdued' }}
    >
      <XStack px="$5" py="$3" bg="$bgSubdued" alignItems="center" gap="$3">
        <Skeleton width={32} height={32} radius="round" />
        <YStack flex={1} gap="$1.5" minWidth={0}>
          <Skeleton height={20} width="38%" radius={4} />
          <Skeleton height={14} width="22%" radius={4} />
        </YStack>
        <Skeleton height={20} width={108} radius={4} />
      </XStack>
      <YStack pt="$3" pb="$3" gap="$3">
        {/* Category badge — Badge "lg" sits at ~22 × 72 px in this layout. */}
        <Skeleton height={22} width={72} radius={11} ml="$5" />
        {Array.from({ length: rows }).map((_, i) => (
          <XStack
            // eslint-disable-next-line react/no-array-index-key
            key={`row-${i}`}
            alignItems="center"
            mx="$5"
            px="$2"
          >
            {/* Position column — fixed 240 px to mirror
                ProtocolUnifiedTable's POSITION_COLUMN_WIDTH so the
                loaded-state token cell lands in the same x-position the
                skeleton sketched. */}
            <XStack
              width={240}
              flexShrink={0}
              alignItems="center"
              gap="$2"
              minWidth={0}
            >
              <Skeleton width={20} height={20} radius="round" />
              <Skeleton height={16} flex={1} maxWidth={140} radius={4} />
            </XStack>
            {/* Balance column — flex 1.5, matches the no-rewards skeleton
                shape; one line suggests content without implying a
                multi-asset position. */}
            <Stack flex={1.5} minWidth={0}>
              <Skeleton height={16} width={88} radius={4} />
            </Stack>
            {/* Value column — flex 1, right-aligned. */}
            <Stack flex={1} minWidth={0} alignItems="flex-end">
              <Skeleton height={16} width={72} radius={4} />
            </Stack>
          </XStack>
        ))}
      </YStack>
    </Stack>
  );
}

// Mirrors ProtocolRow: ListItem at minHeight 60, $5 horizontal / $2
// vertical padding, lg token (~40 px), $bodyLgMedium name with $bodySm
// sub-label, and a right-aligned $bodyLgMedium net worth.
function MobileProtocolSkeleton() {
  return (
    <XStack minHeight={60} px="$5" py="$2" gap="$3" alignItems="center">
      <Skeleton width={40} height={40} radius="round" />
      <YStack flex={1} gap="$1" minWidth={0}>
        <Skeleton height={16} width="48%" radius={4} />
        <Skeleton height={12} width="28%" radius={4} />
      </YStack>
      <Skeleton height={16} width={88} radius={4} />
    </XStack>
  );
}

export type IDeFiListSkeletonProps = {
  tableLayout?: boolean;
};

function DeFiListSkeletonBase({ tableLayout }: IDeFiListSkeletonProps) {
  if (tableLayout) {
    // Two cards approximate the typical 4-6 protocol wallet without
    // implying extra content. The first card carries one extra row so the
    // skeleton-period vertical extent more closely matches the eventual
    // accordion-open height; the second card stays tighter so a small
    // wallet doesn't visually shrink on data arrival.
    // Outer padding is supplied by the parent RichBlock's
    // `contentContainerProps={px: '$pagePadding'}` — same wrapper the
    // loaded protocol cards sit in — so loading and loaded branches
    // share one inset.
    return (
      <YStack gap="$5">
        {Array.from({ length: DESKTOP_CARD_COUNT }).map((_, i) => (
          <DesktopProtocolSkeleton
            // eslint-disable-next-line react/no-array-index-key
            key={`card-${i}`}
            rows={i === 0 ? 3 : 2}
          />
        ))}
      </YStack>
    );
  }

  return (
    <YStack>
      {Array.from({ length: MOBILE_ROW_COUNT }).map((_, i) => (
        <MobileProtocolSkeleton
          // eslint-disable-next-line react/no-array-index-key
          key={`row-${i}`}
        />
      ))}
    </YStack>
  );
}

const DeFiListSkeleton = memo(DeFiListSkeletonBase);
DeFiListSkeleton.displayName = 'DeFiListSkeleton';

export { DeFiListSkeleton };
