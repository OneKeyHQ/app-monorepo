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
  getMaxUsableTick,
  getMinUsableTick,
  isFullRange,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { getLiquidityPileHalfWidth } from '../poolsChartData';
import { POOLS_COPY } from '../poolsCopy';
import {
  formatTokenPrice,
  formatUsd,
  getPoolDisplayPrice,
  getPoolPair,
  getTickDisplayPrice,
} from '../poolsFormat';

import type { LayoutChangeEvent } from 'react-native';

// A chosen range fills the middle ~60% of the window, liquidity either side
const RANGE_FIT = 1.6;
const ZOOM_FACTOR = 1.6;
const NOW_LABEL_HEIGHT = 22;
const AXIS_HEIGHT = 22;
// Touch targets: an edge handle, and the middle one that moves the range
const HANDLE_HIT_WIDTH = 44;
const MOVE_HIT_WIDTH = 56;
const MOVE_HIT_HEIGHT = 36;
// A dragged band this close to the chart's side refits on release
const REFIT_MARGIN = 0.02;
const EDGE_LABEL_WIDTH = 96;

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
    () => getLiquidityPileHalfWidth(segments, currentTick),
    [currentTick, segments],
  );

  // A full range has no edges to draw or drag: every bar is inside it
  const fullRange = Boolean(range && isFullRange({ ...range, tickSpacing }));
  const showRange = range && !fullRange ? range : undefined;
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
      if (fullRange) {
        return colors.bar;
      }
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
    fullRange,
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
  // The range as the middle handle was grabbed; it moves by whole spacings
  const moveStart = useRef<IPoolChartRange | undefined>(undefined);
  const responders = useMemo(() => {
    const tickAtX = (x: number, win: IWindow, chartWidth: number) => {
      let fraction = Math.min(Math.max(x / chartWidth, 0), 1);
      if (inverted) {
        fraction = 1 - fraction;
      }
      const tick = win.fromTick + fraction * (win.toTick - win.fromTick);
      return Math.round(tick / tickSpacing) * tickSpacing;
    };
    // Letting go keeps the scale, so a second drag fine-tunes; a band
    // pushed against the chart's side refits, so the next one reaches further
    const release = () => {
      moveStart.current = undefined;
      const edges = latest.current.band;
      if (edges && (edges[0] <= REFIT_MARGIN || edges[1] >= 1 - REFIT_MARGIN)) {
        draggedRange.current = undefined;
        setHeldWindow(undefined);
      }
    };
    const make = (edge: IEdge) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: release,
        onPanResponderTerminate: release,
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
    const move = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: release,
      onPanResponderTerminate: release,
      onPanResponderGrant: () => {
        moveStart.current = latest.current.range;
        setHeldWindow(latest.current.window);
      },
      onPanResponderMove: (_event, gesture) => {
        const {
          range: current,
          window: win,
          width: chartWidth,
          onRangeChange: report,
        } = latest.current;
        const start = moveStart.current;
        if (!start || !current || !report || !chartWidth) {
          return;
        }
        const movedTicks =
          (gesture.dx / chartWidth) *
          (win.toTick - win.fromTick) *
          (inverted ? -1 : 1);
        // Same width in ticks, kept inside the window it was grabbed in
        // and the usable ticks
        const lowest =
          Math.ceil(
            (Math.max(getMinUsableTick(tickSpacing), win.fromTick) -
              start.tickLower) /
              tickSpacing,
          ) * tickSpacing;
        const highest =
          Math.floor(
            (Math.min(getMaxUsableTick(tickSpacing), win.toTick) -
              start.tickUpper) /
              tickSpacing,
          ) * tickSpacing;
        const shift =
          lowest <= highest
            ? Math.min(
                Math.max(
                  Math.round(movedTicks / tickSpacing) * tickSpacing,
                  lowest,
                ),
                highest,
              )
            : 0;
        const next = {
          tickLower: start.tickLower + shift,
          tickUpper: start.tickUpper + shift,
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
    return { left: make('left'), right: make('right'), move };
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

  const zoomButtons = showZoom ? (
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
  ) : null;
  // With nothing else above the chart, the zoom buttons take its top corner
  // instead of a row of their own; the Now label stays centered
  const hasHeader = hasLegend || Boolean(title);

  return (
    <YStack gap="$2">
      {hasHeader ? (
        <XStack ai="center" gap="$2">
          {legend}
          {zoomButtons}
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
        {band &&
        onRangeChange &&
        (band[1] - band[0]) * width >= HANDLE_HIT_WIDTH + MOVE_HIT_WIDTH ? (
          <Stack
            position="absolute"
            top={NOW_LABEL_HEIGHT + height - MOVE_HIT_HEIGHT}
            h={MOVE_HIT_HEIGHT}
            left={`${((band[0] + band[1]) / 2) * 100}%`}
            ml={-MOVE_HIT_WIDTH / 2}
            w={MOVE_HIT_WIDTH}
            cursor="grab"
            userSelect="none"
          >
            <View
              testID="earn-pool-range-handle-move"
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              {...responders.move.panHandlers}
            >
              <XStack
                w={30}
                h={16}
                borderRadius="$full"
                bg="$text"
                ai="center"
                jc="center"
                gap={3}
                pointerEvents="none"
              >
                <Stack w={3} h={3} borderRadius="$full" bg="$bgApp" />
                <Stack w={3} h={3} borderRadius="$full" bg="$bgApp" />
                <Stack w={3} h={3} borderRadius="$full" bg="$bgApp" />
              </XStack>
            </View>
          </Stack>
        ) : null}
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
              {/* A full range names its own ends, as Min and Max do */}
              <SizableText size="$bodySm" color="$textSubdued">
                {fullRange ? '0' : formatTokenPrice(leftPrice)}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {fullRange ? '∞' : formatTokenPrice(rightPrice)}
              </SizableText>
            </XStack>
          )}
        </Stack>
        {hasHeader ? null : (
          <XStack position="absolute" top={0} right={0}>
            {zoomButtons}
          </XStack>
        )}
      </YStack>
    </YStack>
  );
}
