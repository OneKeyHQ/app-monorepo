import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { PanResponder, View } from 'react-native';

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
  formatUsd,
  getPoolDisplayPrice,
  getPoolPair,
  getTickDisplayPrice,
} from '../poolsFormat';

import type { LayoutChangeEvent } from 'react-native';

const HALF_WIDTH_STEPS = [8, 20, 50, 120, 300, 700, 1500, 3000, 6000];
const MASS_WINDOW = 8000;
// Share of the nearby liquidity the default window holds: the bulk of it,
// not the long tails, so the bars near the price are wide enough to read
const MASS_SHARE = 0.8;
// A chosen range fills the middle ~60% of the window, liquidity either side
const RANGE_FIT = 1.6;
const ZOOM_FACTOR = 1.6;
const NOW_LABEL_HEIGHT = 22;
const AXIS_HEIGHT = 22;
const HANDLE_HIT_WIDTH = 32;
const EDGE_LABEL_WIDTH = 96;

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
    (halfWidth) => massWithin(halfWidth) >= total * MASS_SHARE,
  );
  return Math.round((found ?? MASS_WINDOW) * 1.1);
}

export type IPoolChartRange = { tickLower: number; tickUpper: number };

/** One of the user's positions in this pool, drawn into the bars */
export type IPoolChartPosition = IPoolChartRange & {
  id: string;
  inRange: boolean;
  valueUsd: string;
};

type IWindow = { fromTick: number; toTick: number };
type IEdge = 'left' | 'right';

const TONES = {
  success: { bar: '$iconSuccess', band: '$bgSuccessSubdued' },
  caution: { bar: '$iconCaution', band: '$bgCautionSubdued' },
} as const;

function overlaps(
  bucket: { tickLower: number; tickUpper: number },
  range: IPoolChartRange,
) {
  return (
    bucket.tickUpper > range.tickLower && bucket.tickLower < range.tickUpper
  );
}

/** A price under a band edge, kept inside the chart near either end */
function EdgeLabel({ x, text }: { x: number; text: string }) {
  let align: 'left' | 'center' | 'right' = 'center';
  if (x < 0.12) {
    align = 'left';
  } else if (x > 0.88) {
    align = 'right';
  }
  const offset = {
    left: 0,
    center: -EDGE_LABEL_WIDTH / 2,
    right: -EDGE_LABEL_WIDTH,
  };
  return (
    <Stack
      position="absolute"
      top={4}
      left={`${x * 100}%`}
      ml={offset[align]}
      w={EDGE_LABEL_WIDTH}
      pointerEvents="none"
    >
      <SizableText size="$bodySmMedium" textAlign={align} numberOfLines={1}>
        {text}
      </SizableText>
    </Stack>
  );
}

/**
 * Liquidity depth by price, the current price marked (doc §2.4). With a
 * range the bars inside it take its color and a band frames it; with
 * `onRangeChange` the band's edges are handles to drag. With the user's
 * positions, the bars each one covers take its status color. Prices read
 * left to right in the pair's display direction.
 */
export function PoolLiquidityChart({
  pool,
  ticks,
  range,
  onRangeChange,
  positions,
  tone = 'success',
  height = 140,
  bucketCount = 56,
  showZoom = true,
  title,
}: {
  pool: IPool;
  ticks: IPoolTickLiquidityNet[];
  range?: IPoolChartRange;
  onRangeChange?: (range: IPoolChartRange) => void;
  positions?: IPoolChartPosition[];
  /** The range's color: caution for a position out of range */
  tone?: keyof typeof TONES;
  height?: number;
  bucketCount?: number;
  showZoom?: boolean;
  /** Left of the zoom buttons, when there is no legend */
  title?: ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  // Dragging holds the window still, or the bars would slide under the finger
  const [heldWindow, setHeldWindow] = useState<IWindow>();
  const currentTick = pool.currentTick ?? 0;
  const tickSpacing = pool.tickSpacing ?? 60;
  const { inverted } = getPoolPair(pool);
  const colors = TONES[tone];

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
  const reachOf = (item: IPoolChartRange) =>
    Math.max(
      Math.abs(item.tickLower - currentTick),
      Math.abs(item.tickUpper - currentTick),
    );
  let halfWidth: number;
  if (showRange) {
    halfWidth = reachOf(showRange) * RANGE_FIT * zoom;
  } else {
    const positionsReach = (positions ?? []).reduce(
      (reach, item) => Math.max(reach, reachOf(item) * 1.15),
      0,
    );
    halfWidth = Math.max(baseHalfWidth * zoom, positionsReach);
  }
  halfWidth = Math.max(Math.round(halfWidth), tickSpacing * 4);
  const window: IWindow = heldWindow ?? {
    fromTick: currentTick - halfWidth,
    toTick: currentTick + halfWidth,
  };
  const { fromTick, toTick } = window;

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
    const tintOf = (bucket: IPoolChartRange): string | undefined => {
      if (showRange) {
        return overlaps(bucket, showRange) ? colors.bar : undefined;
      }
      const covering = (positions ?? []).filter((item) =>
        overlaps(bucket, item),
      );
      if (!covering.length) {
        return undefined;
      }
      return covering.some((item) => item.inRange)
        ? TONES.success.bar
        : TONES.caution.bar;
    };
    const items = buckets.map((bucket) => ({
      ...bucket,
      ratio:
        max > BigInt(0)
          ? Number((bucket.liquidity * BigInt(1000)) / max) / 1000
          : 0,
      tint: tintOf(bucket),
    }));
    return inverted ? items.toReversed() : items;
  }, [
    bucketCount,
    colors.bar,
    fromTick,
    inverted,
    positions,
    segments,
    showRange,
    toTick,
  ]);

  // Position of a tick along the display axis, 0–1
  const toX = (tick: number) => {
    const x = (tick - fromTick) / (toTick - fromTick);
    return inverted ? 1 - x : x;
  };
  const nowX = toX(currentTick);
  const band = showRange
    ? ([toX(showRange.tickLower), toX(showRange.tickUpper)].toSorted(
        (a, b) => a - b,
      ) as [number, number])
    : undefined;
  // The left edge is the lower tick unless the pair reads inverted
  const edgeTicks = showRange
    ? {
        left: inverted ? showRange.tickUpper : showRange.tickLower,
        right: inverted ? showRange.tickLower : showRange.tickUpper,
      }
    : undefined;

  // Handles: built once, reading the latest values through refs
  const latest = useRef({
    range: showRange,
    window,
    width,
    band,
    onRangeChange,
  });
  latest.current = { range: showRange, window, width, band, onRangeChange };
  const dragStartX = useRef(0);
  const draggedRange = useRef<IPoolChartRange | undefined>(undefined);
  const responders = useMemo(() => {
    const tickAtX = (x: number, win: IWindow, chartWidth: number) => {
      let fraction = Math.min(Math.max(x / chartWidth, 0), 1);
      if (inverted) {
        fraction = 1 - fraction;
      }
      const tick = win.fromTick + fraction * (win.toTick - win.fromTick);
      return Math.round(tick / tickSpacing) * tickSpacing;
    };
    const make = (edge: IEdge) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const {
            band: edges,
            window: win,
            width: chartWidth,
          } = latest.current;
          dragStartX.current =
            (edges?.[edge === 'left' ? 0 : 1] ?? 0) * chartWidth;
          setHeldWindow(win);
        },
        onPanResponderMove: (_event, gesture) => {
          const {
            range: current,
            window: win,
            width: chartWidth,
            onRangeChange: report,
          } = latest.current;
          if (!current || !report || !chartWidth) {
            return;
          }
          const tick = tickAtX(
            dragStartX.current + gesture.dx,
            win,
            chartWidth,
          );
          const movesLower = (edge === 'left') !== inverted;
          const next = movesLower
            ? {
                ...current,
                tickLower: Math.min(tick, current.tickUpper - tickSpacing),
              }
            : {
                ...current,
                tickUpper: Math.max(tick, current.tickLower + tickSpacing),
              };
          if (
            next.tickLower !== current.tickLower ||
            next.tickUpper !== current.tickUpper
          ) {
            draggedRange.current = next;
            report(next);
          }
        },
      });
    return { left: make('left'), right: make('right') };
  }, [inverted, tickSpacing]);

  // A range set elsewhere (a preset, the min / max fields) refits the window
  const rangeKey = showRange
    ? `${showRange.tickLower}:${showRange.tickUpper}`
    : '';
  useEffect(() => {
    const dragged = draggedRange.current;
    if (!dragged || rangeKey !== `${dragged.tickLower}:${dragged.tickUpper}`) {
      draggedRange.current = undefined;
      setHeldWindow(undefined);
    }
  }, [rangeKey]);

  const changeZoom = (factor: number) => {
    draggedRange.current = undefined;
    setHeldWindow(undefined);
    setZoom((value) => Math.min(Math.max(value * factor, 0.1), 12));
  };

  // The exact pool price, so the label matches the price card
  const nowPrice = getPoolDisplayPrice(pool);
  const leftPrice = getTickDisplayPrice(pool, inverted ? toTick : fromTick);
  const rightPrice = getTickDisplayPrice(pool, inverted ? fromTick : toTick);
  const hasLegend = Boolean(positions?.length);
  const legend = hasLegend ? (
    <XStack gap="$4" rowGap="$1" flexWrap="wrap" flex={1}>
      {/* Each position's color, value and what the color means */}
      {(positions ?? []).map((item) => (
        <XStack key={item.id} ai="center" gap="$1.5">
          <Stack
            w={8}
            h={8}
            borderRadius={2}
            bg={item.inRange ? TONES.success.bar : TONES.caution.bar}
          />
          <SizableText size="$bodySmMedium">
            {formatUsd(item.valueUsd)}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {item.inRange ? POOLS_COPY.inRange : POOLS_COPY.outOfRange}
          </SizableText>
        </XStack>
      ))}
    </XStack>
  ) : (
    <XStack flex={1}>{title}</XStack>
  );

  return (
    <YStack gap="$2">
      {showZoom || hasLegend || title ? (
        <XStack ai="center" gap="$2">
          {legend}
          {showZoom ? (
            <XStack gap="$1">
              <IconButton
                testID="earn-pool-liquidity-zoom-out"
                size="small"
                variant="tertiary"
                icon="MinusLargeOutline"
                onPress={() => changeZoom(ZOOM_FACTOR)}
              />
              <IconButton
                testID="earn-pool-liquidity-zoom-in"
                size="small"
                variant="tertiary"
                icon="PlusLargeOutline"
                onPress={() => changeZoom(1 / ZOOM_FACTOR)}
              />
            </XStack>
          ) : null}
        </XStack>
      ) : null}
      <YStack
        h={NOW_LABEL_HEIGHT + height + AXIS_HEIGHT}
        position="relative"
        onLayout={(event: LayoutChangeEvent) =>
          setWidth(event.nativeEvent.layout.width)
        }
      >
        {band ? (
          <Stack
            position="absolute"
            top={NOW_LABEL_HEIGHT - 6}
            h={height + 6}
            left={`${band[0] * 100}%`}
            w={`${(band[1] - band[0]) * 100}%`}
            bg={colors.band}
            pointerEvents="none"
          />
        ) : null}
        <XStack
          position="absolute"
          top={NOW_LABEL_HEIGHT}
          left={0}
          right={0}
          h={height}
          ai="flex-end"
          gap={1}
          pointerEvents="none"
        >
          {bars.map((bar) => (
            <Stack
              key={`${bar.tickLower}`}
              flex={1}
              h={`${Math.max(bar.ratio * 100, bar.liquidity > BigInt(0) ? 1.5 : 0)}%`}
              borderTopLeftRadius={1.5}
              borderTopRightRadius={1.5}
              bg={bar.tint ?? '$neutral5'}
            />
          ))}
        </XStack>
        {band
          ? band.map((x) => (
              <Stack
                key={x}
                position="absolute"
                top={NOW_LABEL_HEIGHT - 6}
                h={height + 6}
                left={`${x * 100}%`}
                ml={-0.75}
                w={1.5}
                bg={colors.bar}
                pointerEvents="none"
              />
            ))
          : null}
        {/* Fixed-width box centered on the marker; works on native too */}
        <YStack
          position="absolute"
          top={0}
          h={NOW_LABEL_HEIGHT + height}
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
        {band && onRangeChange
          ? (['left', 'right'] as const).map((edge) => (
              <Stack
                key={edge}
                position="absolute"
                top={NOW_LABEL_HEIGHT}
                h={height}
                left={`${band[edge === 'left' ? 0 : 1] * 100}%`}
                ml={-HANDLE_HIT_WIDTH / 2}
                w={HANDLE_HIT_WIDTH}
                cursor="ew-resize"
                userSelect="none"
              >
                {/* Tamagui draws plain DOM on web; the responder needs an RN view */}
                <View
                  testID={`earn-pool-range-handle-${edge}`}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  {...responders[edge].panHandlers}
                >
                  <XStack
                    w={12}
                    h={30}
                    borderRadius="$full"
                    bg="$text"
                    ai="center"
                    jc="center"
                    gap={2}
                    pointerEvents="none"
                  >
                    <Stack w={1.5} h={10} bg="$bgApp" />
                    <Stack w={1.5} h={10} bg="$bgApp" />
                  </XStack>
                </View>
              </Stack>
            ))
          : null}
        <Stack
          position="absolute"
          top={NOW_LABEL_HEIGHT + height}
          left={0}
          right={0}
          h={AXIS_HEIGHT}
          pointerEvents="none"
        >
          {band && edgeTicks ? (
            <>
              <EdgeLabel
                x={band[0]}
                text={formatTokenPrice(
                  getTickDisplayPrice(pool, edgeTicks.left),
                )}
              />
              <EdgeLabel
                x={band[1]}
                text={formatTokenPrice(
                  getTickDisplayPrice(pool, edgeTicks.right),
                )}
              />
            </>
          ) : (
            <XStack jc="space-between" pt={4}>
              <SizableText size="$bodySm" color="$textSubdued">
                {formatTokenPrice(leftPrice)}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {formatTokenPrice(rightPrice)}
              </SizableText>
            </XStack>
          )}
        </Stack>
      </YStack>
    </YStack>
  );
}
