import type { ReactNode } from 'react';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';

import {
  MARKET_LIST_HEADER_ROW_HEIGHT,
  MARKET_LIST_METRIC_COLUMN_PROPS,
  MARKET_LIST_NAME_COLUMN_WIDTH,
  MARKET_LIST_ROW_HEIGHT,
  MARKET_LIST_STAR_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '../../../marketDesktopLayoutConstants';
import { MARKET_CELL_LOGO_GAP } from '../MarketListCell';

const FALLBACK_ROW_COUNT = 8;
// The desktop Favorites table's Price / 24h change / 24h volume skeletons.
const DESKTOP_METRIC_SKELETON_WIDTHS = [70, 60, 90] as const;

export function MarketListLoadingFallback() {
  return (
    <YStack width="100%" pt="$4">
      <XStack height={44} alignItems="center" gap="$8" px="$3">
        <Skeleton width={56} height={16} />
        <Skeleton width={120} height={16} />
        <Skeleton flex={1} maxWidth={96} height={16} />
        <Skeleton flex={1} maxWidth={96} height={16} />
        <Skeleton flex={1} maxWidth={96} height={16} />
      </XStack>
      {Array.from({ length: FALLBACK_ROW_COUNT }, (_, index) => (
        <XStack
          key={`market-list-loading-row-${index}`}
          height={60}
          alignItems="center"
          gap="$8"
          px="$3"
        >
          <Skeleton width={24} height={24} borderRadius="$full" />
          <XStack width={152} alignItems="center" gap="$3">
            <Skeleton width={32} height={32} borderRadius="$full" />
            <YStack gap="$1">
              <Skeleton width={72} height={16} />
              <Skeleton width={88} height={12} />
            </YStack>
          </XStack>
          <Skeleton flex={1} maxWidth={96} height={16} />
          <Skeleton flex={1} maxWidth={96} height={16} />
          <Skeleton flex={1} maxWidth={96} height={16} />
        </XStack>
      ))}
    </YStack>
  );
}

function DesktopTableRow({
  height,
  star,
  name,
  metricHeight,
  metricWidths,
}: {
  height: number;
  star: ReactNode;
  name: ReactNode;
  metricHeight: number;
  metricWidths: readonly number[];
}) {
  return (
    <XStack height={height} alignItems="center">
      <Stack
        width={MARKET_LIST_STAR_COLUMN_WIDTH}
        flexShrink={0}
        pl="$2"
        alignItems="flex-start"
      >
        {star}
      </Stack>
      <XStack
        width={MARKET_LIST_NAME_COLUMN_WIDTH}
        flexShrink={0}
        pr="$2"
        alignItems="center"
      >
        {name}
      </XStack>
      {metricWidths.map((width, index) => (
        <XStack
          key={`metric-${index}`}
          {...MARKET_LIST_METRIC_COLUMN_PROPS}
          alignItems="center"
        >
          <Skeleton width={width} height={metricHeight} />
        </XStack>
      ))}
    </XStack>
  );
}

/**
 * Loading state for the desktop Favorites table. It follows the table's own
 * frame (fixed star and name columns, metric columns sharing the rest) so the
 * skeleton spans the page and the real rows land in the same columns.
 */
export function MarketDesktopTableLoadingFallback() {
  return (
    <YStack width="100%">
      <DesktopTableRow
        height={MARKET_LIST_HEADER_ROW_HEIGHT}
        star={<Skeleton width={MARKET_LIST_STAR_SLOT_WIDTH} height={12} />}
        name={<Skeleton width={48} height={12} />}
        metricHeight={12}
        metricWidths={[48, 48, 48]}
      />
      {Array.from({ length: FALLBACK_ROW_COUNT }, (_, index) => (
        <DesktopTableRow
          key={`market-desktop-table-loading-row-${index}`}
          height={MARKET_LIST_ROW_HEIGHT}
          star={
            <Skeleton
              width={MARKET_LIST_STAR_SLOT_WIDTH}
              height={MARKET_LIST_STAR_SLOT_WIDTH}
              borderRadius="$full"
            />
          }
          name={
            <XStack alignItems="center" gap={MARKET_CELL_LOGO_GAP}>
              <Skeleton width={40} height={40} borderRadius="$full" />
              <YStack gap="$1">
                <Skeleton width={80} height={16} />
                <Skeleton width={60} height={12} />
              </YStack>
            </XStack>
          }
          metricHeight={16}
          metricWidths={DESKTOP_METRIC_SKELETON_WIDTHS}
        />
      ))}
    </YStack>
  );
}
