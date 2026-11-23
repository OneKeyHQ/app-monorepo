import { useCallback, useMemo, useRef, useState } from 'react';

import { PanResponder, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IPool,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import { formatCompactUsd, formatTokenPrice, formatUsd } from '../poolsFormat';
import {
  getStrataBarHeights,
  getStrataEdgePrices,
  getStrataPicture,
  getStrataSlicePrices,
  getStrataSliceValues,
} from '../poolsStrata';

import type { IStrataPicture, IStrataPosition } from '../poolsStrata';
import type { LayoutChangeEvent } from 'react-native';

// A position against its pool's liquidity, in two colors: the pool's bars in
// the charts' grey, the position's piece on top in the range's color, green
// while it earns and amber once the price has left. The line is the price.

const READOUT_WIDTH = 224;

type IGeometry = { pitch: number; gap: number; x0: number; count: number };

function getGeometry(width: number, pitch: number, gap: number): IGeometry {
  const count = Math.max(1, Math.floor(width / pitch));
  return { pitch, gap, count, x0: Math.floor((width - count * pitch) / 2) };
}

function useStrata({
  pool,
  ticks,
  position,
  count,
  flipped = false,
}: {
  pool: IPool;
  ticks: IPoolTickLiquidityNet[] | undefined;
  position: IStrataPosition;
  count: number;
  flipped?: boolean;
}) {
  const { tickLower, tickUpper, liquidity } = position;
  return useMemo(
    () =>
      ticks && count > 0
        ? getStrataPicture({
            pool,
            ticks,
            position: { tickLower, tickUpper, liquidity },
            count,
            flipped,
          })
        : undefined,
    [count, flipped, liquidity, pool, tickLower, tickUpper, ticks],
  );
}

/** The well, the bars and the price line; words live around it */
function StrataSvg({
  picture,
  geometry,
  width,
  height,
  top,
  least,
  inRange,
  hover,
}: {
  picture: IStrataPicture;
  geometry: IGeometry;
  width: number;
  height: number;
  /** Room left above the tallest bar */
  top: number;
  least: number;
  inRange: boolean;
  /** The bar under the pointer, lit */
  hover?: number;
}) {
  const theme = useTheme();
  const { pitch, gap, x0, count } = geometry;
  const { rest, mine } = useMemo(() => {
    const heights = getStrataBarHeights(picture.slices, {
      room: height - top,
      least,
    });
    const round = (value: number) => Math.round(value * 10) / 10;
    const barWidth = pitch - gap;
    const bar = (index: number, upper: number, lower: number) =>
      `M${x0 + index * pitch + Math.floor(gap / 2)} ${round(upper)}h${barWidth}V${round(lower)}h${-barWidth}Z`;
    let restPath = '';
    let minePath = '';
    heights.forEach(({ own, others }, index) => {
      if (others >= 0.05) {
        restPath += bar(index, height - others, height);
      }
      if (own > 0) {
        minePath += bar(index, height - others - own, height - others);
      }
    });
    return { rest: restPath, mine: minePath };
  }, [gap, height, least, picture.slices, pitch, top, x0]);

  const start = x0;
  const end = x0 + count * pitch;
  const at = x0 + picture.nowX * count * pitch;
  const inside = at >= start && at <= end;
  const priceX =
    Math.round(Math.min(Math.max(at, start + 0.5), end - 1.5)) + 0.5;
  const pieceColor = inRange ? theme.iconSuccess.val : theme.iconCaution.val;
  const lineColor = inRange ? theme.text.val : theme.iconCaution.val;

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={theme.bgApp.val} />
      {rest ? <Path d={rest} fill={theme.neutral5.val} /> : null}
      {mine ? <Path d={mine} fill={pieceColor} /> : null}
      {hover !== undefined ? (
        <Rect
          x={x0 + hover * pitch}
          y={0}
          width={pitch}
          height={height}
          fill={theme.text.val}
          fillOpacity={0.12}
        />
      ) : null}
      <Line
        x1={priceX}
        x2={priceX}
        y1={0}
        y2={height}
        stroke={lineColor}
        strokeWidth={inside ? 1 : 2}
        strokeOpacity={inside ? 1 : 0.7}
      />
    </Svg>
  );
}

function useWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setWidth((previous) => (previous === next ? previous : next));
  };
  return { width, onLayout };
}

/**
 * A position card's picture, where the card had its range bar: the pool's
 * liquidity in bars, the position's piece on top of each.
 */
export function PoolStrataPreview({
  pool,
  ticks,
  position,
  inRange,
  height = 40,
  flipped = false,
}: {
  pool: IPool;
  /** Undefined while the pool's detail loads */
  ticks: IPoolTickLiquidityNet[] | undefined;
  position: IStrataPosition;
  inRange: boolean;
  height?: number;
  flipped?: boolean;
}) {
  const { width, onLayout } = useWidth();
  // Bars of 3 px with a 1 px gap
  const geometry = getGeometry(width, 4, 1);
  const picture = useStrata({
    pool,
    ticks,
    position,
    count: width > 0 ? geometry.count : 0,
    flipped,
  });
  return (
    <Stack
      h={height}
      borderRadius="$2"
      overflow="hidden"
      onLayout={onLayout}
      testID="earn-pool-strata-preview"
    >
      {picture ? (
        <StrataSvg
          picture={picture}
          geometry={geometry}
          width={width}
          height={height}
          top={4}
          least={3}
          inRange={inRange}
        />
      ) : (
        <Skeleton w="100%" h={height} />
      )}
    </Stack>
  );
}

function formatShare(share: number) {
  const percent = share * 100;
  if (percent > 0 && percent < 0.01) {
    return '<0.01%';
  }
  return `${percent.toFixed(percent >= 10 ? 0 : 2)}%`;
}

function ReadoutRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack jc="space-between" gap="$3">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodySmMedium" textAlign="right" flexShrink={1}>
        {value}
      </SizableText>
    </XStack>
  );
}

/** The two colors, each when the picture shows any of it */
function StrataLegend({
  picture,
  inRange,
}: {
  picture: IStrataPicture;
  inRange: boolean;
}) {
  const items = [
    {
      key: 'mine',
      color: inRange ? '$iconSuccess' : '$iconCaution',
      label: POOLS_COPY.thisPosition,
      shown: picture.slices.some((slice) => slice.mine > 0),
    },
    {
      key: 'pool',
      color: '$neutral5',
      label: POOLS_COPY.allPositions,
      shown: picture.slices.some((slice) => slice.rest > 0),
    },
  ].filter((item) => item.shown);
  return (
    <XStack gap="$4" rowGap="$1" flexWrap="wrap">
      {items.map((item) => (
        <XStack key={item.key} ai="center" gap="$1.5">
          <Stack w={8} h={8} borderRadius={2} bg={item.color} />
          <SizableText size="$bodySm" color="$textSubdued">
            {item.label}
          </SizableText>
        </XStack>
      ))}
    </XStack>
  );
}

/**
 * A position page's picture: the pool's liquidity in bars, this position's
 * piece on top of each. A pointer, or a finger held on it, reads a bar: its
 * prices, what this position holds there and its share, and the pool's
 * whole there.
 */
export function PoolStrataPlot({
  pool,
  ticks,
  position,
  inRange,
  height = 176,
}: {
  pool: IPool;
  ticks: IPoolTickLiquidityNet[];
  position: IStrataPosition;
  inRange: boolean;
  height?: number;
}) {
  const { width, onLayout } = useWidth();
  // 3 px bars and a 2 px gap across a wide plot, 2 and 2 on a phone
  const geometry = getGeometry(width, width >= 480 ? 5 : 4, 2);
  const picture = useStrata({
    pool,
    ticks,
    position,
    count: width > 0 ? geometry.count : 0,
  });
  const [hover, setHover] = useState<number>();
  const plotRef = useRef<View>(null);
  const latest = useRef({ geometry, picture });
  latest.current = { geometry, picture };

  // Reads the latest geometry through a ref, so the responder is built once
  const indexAt = useCallback((x: number) => {
    const { geometry: geo, picture: pic } = latest.current;
    if (!pic) {
      return undefined;
    }
    const index = Math.floor((x - geo.x0) / geo.pitch);
    return Math.min(Math.max(index, 0), geo.count - 1);
  }, []);
  // Native: a finger held on the plot reads it, and lets go to a scroll
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: (event) =>
          setHover(indexAt(event.nativeEvent.locationX)),
        onPanResponderMove: (event) =>
          setHover(indexAt(event.nativeEvent.locationX)),
        onPanResponderRelease: () => setHover(undefined),
        onPanResponderTerminate: () => setHover(undefined),
      }),
    [indexAt],
  );
  // Web: the pointer reads it as it moves
  const pointerProps = platformEnv.isNative
    ? responder.panHandlers
    : {
        onPointerMove: (event: { nativeEvent: { clientX: number } }) => {
          const node = plotRef.current as unknown as HTMLElement | null;
          const left = node?.getBoundingClientRect?.().left ?? 0;
          setHover(indexAt(event.nativeEvent.clientX - left));
        },
        onPointerLeave: () => setHover(undefined),
      };

  const slice =
    picture && hover !== undefined ? picture.slices[hover] : undefined;
  const readout = useMemo(() => {
    if (!picture || !slice) {
      return undefined;
    }
    const prices = getStrataSlicePrices(pool, slice);
    const values = getStrataSliceValues({
      pool,
      segments: picture.segments,
      position,
      slice,
    });
    return { prices, ...values };
  }, [picture, pool, position, slice]);
  const edges = picture ? getStrataEdgePrices(pool, picture.window) : undefined;

  let readoutLeft = 0;
  if (hover !== undefined) {
    const barLeft = geometry.x0 + hover * geometry.pitch;
    const barRight = barLeft + geometry.pitch;
    readoutLeft =
      barRight + 8 + READOUT_WIDTH <= width
        ? barRight + 8
        : Math.max(0, barLeft - 8 - READOUT_WIDTH);
  }

  return (
    <YStack gap="$2.5">
      <Stack
        h={height}
        position="relative"
        borderRadius="$3"
        overflow="hidden"
        onLayout={onLayout}
        testID="earn-pool-strata-plot"
      >
        {picture ? (
          <StrataSvg
            picture={picture}
            geometry={geometry}
            width={width}
            height={height}
            top={14}
            least={4}
            inRange={inRange}
            hover={hover}
          />
        ) : (
          <Skeleton w="100%" h={height} />
        )}
        <View
          ref={plotRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          {...pointerProps}
        />
        {readout ? (
          <YStack
            position="absolute"
            top={10}
            left={readoutLeft}
            w={READOUT_WIDTH}
            px="$2.5"
            py="$1.5"
            gap="$1"
            borderRadius="$2"
            bg="$bg"
            borderWidth={1}
            borderColor="$borderSubdued"
            pointerEvents="none"
            testID="earn-pool-strata-readout"
          >
            <ReadoutRow
              label={POOLS_COPY.price}
              value={`${formatTokenPrice(readout.prices.low)} – ${formatTokenPrice(readout.prices.high)}`}
            />
            <ReadoutRow
              label={POOLS_COPY.thisPosition}
              value={
                readout.mineUsd > 0
                  ? `${formatUsd(readout.mineUsd)} (${formatShare(
                      readout.poolUsd > 0
                        ? readout.mineUsd / readout.poolUsd
                        : 0,
                    )})`
                  : '–'
              }
            />
            <ReadoutRow
              label={POOLS_COPY.liquidity}
              value={formatCompactUsd(readout.poolUsd)}
            />
          </YStack>
        ) : null}
      </Stack>
      {picture && edges ? (
        <>
          <XStack jc="space-between" gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              {formatTokenPrice(edges.left)}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {formatTokenPrice(edges.right)}
            </SizableText>
          </XStack>
          <StrataLegend picture={picture} inRange={inRange} />
        </>
      ) : null}
    </YStack>
  );
}
