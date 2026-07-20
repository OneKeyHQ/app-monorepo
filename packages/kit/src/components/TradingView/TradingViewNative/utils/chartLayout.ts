import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_BOTTOM_PADDING,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_TICK_COUNT,
  TRADING_VIEW_NATIVE_PRICE_AXIS_WIDTH,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
  TRADING_VIEW_NATIVE_TIME_AXIS_MIN_TICK_SPACING,
  TRADING_VIEW_NATIVE_WATERMARK_ASPECT_RATIO,
  TRADING_VIEW_NATIVE_WATERMARK_MAX_WIDTH,
  TRADING_VIEW_NATIVE_WATERMARK_MIN_WIDTH,
  TRADING_VIEW_NATIVE_WATERMARK_WIDTH_RATIO,
} from '../chartConstants';

import {
  type ITradingViewNativeVisiblePointRange,
  getTradingViewNativePriceRange,
} from './chartViewport';

export type ITradingViewNativeTimeAxisUnit =
  | 'minute'
  | 'hour'
  | 'day'
  | 'month'
  | 'year';

export interface ITradingViewNativeTimeTick {
  index: number;
  label: string;
  timestamp: number;
}

export interface ITradingViewNativeTimeAxisLayout {
  ticks: ITradingViewNativeTimeTick[];
  unit: ITradingViewNativeTimeAxisUnit | null;
}

export interface ITradingViewNativePriceTick {
  price: number;
  y: number;
}

export interface ITradingViewNativePriceTransform {
  scaleY: number;
  translateY: number;
}

export interface ITradingViewNativeCurrentPriceLayout {
  labelTop: number;
  lineY: number;
}

export interface ITradingViewNativeWatermarkLayout {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ITradingViewNativeChartLayout {
  maxPrice: number;
  maxVolume: number;
  minPrice: number;
  priceAxisX: number;
  priceChartHeight: number;
  priceRange: number;
  priceTicks: ITradingViewNativePriceTick[];
  timeAxisY: number;
  timeTicks: ITradingViewNativeTimeTick[];
  volumeBottom: number;
  volumeHeight: number;
}

interface ITimeAxisInterval {
  approximateSeconds: number;
  step: number;
  unit: ITradingViewNativeTimeAxisUnit;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const VOLUME_HEIGHT_RATIO = 0.2;
const PRICE_VOLUME_GAP_RATIO = 0.04;
const TIME_AXIS_INTERVALS: ITimeAxisInterval[] = [
  { approximateSeconds: SECONDS_PER_MINUTE, step: 1, unit: 'minute' },
  { approximateSeconds: 5 * SECONDS_PER_MINUTE, step: 5, unit: 'minute' },
  { approximateSeconds: 15 * SECONDS_PER_MINUTE, step: 15, unit: 'minute' },
  { approximateSeconds: 30 * SECONDS_PER_MINUTE, step: 30, unit: 'minute' },
  { approximateSeconds: SECONDS_PER_HOUR, step: 1, unit: 'hour' },
  { approximateSeconds: 2 * SECONDS_PER_HOUR, step: 2, unit: 'hour' },
  { approximateSeconds: 4 * SECONDS_PER_HOUR, step: 4, unit: 'hour' },
  { approximateSeconds: 6 * SECONDS_PER_HOUR, step: 6, unit: 'hour' },
  { approximateSeconds: 12 * SECONDS_PER_HOUR, step: 12, unit: 'hour' },
  { approximateSeconds: SECONDS_PER_DAY, step: 1, unit: 'day' },
  { approximateSeconds: 2 * SECONDS_PER_DAY, step: 2, unit: 'day' },
  { approximateSeconds: 7 * SECONDS_PER_DAY, step: 7, unit: 'day' },
  { approximateSeconds: 14 * SECONDS_PER_DAY, step: 14, unit: 'day' },
  { approximateSeconds: 30 * SECONDS_PER_DAY, step: 1, unit: 'month' },
  { approximateSeconds: 60 * SECONDS_PER_DAY, step: 2, unit: 'month' },
  { approximateSeconds: 90 * SECONDS_PER_DAY, step: 3, unit: 'month' },
  { approximateSeconds: 180 * SECONDS_PER_DAY, step: 6, unit: 'month' },
  { approximateSeconds: 365 * SECONDS_PER_DAY, step: 1, unit: 'year' },
  { approximateSeconds: 2 * 365 * SECONDS_PER_DAY, step: 2, unit: 'year' },
  { approximateSeconds: 5 * 365 * SECONDS_PER_DAY, step: 5, unit: 'year' },
  { approximateSeconds: 10 * 365 * SECONDS_PER_DAY, step: 10, unit: 'year' },
];

export function formatTradingViewNativePriceTick(price: number) {
  'worklet';

  return Number(price.toPrecision(6)).toString();
}

export function getTradingViewNativeChartWidth(width: number) {
  return Math.max(
    width -
      TRADING_VIEW_NATIVE_PRICE_AXIS_WIDTH -
      TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
    0,
  );
}

export function getTradingViewNativeWatermarkLayout({
  height,
  width,
}: {
  height: number;
  width: number;
}): ITradingViewNativeWatermarkLayout | null {
  if (
    !Number.isFinite(height) ||
    !Number.isFinite(width) ||
    height <= 0 ||
    width <= 0
  ) {
    return null;
  }

  const preferredWidth = Math.min(
    Math.max(
      width * TRADING_VIEW_NATIVE_WATERMARK_WIDTH_RATIO,
      TRADING_VIEW_NATIVE_WATERMARK_MIN_WIDTH,
    ),
    TRADING_VIEW_NATIVE_WATERMARK_MAX_WIDTH,
  );
  const watermarkWidth = Math.min(
    preferredWidth,
    width,
    height * TRADING_VIEW_NATIVE_WATERMARK_ASPECT_RATIO,
  );
  const watermarkHeight =
    watermarkWidth / TRADING_VIEW_NATIVE_WATERMARK_ASPECT_RATIO;

  return {
    height: watermarkHeight,
    width: watermarkWidth,
    x: (width - watermarkWidth) / 2,
    y: (height - watermarkHeight) / 2,
  };
}

function padTimeAxisValue(value: number) {
  return value.toString().padStart(2, '0');
}

function formatTradingViewNativeTimeTick(
  timestamp: number,
  unit: ITradingViewNativeTimeAxisUnit,
  previousTimestamp?: number,
) {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = padTimeAxisValue(date.getMonth() + 1);
  const day = padTimeAxisValue(date.getDate());
  const hour = padTimeAxisValue(date.getHours());
  const minute = padTimeAxisValue(date.getMinutes());

  if (unit === 'minute' || unit === 'hour') {
    const previousDate =
      previousTimestamp === undefined
        ? null
        : new Date(previousTimestamp * 1000);
    const startsNewLocalDay = Boolean(
      previousDate &&
      (date.getFullYear() !== previousDate.getFullYear() ||
        date.getMonth() !== previousDate.getMonth() ||
        date.getDate() !== previousDate.getDate()),
    );
    return startsNewLocalDay || (hour === '00' && minute === '00')
      ? `${month}/${day}`
      : `${hour}:${minute}`;
  }
  if (unit === 'day') {
    return month === '01' && day === '01' ? year.toString() : `${month}/${day}`;
  }
  if (unit === 'month') {
    return `${year}-${month}`;
  }
  return year.toString();
}

function getTimeAxisBucket(
  timestamp: number,
  { step, unit }: ITimeAxisInterval,
) {
  const date = new Date(timestamp * 1000);
  const localTimestamp =
    timestamp - date.getTimezoneOffset() * SECONDS_PER_MINUTE;
  if (unit === 'minute') {
    return Math.floor(localTimestamp / (step * SECONDS_PER_MINUTE));
  }
  if (unit === 'hour') {
    return Math.floor(localTimestamp / (step * SECONDS_PER_HOUR));
  }

  const year = date.getFullYear();
  if (unit === 'day') {
    const localDay = Math.floor(
      Date.UTC(year, date.getMonth(), date.getDate()) /
        (SECONDS_PER_DAY * 1000),
    );
    return Math.floor(localDay / step);
  }
  if (unit === 'month') {
    return Math.floor((year * 12 + date.getMonth()) / step);
  }
  return Math.floor(year / step);
}

function getClosestTimeAxisInterval({
  minimumSeconds,
  targetSeconds,
}: {
  minimumSeconds: number;
  targetSeconds: number;
}) {
  const firstEligibleInterval =
    TIME_AXIS_INTERVALS.find(
      ({ approximateSeconds }) => approximateSeconds >= minimumSeconds,
    ) ?? TIME_AXIS_INTERVALS[TIME_AXIS_INTERVALS.length - 1];

  return TIME_AXIS_INTERVALS.reduce((closestInterval, currentInterval) => {
    if (currentInterval.approximateSeconds < minimumSeconds) {
      return closestInterval;
    }

    return Math.abs(currentInterval.approximateSeconds - targetSeconds) <=
      Math.abs(closestInterval.approximateSeconds - targetSeconds)
      ? currentInterval
      : closestInterval;
  }, firstEligibleInterval);
}

export function getTradingViewNativeTimeTickMinimumIndexSpacing(
  pointSpacing: number,
) {
  'worklet';

  return pointSpacing > 0 && Number.isFinite(pointSpacing)
    ? Math.max(
        Math.ceil(
          TRADING_VIEW_NATIVE_TIME_AXIS_MIN_TICK_SPACING / pointSpacing,
        ),
        1,
      )
    : Number.MAX_SAFE_INTEGER;
}

export function getTradingViewNativeTimeAxisLayout({
  candleIntervalSeconds,
  chartWidth,
  endIndex,
  minimumIndexSpacing,
  points,
  startIndex,
}: {
  candleIntervalSeconds: number;
  chartWidth: number;
  endIndex: number;
  minimumIndexSpacing: number;
  points: IMarketTokenKLineDataPoint[];
  startIndex: number;
}): ITradingViewNativeTimeAxisLayout {
  const clampedStartIndex = Math.min(
    Math.max(Math.floor(startIndex), 0),
    points.length,
  );
  const clampedEndIndex = Math.min(
    Math.max(Math.floor(endIndex), clampedStartIndex),
    points.length,
  );
  const visiblePoints: Array<{ index: number; timestamp: number }> = [];

  for (let index = clampedStartIndex; index < clampedEndIndex; index += 1) {
    const timestamp = points[index]?.t;
    if (Number.isFinite(timestamp)) {
      visiblePoints.push({ index, timestamp });
    }
  }

  if (chartWidth <= 0 || !visiblePoints.length) {
    return { ticks: [], unit: null };
  }

  const firstVisiblePoint = visiblePoints[0];
  const lastVisiblePoint = visiblePoints[visiblePoints.length - 1];
  const visibleDuration = Math.max(
    lastVisiblePoint.timestamp - firstVisiblePoint.timestamp,
    0,
  );
  const maxTickCount = Math.max(
    Math.floor(chartWidth / TRADING_VIEW_NATIVE_TIME_AXIS_MIN_TICK_SPACING),
    2,
  );
  const targetInterval = visibleDuration / maxTickCount;
  const minimumInterval =
    candleIntervalSeconds > 0 && Number.isFinite(candleIntervalSeconds)
      ? candleIntervalSeconds
      : 0;
  const interval = getClosestTimeAxisInterval({
    minimumSeconds: minimumInterval,
    targetSeconds: targetInterval,
  });
  const tickCandidates: Array<{ index: number; timestamp: number }> = [];
  let previousBucket: number | null = null;

  for (let index = 0; index < points.length; index += 1) {
    const timestamp = points[index]?.t;
    if (Number.isFinite(timestamp)) {
      const bucket = getTimeAxisBucket(timestamp, interval);
      if (bucket !== previousBucket) {
        tickCandidates.push({ index, timestamp });
        previousBucket = bucket;
      }
    }
  }

  const normalizedMinimumIndexSpacing = Math.max(
    Math.ceil(minimumIndexSpacing),
    1,
  );
  const ticks: ITradingViewNativeTimeTick[] = [];
  let previousTick: ITradingViewNativeTimeTick | undefined;

  for (const candidate of tickCandidates) {
    if (
      !previousTick ||
      candidate.index - previousTick.index >= normalizedMinimumIndexSpacing
    ) {
      const tick = {
        ...candidate,
        label: formatTradingViewNativeTimeTick(
          candidate.timestamp,
          interval.unit,
          previousTick?.timestamp,
        ),
      };
      ticks.push(tick);
      previousTick = tick;
    }
  }

  return { ticks, unit: interval.unit };
}

export function getTradingViewNativeChartLayout({
  candleIntervalSeconds,
  height,
  minimumTimeTickIndexSpacing,
  points,
  visiblePointRange,
  width,
}: {
  candleIntervalSeconds: number;
  height: number;
  minimumTimeTickIndexSpacing: number;
  points: IMarketTokenKLineDataPoint[];
  visiblePointRange: ITradingViewNativeVisiblePointRange;
  width: number;
}): ITradingViewNativeChartLayout | null {
  const priceAxisX = width - TRADING_VIEW_NATIVE_PRICE_AXIS_WIDTH;
  const chartWidth = getTradingViewNativeChartWidth(width);
  const timeAxisY = height - TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT;
  const contentHeight =
    timeAxisY -
    TRADING_VIEW_NATIVE_CHART_TOP_PADDING -
    TRADING_VIEW_NATIVE_CHART_BOTTOM_PADDING;
  if (!points.length || chartWidth <= 0 || contentHeight <= 0) {
    return null;
  }

  const visiblePriceRange = getTradingViewNativePriceRange({
    ...visiblePointRange,
    points,
  });
  if (!visiblePriceRange) {
    return null;
  }

  const volumeHeight = contentHeight * VOLUME_HEIGHT_RATIO;
  const priceChartHeight =
    contentHeight * (1 - VOLUME_HEIGHT_RATIO - PRICE_VOLUME_GAP_RATIO);
  const volumeBottom = timeAxisY - TRADING_VIEW_NATIVE_CHART_BOTTOM_PADDING;
  const { maxPrice, minPrice } = visiblePriceRange;
  const priceRange = maxPrice - minPrice;
  const priceTickCount =
    priceRange === 0 ? 1 : TRADING_VIEW_NATIVE_PRICE_AXIS_TICK_COUNT;
  const priceTicks = Array.from(
    { length: priceTickCount },
    (_, index): ITradingViewNativePriceTick => {
      const progress =
        priceTickCount === 1 ? 0.5 : index / (priceTickCount - 1);
      return {
        price: maxPrice - priceRange * progress,
        y: TRADING_VIEW_NATIVE_CHART_TOP_PADDING + priceChartHeight * progress,
      };
    },
  );
  let maxVolume = 0;

  for (const point of points) {
    if (Number.isFinite(point.v)) {
      maxVolume = Math.max(maxVolume, point.v);
    }
  }

  const timeTicks = getTradingViewNativeTimeAxisLayout({
    candleIntervalSeconds,
    chartWidth,
    ...visiblePointRange,
    minimumIndexSpacing: minimumTimeTickIndexSpacing,
    points,
  }).ticks;

  return {
    maxPrice,
    maxVolume,
    minPrice,
    priceAxisX,
    priceChartHeight,
    priceRange,
    priceTicks,
    timeAxisY,
    timeTicks,
    volumeBottom,
    volumeHeight,
  };
}

export function getTradingViewNativePriceY(
  price: number,
  {
    maxPrice,
    priceChartHeight,
    priceRange,
  }: Pick<
    ITradingViewNativeChartLayout,
    'maxPrice' | 'priceChartHeight' | 'priceRange'
  >,
) {
  'worklet';

  return priceRange === 0
    ? TRADING_VIEW_NATIVE_CHART_TOP_PADDING + priceChartHeight / 2
    : TRADING_VIEW_NATIVE_CHART_TOP_PADDING +
        ((maxPrice - price) / priceRange) * priceChartHeight;
}

export function getTradingViewNativeCurrentPriceLayout({
  labelHeight,
  maxPrice,
  minPrice,
  price,
  priceChartHeight,
}: {
  labelHeight: number;
  maxPrice: number;
  minPrice: number;
  price: number;
  priceChartHeight: number;
}): ITradingViewNativeCurrentPriceLayout | null {
  'worklet';

  if (
    !Number.isFinite(labelHeight) ||
    !Number.isFinite(maxPrice) ||
    !Number.isFinite(minPrice) ||
    !Number.isFinite(price) ||
    !Number.isFinite(priceChartHeight) ||
    labelHeight <= 0 ||
    maxPrice < minPrice ||
    priceChartHeight <= 0
  ) {
    return null;
  }

  const chartTop = TRADING_VIEW_NATIVE_CHART_TOP_PADDING;
  const chartBottom = chartTop + priceChartHeight;
  const lineY = getTradingViewNativePriceY(price, {
    maxPrice,
    priceChartHeight,
    priceRange: maxPrice - minPrice,
  });
  if (lineY < chartTop || lineY > chartBottom) {
    return null;
  }

  const maximumLabelTop = Math.max(chartBottom - labelHeight, chartTop);
  return {
    labelTop: Math.min(
      Math.max(lineY - labelHeight / 2, chartTop),
      maximumLabelTop,
    ),
    lineY,
  };
}

export function getTradingViewNativePriceTransform({
  baseMaxPrice,
  basePriceRange,
  priceChartHeight,
  targetMaxPrice,
  targetPriceRange,
}: {
  baseMaxPrice: number;
  basePriceRange: number;
  priceChartHeight: number;
  targetMaxPrice: number;
  targetPriceRange: number;
}): ITradingViewNativePriceTransform {
  'worklet';

  if (
    !Number.isFinite(baseMaxPrice) ||
    !Number.isFinite(basePriceRange) ||
    !Number.isFinite(priceChartHeight) ||
    !Number.isFinite(targetMaxPrice) ||
    !Number.isFinite(targetPriceRange) ||
    basePriceRange <= 0 ||
    priceChartHeight <= 0 ||
    targetPriceRange < 0
  ) {
    return { scaleY: 1, translateY: 0 };
  }

  if (targetPriceRange === 0) {
    const baseY =
      TRADING_VIEW_NATIVE_CHART_TOP_PADDING +
      ((baseMaxPrice - targetMaxPrice) / basePriceRange) * priceChartHeight;
    return {
      scaleY: 1,
      translateY:
        TRADING_VIEW_NATIVE_CHART_TOP_PADDING + priceChartHeight / 2 - baseY,
    };
  }

  const scaleY = basePriceRange / targetPriceRange;
  return {
    scaleY,
    translateY:
      TRADING_VIEW_NATIVE_CHART_TOP_PADDING +
      ((targetMaxPrice - baseMaxPrice) / targetPriceRange) * priceChartHeight -
      scaleY * TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  };
}
