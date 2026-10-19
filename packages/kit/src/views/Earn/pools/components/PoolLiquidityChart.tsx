import { useMemo, useState } from 'react';

import {
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  bucketLiquidity,
  buildLiquiditySegments,
  isFullRange,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { ILiquiditySegment } from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatTokenPrice,
  getPoolDisplayPrice,
  getPoolPair,
  getTickDisplayPrice,
} from '../poolsFormat';

const HALF_WIDTH_STEPS = [8, 20, 50, 120, 300, 700, 1500, 3000, 6000];
const MASS_WINDOW = 8000;
const ZOOM_FACTOR = 1.6;

/**
 * Smallest window around the price that holds ~90% of the liquidity within
 * ±55%, so a stable pair and a volatile pair both open on their liquidity.
 */
function pickHalfWidth(segments: ILiquiditySegment[], currentTick: number) {
  const massWithin = (halfWidth: number) => {
    const from = currentTick - halfWidth;
    const to = currentTick + halfWidth;
    let mass = 0;
    for (const segment of segments) {
      const overlap =
        Math.min(segment.tickUpper, to) - Math.max(segment.tickLower, from);
      if (overlap > 0) {
        mass += Number(segment.liquidity) * overlap;
      }
    }
    return mass;
  };
  const total = massWithin(MASS_WINDOW);
  if (total <= 0) {
    return 1500;
  }
  const found = HALF_WIDTH_STEPS.find(
    (halfWidth) => massWithin(halfWidth) >= total * 0.9,
  );
  return Math.round((found ?? MASS_WINDOW) * 1.2);
}

export type IPoolChartRange = { tickLower: number; tickUpper: number };

/**
 * Liquidity depth by price, current price marked (doc §2.4). With a range,
 * bars inside it are highlighted and the window always fits the range.
 * Prices read left to right in the pair's display direction.
 */
export function PoolLiquidityChart({
  pool,
  ticks,
  range,
  height = 140,
  bucketCount = 56,
  showZoom = true,
}: {
  pool: IPool;
  ticks: IPoolTickLiquidityNet[];
  range?: IPoolChartRange;
  height?: number;
  bucketCount?: number;
  showZoom?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const currentTick = pool.currentTick ?? 0;
  const tickSpacing = pool.tickSpacing ?? 60;
  const { inverted } = getPoolPair(pool);

  const segments = useMemo(
    () =>
      buildLiquiditySegments({
        ticks,
        currentTick,
        activeLiquidity: BigInt(pool.activeLiquidity ?? '0'),
      }),
    [currentTick, pool.activeLiquidity, ticks],
  );
  const baseHalfWidth = useMemo(
    () => pickHalfWidth(segments, currentTick),
    [currentTick, segments],
  );

  const showRange =
    range && !isFullRange({ ...range, tickSpacing }) ? range : undefined;
  const rangeReach = showRange
    ? Math.max(
        Math.abs(showRange.tickLower - currentTick),
        Math.abs(showRange.tickUpper - currentTick),
      ) * 1.15
    : 0;
  const halfWidth = Math.max(
    Math.round(baseHalfWidth * zoom),
    rangeReach,
    tickSpacing * 4,
  );
  const fromTick = currentTick - halfWidth;
  const toTick = currentTick + halfWidth;

  const bars = useMemo(() => {
    const buckets = bucketLiquidity({
      segments,
      fromTick,
      toTick,
      bucketCount,
    });
    const max = buckets.reduce(
      (value, bucket) => (bucket.liquidity > value ? bucket.liquidity : value),
      BigInt(0),
    );
    const items = buckets.map((bucket) => ({
      ...bucket,
      ratio:
        max > BigInt(0)
          ? Number((bucket.liquidity * BigInt(1000)) / max) / 1000
          : 0,
      inRange: showRange
        ? bucket.tickUpper > showRange.tickLower &&
          bucket.tickLower < showRange.tickUpper
        : false,
    }));
    return inverted ? items.toReversed() : items;
  }, [bucketCount, fromTick, inverted, segments, showRange, toTick]);

  // Position of a tick along the display axis, 0–1
  const toX = (tick: number) => {
    const x = (tick - fromTick) / (toTick - fromTick);
    return inverted ? 1 - x : x;
  };
  const nowX = toX(currentTick);
  const leftPrice = getTickDisplayPrice(pool, inverted ? toTick : fromTick);
  const rightPrice = getTickDisplayPrice(pool, inverted ? fromTick : toTick);
  // The exact pool price, so the label matches the price card
  const nowPrice = getPoolDisplayPrice(pool);
  const band = showRange
    ? [toX(showRange.tickLower), toX(showRange.tickUpper)].toSorted(
        (a, b) => a - b,
      )
    : undefined;

  return (
    <YStack gap="$2">
      {showZoom ? (
        <XStack jc="flex-end" gap="$1">
          <IconButton
            testID="earn-pool-liquidity-zoom-out"
            size="small"
            variant="tertiary"
            icon="MinusLargeOutline"
            onPress={() =>
              setZoom((value) => Math.min(value * ZOOM_FACTOR, 12))
            }
          />
          <IconButton
            testID="earn-pool-liquidity-zoom-in"
            size="small"
            variant="tertiary"
            icon="PlusLargeOutline"
            onPress={() =>
              setZoom((value) => Math.max(value / ZOOM_FACTOR, 0.1))
            }
          />
        </XStack>
      ) : null}
      <YStack h={height + 22} position="relative">
        <XStack
          position="absolute"
          top={22}
          left={0}
          right={0}
          h={height}
          ai="flex-end"
          gap={1}
        >
          {bars.map((bar) => (
            <Stack
              key={`${bar.tickLower}`}
              flex={1}
              h={`${Math.max(bar.ratio * 100, bar.liquidity > BigInt(0) ? 1.5 : 0)}%`}
              borderTopLeftRadius={1}
              borderTopRightRadius={1}
              bg={bar.inRange ? '$iconSuccess' : '$iconDisabled'}
              opacity={showRange && !bar.inRange ? 0.6 : 1}
            />
          ))}
        </XStack>
        {band ? (
          <Stack
            position="absolute"
            top={22}
            h={height}
            left={`${band[0] * 100}%`}
            w={`${(band[1] - band[0]) * 100}%`}
            borderLeftWidth={2}
            borderRightWidth={2}
            borderColor="$iconSuccess"
            bg="$bgSuccessSubdued"
            opacity={0.5}
            pointerEvents="none"
          />
        ) : null}
        {/* Fixed-width box centered on the marker; works on native too */}
        <YStack
          position="absolute"
          top={0}
          h={height + 22}
          left={`${nowX * 100}%`}
          w={160}
          ml={-80}
          ai="center"
          pointerEvents="none"
        >
          <SizableText size="$bodySmMedium" numberOfLines={1}>
            {`${POOLS_COPY.now} ${formatTokenPrice(nowPrice)}`}
          </SizableText>
          <Stack mt="$1" w={1.5} flex={1} bg="$text" />
        </YStack>
      </YStack>
      <XStack jc="space-between">
        <SizableText size="$bodySm" color="$textSubdued">
          {formatTokenPrice(leftPrice)}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {formatTokenPrice(rightPrice)}
        </SizableText>
      </XStack>
    </YStack>
  );
}
