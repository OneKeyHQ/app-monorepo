import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useTheme } from '@tamagui/core';
import { colord } from 'colord';

import {
  Button,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  ILightweightChartBandDrag,
  ILightweightChartOverlay,
} from '@onekeyhq/kit/src/components/LightweightChart/types';
import { StockPriceLineChart } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import type { IStockPriceLineChartHoverPoint } from '@onekeyhq/kit/src/components/StockPriceLineChart';
import {
  PoolsBigNumber,
  isTickInRange,
  toDisplayPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type {
  IPool,
  IPoolPriceRange,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import {
  getRangeShiftedByShownPrices,
  getRangeWithShownEdge,
  getShownLiquidityBuckets,
  getShownRangeBounds,
} from '../poolsChartData';
import { POOLS_COPY } from '../poolsCopy';
import {
  formatTokenPrice,
  getPoolDisplayPrice,
  getPoolPair,
} from '../poolsFormat';
import {
  DEFAULT_PRICE_RANGE,
  PoolsQueries,
  usePoolsQuery,
} from '../poolsQueries';

import { PoolsCard } from './PoolsCard';

const PRICE_RANGES: IPoolPriceRange[] = ['1D', '1W', '1M', '1Y'];
const LIQUIDITY_BUCKETS = 44;

// A pool's price is one token in the other, not dollars
const formatAxisPrice = (price: number) => formatTokenPrice(price);

function withAlpha(color: string, alpha: number) {
  const parsed = colord(color);
  return parsed.isValid() ? parsed.alpha(alpha).toRgbString() : color;
}

function LegendItem({
  color,
  label,
  outlined,
}: {
  color: string;
  label: string;
  outlined?: boolean;
}) {
  return (
    <XStack ai="center" gap="$1.5">
      <Stack
        w="$2.5"
        h="$2.5"
        borderRadius="$0.5"
        bg={outlined ? 'transparent' : color}
        borderWidth={outlined ? 1 : 0}
        borderColor={color}
      />
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
    </XStack>
  );
}

/**
 * Price, volume and liquidity on one chart (proposal, from Revert's three
 * tabs): Market's light chart for the price, volume bars under it, the
 * pool's liquidity as a strip along the price axis, and the range being set
 * as a band, so a range can be judged against where the price has been.
 * With `onRangeChange` (wide web layouts) the band's edges are dragged on
 * the chart, and the range's other controls sit under it.
 */
export function PoolOverviewChart({
  pool,
  ticks,
  range,
  onRangeChange,
  renderRangeControls,
  flipped: flippedProp,
  onFlippedChange,
  height,
  stripWidth,
}: {
  pool: IPool;
  ticks?: IPoolTickLiquidityNet[];
  /** The range in the create form, drawn as a band */
  range?: IPoolTickRange;
  /** Makes the band's edges draggable */
  onRangeChange?: (range: IPoolTickRange) => void;
  /** Under the legend; `flipped` when the prices are shown the other way */
  renderRangeControls?: (flipped: boolean) => ReactNode;
  /** Set to share the direction with a form beside the chart */
  flipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  height: number;
  /** Width of the liquidity strip on the right of the plot, in px */
  stripWidth: number;
}) {
  const theme = useTheme();
  const [ownFlipped, setOwnFlipped] = useState(false);
  const flipped = flippedProp ?? ownFlipped;
  const setFlipped = onFlippedChange ?? setOwnFlipped;
  const [period, setPeriod] = useState<IPoolPriceRange>(DEFAULT_PRICE_RANGE);
  const [hover, setHover] = useState<IStockPriceLineChartHoverPoint>();
  const { base, quote, inverted } = getPoolPair(pool);
  const shownBase = flipped ? quote : base;
  const shownQuote = flipped ? base : quote;
  const { result: history } = usePoolsQuery(
    PoolsQueries.history(pool.id, period),
  );

  const data = useMemo<IMarketTokenChart>(
    () =>
      (history ?? []).map((point) => [
        Math.round(point.time / 1000),
        toDisplayPrice(
          new PoolsBigNumber(point.price),
          flipped ? !inverted : inverted,
        ).toNumber(),
      ]),
    [flipped, history, inverted],
  );
  const volumeData = useMemo<IMarketTokenChart>(
    () =>
      (history ?? []).map((point) => [
        Math.round(point.time / 1000),
        Number(point.volumeUsd ?? 0),
      ]),
    [history],
  );

  const currentPrice = getPoolDisplayPrice(pool, flipped).toNumber();
  const band = useMemo(
    () =>
      range && pool.capabilities.priceRange
        ? getShownRangeBounds({ pool, range, flipped })
        : undefined,
    [flipped, pool, range],
  );
  const bandInRange = range
    ? isTickInRange({ ...range, tick: pool.currentTick ?? 0 })
    : true;

  // Liquidity over a window wider than the plot, so the strip fills it
  const prices = data.map(([, price]) => price);
  const dataLow = prices.length ? Math.min(...prices) : currentPrice;
  const dataHigh = prices.length ? Math.max(...prices) : currentPrice;
  const windowLow = Math.min(dataLow, band?.low ?? dataLow);
  const windowHigh = Math.max(dataHigh, band?.high ?? dataHigh);
  const windowSpan = Math.max(windowHigh - windowLow, currentPrice * 0.002);
  const bucketLow = Math.max(windowLow - windowSpan * 0.6, windowLow * 0.2);
  const bucketHigh = windowHigh + windowSpan * 0.4;
  const buckets = useMemo(
    () =>
      ticks
        ? getShownLiquidityBuckets({
            pool,
            ticks,
            low: bucketLow,
            high: bucketHigh,
            flipped,
            bucketCount: LIQUIDITY_BUCKETS,
          })
        : [],
    [bucketHigh, bucketLow, flipped, pool, ticks],
  );
  const hasStrip = buckets.length > 0;

  const successColor = theme.iconSuccess.val;
  const cautionColor = theme.iconCaution.val;
  const bandColor = bandInRange ? successColor : cautionColor;
  const stripColor = theme.neutral6.val;
  const draggable = Boolean(onRangeChange);

  // Several moves can come between renders; each starts from the latest.
  // A moved band starts from the range it had when it was grabbed.
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const grabbedRangeRef = useRef<IPoolTickRange | undefined>(undefined);
  const handleBandDrag = useCallback(
    ({ target, phase, price, startPrice }: ILightweightChartBandDrag) => {
      const current = rangeRef.current;
      if (!current || !onRangeChange) {
        return;
      }
      if (phase === 'start') {
        grabbedRangeRef.current = current;
        return;
      }
      const next =
        target === 'band'
          ? getRangeShiftedByShownPrices({
              pool,
              range: grabbedRangeRef.current ?? current,
              flipped,
              from: startPrice,
              to: price,
            })
          : getRangeWithShownEdge({
              pool,
              range: current,
              flipped,
              edge: target,
              price,
            });
      if (
        next.tickLower !== current.tickLower ||
        next.tickUpper !== current.tickUpper
      ) {
        rangeRef.current = next;
        onRangeChange(next);
      }
    },
    [flipped, onRangeChange, pool],
  );
  const overlay = useMemo<ILightweightChartOverlay>(
    () => ({
      sideHistogram: hasStrip
        ? {
            buckets,
            color: stripColor,
            activeColor: band ? withAlpha(bandColor, 0.55) : undefined,
            activeLow: band ? (band.low ?? 0) : undefined,
            activeHigh: band ? (band.high ?? Number.MAX_VALUE) : undefined,
            widthPixels: stripWidth,
            markerPrice: currentPrice,
            markerColor: theme.textSubdued.val,
          }
        : undefined,
      priceBand: band
        ? {
            low: band.low,
            high: band.high,
            fillColor: withAlpha(bandColor, 0.08),
            lineColor: withAlpha(bandColor, draggable ? 0.8 : 0.5),
            includeInAutoscale: true,
            draggable,
            handleColor: bandColor,
            handleTextColor: theme.textOnColor.val,
          }
        : undefined,
    }),
    [
      band,
      bandColor,
      buckets,
      currentPrice,
      draggable,
      hasStrip,
      stripColor,
      stripWidth,
      theme.textOnColor.val,
      theme.textSubdued.val,
    ],
  );

  // The header follows the cursor, like Market's
  const shownPrice = hover?.price ?? currentPrice;
  const first = data[0]?.[1];
  const change = first ? shownPrice / first - 1 : 0;

  return (
    <PoolsCard
      testID="earn-pool-overview-chart"
      title={POOLS_COPY.price}
      right={
        <IconButton
          testID="earn-pool-price-flip"
          size="small"
          variant="tertiary"
          icon="SwitchHorOutline"
          onPress={() => setFlipped(!flipped)}
        />
      }
    >
      <YStack gap="$1">
        <XStack ai="baseline" gap="$2" flexWrap="wrap">
          <SizableText size="$heading2xl">
            {formatTokenPrice(shownPrice)}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {POOLS_COPY.priceIn(shownQuote.symbol, shownBase.symbol)}
          </SizableText>
        </XStack>
        <XStack ai="center" gap="$1.5">
          <SizableText
            size="$bodyMdMedium"
            color={change >= 0 ? '$textSuccess' : '$textCritical'}
          >
            {`${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%`}
          </SizableText>
          {hover ? null : (
            <SizableText size="$bodyMd" color="$textSubdued">
              {POOLS_COPY.priceChangeOver[period]}
            </SizableText>
          )}
        </XStack>
      </YStack>
      {/* Market's period row (MobileSimpleChart) */}
      <XStack gap="$1" ai="center">
        {PRICE_RANGES.map((item) => (
          <Button
            key={item}
            testID={`earn-pool-price-range-${item}`}
            size="small"
            variant={period === item ? 'secondary' : 'tertiary'}
            minWidth={42}
            height={30}
            m="$0"
            px="$2.5"
            borderWidth={0}
            borderRadius="$full"
            onPress={() => setPeriod(item)}
          >
            {item}
          </Button>
        ))}
      </XStack>
      {data.length ? (
        <StockPriceLineChart
          testID="earn-pool-price-chart"
          data={data}
          volumeData={volumeData}
          overlay={overlay}
          onPriceBandDrag={draggable ? handleBandDrag : undefined}
          height={height}
          pulseLastPoint
          showCurrentPriceLabel
          hoverLabelShowsPrice={false}
          priceAxisFormatter={formatAxisPrice}
          onHoverChange={setHover}
        />
      ) : (
        <Skeleton w="100%" h={height} borderRadius="$3" />
      )}
      <XStack gap="$4" flexWrap="wrap">
        <LegendItem color={theme.neutral7.val} label={POOLS_COPY.volume} />
        {hasStrip ? (
          <LegendItem color={stripColor} label={POOLS_COPY.liquidity} />
        ) : null}
        {band ? (
          <LegendItem color={bandColor} label={POOLS_COPY.yourRange} outlined />
        ) : null}
      </XStack>
      {renderRangeControls ? (
        <YStack pt="$2">{renderRangeControls(flipped)}</YStack>
      ) : null}
    </PoolsCard>
  );
}
