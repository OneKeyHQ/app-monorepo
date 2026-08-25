import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_BOTTOM_PADDING,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_LEFT_PADDING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_RIGHT_PADDING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_MIN_TICK_SPACING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_TICK_COUNT,
  TRADING_VIEW_NATIVE_PRICE_CHART_BOTTOM_PADDING,
  TRADING_VIEW_NATIVE_PRICE_EXTREMA_LABEL_GAP,
  TRADING_VIEW_NATIVE_PRICE_EXTREMA_LINE_LENGTH,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
  TRADING_VIEW_NATIVE_TIME_AXIS_MIN_TICK_SPACING,
  TRADING_VIEW_NATIVE_TIME_AXIS_TARGET_TICK_SPACING,
  TRADING_VIEW_NATIVE_VOLUME_AXIS_MAX_TICK_COUNT,
  TRADING_VIEW_NATIVE_VOLUME_AXIS_MIN_TICK_SPACING,
  TRADING_VIEW_NATIVE_WATERMARK_ASPECT_RATIO,
  TRADING_VIEW_NATIVE_WATERMARK_MAX_WIDTH,
  TRADING_VIEW_NATIVE_WATERMARK_MIN_WIDTH,
  TRADING_VIEW_NATIVE_WATERMARK_WIDTH_RATIO,
} from '../chartConstants';

import {
  type ITradingViewNativePriceRange,
  type ITradingViewNativeVisiblePointRange,
  getTradingViewNativePriceRange,
} from './chartViewport';
import {
  getTradingViewNativePriceAtProgress,
  getTradingViewNativePriceProgress,
  mergeTradingViewNativePriceRanges,
  resolveTradingViewNativePriceRange,
} from './priceScale';

import type {
  ITradingViewNativeChartType,
  ITradingViewNativePriceScaleMode,
} from '../types';

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

export interface ITradingViewNativeVolumeTick {
  volume: number;
  y: number;
}

export interface ITradingViewNativeCurrentPriceLayout {
  labelTop: number;
  lineY: number;
}

export interface ITradingViewNativePriceExtremumHorizontalLayout {
  lineEndX: number;
  textX: number;
}

export interface ITradingViewNativeWatermarkLayout {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ITradingViewNativeChartLayout {
  mainChartBottom: number;
  maxPrice: number;
  maxVolume: number;
  minPrice: number;
  priceAxisX: number;
  priceChartHeight: number;
  priceRange: number;
  priceScaleMode: ITradingViewNativePriceScaleMode;
  priceTicks: ITradingViewNativePriceTick[];
  timeAxisY: number;
  timeTicks: ITradingViewNativeTimeTick[];
  volumeBottom: number;
  volumeHeight: number;
  volumeTicks: ITradingViewNativeVolumeTick[];
  volumeTop: number;
}

interface ITimeAxisInterval {
  approximateSeconds: number;
  minimumRealizableSeconds: number;
  step: number;
  unit: ITradingViewNativeTimeAxisUnit;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const VOLUME_HEIGHT_RATIO = 0.2;
const PRICE_INTEGER_FRACTION_DIGITS = 2;
const PRICE_SIGNIFICANT_FRACTION_DIGITS = 4;
const PRICE_LEADING_ZERO_SUBSCRIPT_THRESHOLD = 4;
const PRICE_PLAIN_DECIMAL_MIN_ABSOLUTE_VALUE =
  10 ** -(PRICE_LEADING_ZERO_SUBSCRIPT_THRESHOLD + 1);
const PRICE_SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const MAX_TO_FIXED_FRACTION_DIGITS = 100;

function createTimeAxisInterval(
  unit: ITradingViewNativeTimeAxisUnit,
  step: number,
  approximateSeconds: number,
  minimumRealizableSeconds = approximateSeconds,
): ITimeAxisInterval {
  return {
    approximateSeconds,
    minimumRealizableSeconds,
    step,
    unit,
  };
}

// Calendar buckets can be shorter than their nominal duration around DST
// transitions and short months, so eligibility uses the shortest cadence.
const TIME_AXIS_INTERVALS: ITimeAxisInterval[] = [
  createTimeAxisInterval('minute', 1, SECONDS_PER_MINUTE),
  createTimeAxisInterval('minute', 5, 5 * SECONDS_PER_MINUTE),
  createTimeAxisInterval('minute', 15, 15 * SECONDS_PER_MINUTE),
  createTimeAxisInterval('minute', 30, 30 * SECONDS_PER_MINUTE),
  createTimeAxisInterval('hour', 1, SECONDS_PER_HOUR),
  createTimeAxisInterval('hour', 2, 2 * SECONDS_PER_HOUR, SECONDS_PER_HOUR),
  createTimeAxisInterval('hour', 4, 4 * SECONDS_PER_HOUR, 3 * SECONDS_PER_HOUR),
  createTimeAxisInterval('hour', 6, 6 * SECONDS_PER_HOUR, 5 * SECONDS_PER_HOUR),
  createTimeAxisInterval(
    'hour',
    12,
    12 * SECONDS_PER_HOUR,
    11 * SECONDS_PER_HOUR,
  ),
  createTimeAxisInterval('day', 1, SECONDS_PER_DAY, 23 * SECONDS_PER_HOUR),
  createTimeAxisInterval('day', 2, 2 * SECONDS_PER_DAY, 47 * SECONDS_PER_HOUR),
  createTimeAxisInterval('day', 7, 7 * SECONDS_PER_DAY, 167 * SECONDS_PER_HOUR),
  createTimeAxisInterval(
    'day',
    14,
    14 * SECONDS_PER_DAY,
    335 * SECONDS_PER_HOUR,
  ),
  createTimeAxisInterval(
    'month',
    1,
    30 * SECONDS_PER_DAY,
    28 * SECONDS_PER_DAY - SECONDS_PER_HOUR,
  ),
  createTimeAxisInterval(
    'month',
    2,
    60 * SECONDS_PER_DAY,
    59 * SECONDS_PER_DAY - SECONDS_PER_HOUR,
  ),
  createTimeAxisInterval(
    'month',
    3,
    90 * SECONDS_PER_DAY,
    90 * SECONDS_PER_DAY - SECONDS_PER_HOUR,
  ),
  createTimeAxisInterval('month', 6, 180 * SECONDS_PER_DAY),
  createTimeAxisInterval('year', 1, 365 * SECONDS_PER_DAY),
  createTimeAxisInterval('year', 2, 2 * 365 * SECONDS_PER_DAY),
  createTimeAxisInterval('year', 5, 5 * 365 * SECONDS_PER_DAY),
  createTimeAxisInterval('year', 10, 10 * 365 * SECONDS_PER_DAY),
];

function formatTradingViewNativeSubscript(value: number) {
  'worklet';

  const valueString = String(value);
  let result = '';
  for (let index = 0; index < valueString.length; index += 1) {
    const digitIndex = valueString.charCodeAt(index) - 48;
    result += PRICE_SUBSCRIPT_DIGITS[digitIndex] ?? valueString[index];
  }
  return result;
}

function compactTradingViewNativePriceLeadingZeros(value: string) {
  'worklet';

  const signLength = value[0] === '-' ? 1 : 0;
  if (value[signLength] !== '0' || value[signLength + 1] !== '.') {
    return value;
  }

  const fractionStartIndex = signLength + 2;
  let firstSignificantDigitIndex = fractionStartIndex;
  while (
    firstSignificantDigitIndex < value.length &&
    value[firstSignificantDigitIndex] === '0'
  ) {
    firstSignificantDigitIndex += 1;
  }
  const leadingZeroCount = firstSignificantDigitIndex - fractionStartIndex;
  if (
    leadingZeroCount <= PRICE_LEADING_ZERO_SUBSCRIPT_THRESHOLD ||
    firstSignificantDigitIndex === value.length
  ) {
    return value;
  }

  return `${signLength ? '-' : ''}0.0${formatTradingViewNativeSubscript(
    leadingZeroCount,
  )}${value.slice(firstSignificantDigitIndex)}`;
}

export function formatTradingViewNativePriceTick(price: number) {
  'worklet';

  if (!Number.isFinite(price)) {
    return '--';
  }

  const absolutePrice = Math.abs(price);
  if (absolutePrice === 0) {
    return '0.00';
  }
  if (absolutePrice >= 1) {
    return price.toFixed(PRICE_INTEGER_FRACTION_DIGITS);
  }

  const leadingZeroCount = Math.max(
    -Math.floor(Math.log10(absolutePrice)) - 1,
    0,
  );
  const fractionDigits = leadingZeroCount + PRICE_SIGNIFICANT_FRACTION_DIGITS;
  if (fractionDigits > MAX_TO_FIXED_FRACTION_DIGITS) {
    return Number(
      price.toPrecision(PRICE_SIGNIFICANT_FRACTION_DIGITS),
    ).toString();
  }

  const fixedPrice = price.toFixed(fractionDigits);
  const roundedPrice = Number(fixedPrice);
  if (Math.abs(roundedPrice) >= 1) {
    return roundedPrice.toFixed(PRICE_INTEGER_FRACTION_DIGITS);
  }
  const decimalIndex = fixedPrice.indexOf('.');
  let endIndex = fixedPrice.length;
  while (endIndex > decimalIndex + 1 && fixedPrice[endIndex - 1] === '0') {
    endIndex -= 1;
  }
  return compactTradingViewNativePriceLeadingZeros(
    fixedPrice.slice(
      0,
      endIndex === decimalIndex + 1 ? decimalIndex : endIndex,
    ),
  );
}

function getTradingViewNativeWidestDigitLabel(label: string) {
  'worklet';

  let widestLabel = '';
  for (let index = 0; index < label.length; index += 1) {
    const character = label[index];
    const characterCode = label.charCodeAt(index);
    widestLabel += characterCode >= 48 && characterCode <= 57 ? '8' : character;
  }
  return widestLabel;
}

function getTradingViewNativePriceAxisCandidateLabel(price: number) {
  'worklet';

  const absolutePrice = Math.abs(price);
  let label = getTradingViewNativeWidestDigitLabel(
    formatTradingViewNativePriceTick(price),
  );
  if (absolutePrice > 0 && absolutePrice < 1) {
    const leadingZeroCount = Math.max(
      -Math.floor(Math.log10(absolutePrice)) - 1,
      0,
    );
    if (
      leadingZeroCount + PRICE_SIGNIFICANT_FRACTION_DIGITS <=
      MAX_TO_FIXED_FRACTION_DIGITS
    ) {
      label = compactTradingViewNativePriceLeadingZeros(
        `${price < 0 ? '-' : ''}0.${'0'.repeat(leadingZeroCount)}${'8'.repeat(
          PRICE_SIGNIFICANT_FRACTION_DIGITS,
        )}`,
      );
    }
  }
  return label;
}

function getTradingViewNativeLongerPriceAxisLabel(
  currentLabel: string,
  candidatePrice: number,
) {
  'worklet';

  const candidateLabel =
    getTradingViewNativePriceAxisCandidateLabel(candidatePrice);
  return candidateLabel.length > currentLabel.length
    ? candidateLabel
    : currentLabel;
}

function getTradingViewNativePlainDecimalPriceAxisLabel(isNegative: boolean) {
  'worklet';

  return `${isNegative ? '-' : ''}0.${'0'.repeat(
    PRICE_LEADING_ZERO_SUBSCRIPT_THRESHOLD,
  )}${'8'.repeat(PRICE_SIGNIFICANT_FRACTION_DIGITS)}`;
}

export function getTradingViewNativePriceAxisLabel(
  points: IMarketTokenKLineDataPoint[],
) {
  'worklet';

  let largestNonNegativePrice = 0;
  let largestNegativePrice = 0;
  let smallestPositiveSubOnePrice = Number.POSITIVE_INFINITY;
  let smallestNegativeSubOnePrice = Number.NEGATIVE_INFINITY;
  let hasFinitePrice = false;
  // Collect numeric boundaries here and format only constant-count candidates.
  for (const point of points) {
    for (let priceIndex = 0; priceIndex < 4; priceIndex += 1) {
      let price = point.o;
      if (priceIndex === 1) {
        price = point.h;
      } else if (priceIndex === 2) {
        price = point.l;
      } else if (priceIndex === 3) {
        price = point.c;
      }
      if (Number.isFinite(price)) {
        hasFinitePrice = true;
        if (price >= 0) {
          largestNonNegativePrice = Math.max(largestNonNegativePrice, price);
          if (price > 0 && price < 1) {
            smallestPositiveSubOnePrice = Math.min(
              smallestPositiveSubOnePrice,
              price,
            );
          }
        } else {
          largestNegativePrice = Math.min(largestNegativePrice, price);
          if (price > -1) {
            smallestNegativeSubOnePrice = Math.max(
              smallestNegativeSubOnePrice,
              price,
            );
          }
        }
      }
    }
  }

  if (!hasFinitePrice) {
    return formatTradingViewNativePriceTick(0);
  }

  let longestLabel = getTradingViewNativePriceAxisCandidateLabel(
    largestNonNegativePrice,
  );
  if (largestNegativePrice < 0) {
    longestLabel = getTradingViewNativeLongerPriceAxisLabel(
      longestLabel,
      largestNegativePrice,
    );
  }
  if (Number.isFinite(smallestPositiveSubOnePrice)) {
    longestLabel = getTradingViewNativeLongerPriceAxisLabel(
      longestLabel,
      smallestPositiveSubOnePrice,
    );
  }
  if (Number.isFinite(smallestNegativeSubOnePrice)) {
    longestLabel = getTradingViewNativeLongerPriceAxisLabel(
      longestLabel,
      smallestNegativeSubOnePrice,
    );
  }

  // Ticks and crosshair prices interpolate between extrema. Include the
  // longest plain-decimal regime only when the continuous range can reach it.
  if (
    smallestPositiveSubOnePrice < PRICE_PLAIN_DECIMAL_MIN_ABSOLUTE_VALUE &&
    largestNonNegativePrice >= PRICE_PLAIN_DECIMAL_MIN_ABSOLUTE_VALUE
  ) {
    const candidateLabel =
      getTradingViewNativePlainDecimalPriceAxisLabel(false);
    if (candidateLabel.length > longestLabel.length) {
      longestLabel = candidateLabel;
    }
  }
  if (
    smallestNegativeSubOnePrice > -PRICE_PLAIN_DECIMAL_MIN_ABSOLUTE_VALUE &&
    largestNegativePrice <= -PRICE_PLAIN_DECIMAL_MIN_ABSOLUTE_VALUE
  ) {
    const candidateLabel = getTradingViewNativePlainDecimalPriceAxisLabel(true);
    if (candidateLabel.length > longestLabel.length) {
      longestLabel = candidateLabel;
    }
  }
  return longestLabel;
}

export function getTradingViewNativeScaledPriceAxisLabel({
  autoPriceRange,
  baseLabel = '',
  priceRangeScale,
  priceScaleMode,
}: {
  autoPriceRange: ITradingViewNativePriceRange;
  baseLabel?: string;
  priceRangeScale: number;
  priceScaleMode: ITradingViewNativePriceScaleMode;
}) {
  'worklet';

  const { maxPrice, minPrice } = resolveTradingViewNativePriceRange({
    autoPriceRange,
    rangeScale: priceRangeScale,
    requestedMode: priceScaleMode,
  });
  let longestLabel = getTradingViewNativeLongerPriceAxisLabel(
    baseLabel,
    minPrice,
  );
  longestLabel = getTradingViewNativeLongerPriceAxisLabel(
    longestLabel,
    maxPrice,
  );

  if (
    minPrice < PRICE_PLAIN_DECIMAL_MIN_ABSOLUTE_VALUE &&
    maxPrice >= PRICE_PLAIN_DECIMAL_MIN_ABSOLUTE_VALUE
  ) {
    const candidateLabel =
      getTradingViewNativePlainDecimalPriceAxisLabel(false);
    if (candidateLabel.length > longestLabel.length) {
      longestLabel = candidateLabel;
    }
  }
  if (
    minPrice <= -PRICE_PLAIN_DECIMAL_MIN_ABSOLUTE_VALUE &&
    maxPrice > -PRICE_PLAIN_DECIMAL_MIN_ABSOLUTE_VALUE
  ) {
    const candidateLabel = getTradingViewNativePlainDecimalPriceAxisLabel(true);
    if (candidateLabel.length > longestLabel.length) {
      longestLabel = candidateLabel;
    }
  }
  return longestLabel;
}

export function getTradingViewNativeCurrentPriceLabel(
  points: IMarketTokenKLineDataPoint[],
) {
  'worklet';

  const currentPrice = points[points.length - 1]?.c;
  return typeof currentPrice === 'number' && Number.isFinite(currentPrice)
    ? formatTradingViewNativePriceTick(currentPrice)
    : '';
}

export function getTradingViewNativePriceAxisWidth({
  currentPriceLabelWidth,
  minimumWidth = 0,
  widestPriceLabelWidth,
  widestVolumeLabelWidth = 0,
}: {
  currentPriceLabelWidth: number;
  minimumWidth?: number;
  widestPriceLabelWidth: number;
  widestVolumeLabelWidth?: number;
}) {
  'worklet';

  const normalizedCurrentPriceLabelWidth = Number.isFinite(
    currentPriceLabelWidth,
  )
    ? Math.max(Math.ceil(currentPriceLabelWidth), 0)
    : 0;
  const normalizedWidestPriceLabelWidth = Number.isFinite(widestPriceLabelWidth)
    ? Math.max(Math.ceil(widestPriceLabelWidth), 0)
    : 0;
  const normalizedWidestVolumeLabelWidth = Number.isFinite(
    widestVolumeLabelWidth,
  )
    ? Math.max(Math.ceil(widestVolumeLabelWidth), 0)
    : 0;
  const normalizedMinimumWidth = Number.isFinite(minimumWidth)
    ? Math.max(Math.ceil(minimumWidth), 0)
    : 0;
  return Math.max(
    normalizedMinimumWidth,
    Math.max(
      normalizedWidestPriceLabelWidth,
      normalizedWidestVolumeLabelWidth,
    ) +
      TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_LEFT_PADDING +
      TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_RIGHT_PADDING,
    normalizedCurrentPriceLabelWidth +
      TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_LEFT_PADDING +
      TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_HORIZONTAL_PADDING,
  );
}

export function getTradingViewNativeChartWidth(
  width: number,
  priceAxisWidth: number,
) {
  'worklet';

  const normalizedPriceAxisWidth = Number.isFinite(priceAxisWidth)
    ? Math.max(priceAxisWidth, 0)
    : 0;
  return Math.max(
    width -
      normalizedPriceAxisWidth -
      TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
    0,
  );
}

export function getTradingViewNativePriceExtremumHorizontalLayout({
  anchorX,
  canvasWidth,
  textWidth,
}: {
  anchorX: number;
  canvasWidth: number;
  textWidth: number;
}): ITradingViewNativePriceExtremumHorizontalLayout {
  'worklet';

  const shouldPlaceLabelOnLeft = anchorX > canvasWidth / 2;
  const lineEndX =
    anchorX +
    (shouldPlaceLabelOnLeft
      ? -TRADING_VIEW_NATIVE_PRICE_EXTREMA_LINE_LENGTH
      : TRADING_VIEW_NATIVE_PRICE_EXTREMA_LINE_LENGTH);
  const textX = shouldPlaceLabelOnLeft
    ? lineEndX - TRADING_VIEW_NATIVE_PRICE_EXTREMA_LABEL_GAP - textWidth
    : lineEndX + TRADING_VIEW_NATIVE_PRICE_EXTREMA_LABEL_GAP;

  return { lineEndX, textX };
}

export function getTradingViewNativeWatermarkLayout({
  height,
  width,
}: {
  height: number;
  width: number;
}): ITradingViewNativeWatermarkLayout | null {
  'worklet';

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

export function hasTradingViewNativeVolume(
  points: IMarketTokenKLineDataPoint[],
) {
  return points.some((point) => Number.isFinite(point.v) && point.v > 0);
}

export function getTradingViewNativeMaxVolume({
  endIndex,
  points,
  startIndex,
}: ITradingViewNativeVisiblePointRange & {
  points: IMarketTokenKLineDataPoint[];
}) {
  'worklet';

  const normalizedStartIndex = Math.max(Math.floor(startIndex), 0);
  const normalizedEndIndex = Math.min(Math.ceil(endIndex), points.length);
  let maxVolume = 0;
  for (
    let index = normalizedStartIndex;
    index < normalizedEndIndex;
    index += 1
  ) {
    const volume = points[index]?.v;
    if (Number.isFinite(volume)) {
      maxVolume = Math.max(maxVolume, volume ?? 0);
    }
  }
  return maxVolume;
}

export function getTradingViewNativeVolumeBarHeight({
  maxVolume,
  volume,
  volumeHeight,
}: {
  maxVolume: number;
  volume: number;
  volumeHeight: number;
}) {
  'worklet';

  return Number.isFinite(maxVolume) &&
    Number.isFinite(volume) &&
    Number.isFinite(volumeHeight) &&
    maxVolume > 0 &&
    volume > 0 &&
    volumeHeight > 0
    ? (volume / maxVolume) * volumeHeight
    : 0;
}

function padTimeAxisValue(value: number) {
  'worklet';

  return value.toString().padStart(2, '0');
}

export function formatTradingViewNativeCrosshairTime(
  timestamp: number,
  candleIntervalSeconds: number,
) {
  'worklet';

  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = padTimeAxisValue(date.getMonth() + 1);
  const day = padTimeAxisValue(date.getDate());
  const dateLabel = `${year}-${month}-${day}`;

  if (candleIntervalSeconds >= SECONDS_PER_DAY) {
    return dateLabel;
  }

  const hour = padTimeAxisValue(date.getHours());
  const minute = padTimeAxisValue(date.getMinutes());
  return `${dateLabel} ${hour}:${minute}`;
}

function formatTradingViewNativeTimeTick(
  timestamp: number,
  unit: ITradingViewNativeTimeAxisUnit,
  previousTimestamp?: number,
) {
  'worklet';

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
  'worklet';

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
  'worklet';

  const firstEligibleInterval =
    TIME_AXIS_INTERVALS.find(
      ({ minimumRealizableSeconds }) =>
        minimumRealizableSeconds >= minimumSeconds,
    ) ?? TIME_AXIS_INTERVALS[TIME_AXIS_INTERVALS.length - 1];

  return TIME_AXIS_INTERVALS.reduce((closestInterval, currentInterval) => {
    if (currentInterval.minimumRealizableSeconds < minimumSeconds) {
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
  'worklet';

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
    Math.floor(chartWidth / TRADING_VIEW_NATIVE_TIME_AXIS_TARGET_TICK_SPACING),
    2,
  );
  const targetInterval = visibleDuration / maxTickCount;
  const normalizedMinimumIndexSpacing = Math.max(
    Math.ceil(minimumIndexSpacing),
    1,
  );
  // Select a drawable interval first so viewport changes cannot shift the
  // phase of a finer tick set during collision filtering.
  const minimumInterval =
    candleIntervalSeconds > 0 && Number.isFinite(candleIntervalSeconds)
      ? candleIntervalSeconds * normalizedMinimumIndexSpacing
      : 0;
  const interval = getClosestTimeAxisInterval({
    minimumSeconds: minimumInterval,
    targetSeconds: targetInterval,
  });
  // Align an expanded window so nearby viewport updates keep the same
  // tick anchors without rebuilding candidates for the full history.
  const tickWindowPadding = normalizedMinimumIndexSpacing * 2;
  const tickWindowStart = Math.max(
    Math.floor(
      (clampedStartIndex - tickWindowPadding) / normalizedMinimumIndexSpacing,
    ) * normalizedMinimumIndexSpacing,
    0,
  );
  const tickWindowEnd = Math.min(
    Math.ceil(
      (clampedEndIndex + tickWindowPadding) / normalizedMinimumIndexSpacing,
    ) * normalizedMinimumIndexSpacing,
    points.length,
  );
  const ticks: ITradingViewNativeTimeTick[] = [];
  let previousTick: ITradingViewNativeTimeTick | undefined;
  const previousTimestamp =
    tickWindowStart > 0 ? points[tickWindowStart - 1]?.t : undefined;
  let previousBucket =
    typeof previousTimestamp === 'number' && Number.isFinite(previousTimestamp)
      ? getTimeAxisBucket(previousTimestamp, interval)
      : null;

  for (let index = tickWindowStart; index < tickWindowEnd; index += 1) {
    const timestamp = points[index]?.t;
    if (Number.isFinite(timestamp)) {
      const bucket = getTimeAxisBucket(timestamp, interval);
      if (bucket !== previousBucket) {
        previousBucket = bucket;
        if (
          !previousTick ||
          index - previousTick.index >= normalizedMinimumIndexSpacing
        ) {
          const tick = {
            index,
            label: formatTradingViewNativeTimeTick(
              timestamp,
              interval.unit,
              previousTick?.timestamp,
            ),
            timestamp,
          };
          ticks.push(tick);
          previousTick = tick;
        }
      }
    }
  }

  return { ticks, unit: interval.unit };
}

export function getTradingViewNativeChartLayout({
  additionalPriceRange,
  candleIntervalSeconds,
  chartType = 'candlestick',
  contentBottomInset = 0,
  hasVolume,
  height,
  minimumTimeTickIndexSpacing,
  points,
  priceAxisWidth,
  priceRangeScale = 1,
  priceScaleMode = 'linear',
  visiblePointRange,
  width,
}: {
  additionalPriceRange?: {
    maxPrice: number;
    minPrice: number;
  } | null;
  candleIntervalSeconds: number;
  chartType?: ITradingViewNativeChartType;
  contentBottomInset?: number;
  hasVolume: boolean;
  height: number;
  minimumTimeTickIndexSpacing: number;
  points: IMarketTokenKLineDataPoint[];
  priceAxisWidth: number;
  priceRangeScale?: number;
  priceScaleMode?: ITradingViewNativePriceScaleMode;
  visiblePointRange: ITradingViewNativeVisiblePointRange;
  width: number;
}): ITradingViewNativeChartLayout | null {
  'worklet';

  const chartWidth = getTradingViewNativeChartWidth(width, priceAxisWidth);
  const priceAxisX = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + chartWidth;
  const timeAxisY = height - TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT;
  const normalizedContentBottomInset = Number.isFinite(contentBottomInset)
    ? Math.max(contentBottomInset, 0)
    : 0;
  const mainChartBottom = Math.max(
    timeAxisY - normalizedContentBottomInset,
    TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  );
  const contentHeight =
    mainChartBottom -
    TRADING_VIEW_NATIVE_CHART_TOP_PADDING -
    TRADING_VIEW_NATIVE_CHART_BOTTOM_PADDING;
  if (!points.length || chartWidth <= 0 || contentHeight <= 0) {
    return null;
  }

  const visiblePointPriceRange = getTradingViewNativePriceRange({
    ...visiblePointRange,
    chartType,
    points,
  });
  if (!visiblePointPriceRange) {
    return null;
  }

  const autoPriceRange =
    mergeTradingViewNativePriceRanges({
      additionalPriceRange,
      priceRange: visiblePointPriceRange,
    }) ?? visiblePointPriceRange;
  const {
    maxPrice,
    minPrice,
    mode: resolvedPriceScaleMode,
  } = resolveTradingViewNativePriceRange({
    autoPriceRange,
    rangeScale: priceRangeScale,
    requestedMode: priceScaleMode,
  });

  const volumeHeight = hasVolume ? contentHeight * VOLUME_HEIGHT_RATIO : 0;
  const priceChartHeight = Math.max(
    contentHeight -
      volumeHeight -
      TRADING_VIEW_NATIVE_PRICE_CHART_BOTTOM_PADDING,
    0,
  );
  if (priceChartHeight <= 0) {
    return null;
  }
  const volumeBottom =
    mainChartBottom - TRADING_VIEW_NATIVE_CHART_BOTTOM_PADDING;
  const volumeTop = volumeBottom - volumeHeight;
  const priceRange = maxPrice - minPrice;
  const priceTickCount =
    priceRange === 0
      ? 1
      : Math.min(
          Math.max(
            Math.floor(
              priceChartHeight /
                TRADING_VIEW_NATIVE_PRICE_AXIS_MIN_TICK_SPACING,
            ) + 1,
            1,
          ),
          TRADING_VIEW_NATIVE_PRICE_AXIS_TICK_COUNT,
        );
  const priceTicks = Array.from(
    { length: priceTickCount },
    (_, index): ITradingViewNativePriceTick => {
      const progress =
        priceTickCount === 1 ? 0.5 : index / (priceTickCount - 1);
      return {
        price: getTradingViewNativePriceAtProgress({
          maxPrice,
          minPrice,
          mode: resolvedPriceScaleMode,
          progress,
        }),
        y: TRADING_VIEW_NATIVE_CHART_TOP_PADDING + priceChartHeight * progress,
      };
    },
  );
  const maxVolume = getTradingViewNativeMaxVolume({
    ...visiblePointRange,
    points,
  });
  const volumeTickCount =
    maxVolume > 0 && volumeHeight > 0
      ? Math.min(
          Math.max(
            Math.floor(
              volumeHeight / TRADING_VIEW_NATIVE_VOLUME_AXIS_MIN_TICK_SPACING,
            ) - 1,
            1,
          ),
          TRADING_VIEW_NATIVE_VOLUME_AXIS_MAX_TICK_COUNT,
        )
      : 0;
  const volumeTicks = Array.from(
    { length: volumeTickCount },
    (_, index): ITradingViewNativeVolumeTick => {
      const progress = (index + 1) / (volumeTickCount + 1);
      return {
        volume: maxVolume * (1 - progress),
        y: volumeTop + volumeHeight * progress,
      };
    },
  );

  const timeTicks = getTradingViewNativeTimeAxisLayout({
    candleIntervalSeconds,
    chartWidth,
    ...visiblePointRange,
    minimumIndexSpacing: minimumTimeTickIndexSpacing,
    points,
  }).ticks;

  return {
    mainChartBottom,
    maxPrice,
    maxVolume,
    minPrice,
    priceAxisX,
    priceChartHeight,
    priceRange,
    priceScaleMode: resolvedPriceScaleMode,
    priceTicks,
    timeAxisY,
    timeTicks,
    volumeBottom,
    volumeHeight,
    volumeTicks,
    volumeTop,
  };
}

export function getTradingViewNativePriceY(
  price: number,
  {
    maxPrice,
    minPrice,
    priceChartHeight,
    priceScaleMode = 'linear',
  }: Pick<
    ITradingViewNativeChartLayout,
    'maxPrice' | 'minPrice' | 'priceChartHeight'
  > &
    Partial<Pick<ITradingViewNativeChartLayout, 'priceScaleMode'>>,
) {
  'worklet';

  const chartTop = TRADING_VIEW_NATIVE_CHART_TOP_PADDING;
  const progress = getTradingViewNativePriceProgress({
    maxPrice,
    minPrice,
    mode: priceScaleMode,
    price,
  });
  return progress === null
    ? chartTop + priceChartHeight + 1
    : chartTop + progress * priceChartHeight;
}

export function getTradingViewNativePriceAtY({
  maxPrice,
  minPrice,
  priceChartHeight,
  priceScaleMode = 'linear',
  y,
}: {
  maxPrice: number;
  minPrice: number;
  priceChartHeight: number;
  priceScaleMode?: ITradingViewNativePriceScaleMode;
  y: number;
}) {
  'worklet';

  const chartBottom = TRADING_VIEW_NATIVE_CHART_TOP_PADDING + priceChartHeight;
  if (
    !Number.isFinite(maxPrice) ||
    !Number.isFinite(minPrice) ||
    !Number.isFinite(y) ||
    priceChartHeight <= 0 ||
    y < TRADING_VIEW_NATIVE_CHART_TOP_PADDING ||
    y > chartBottom
  ) {
    return null;
  }

  const progress =
    (y - TRADING_VIEW_NATIVE_CHART_TOP_PADDING) / priceChartHeight;
  return getTradingViewNativePriceAtProgress({
    maxPrice,
    minPrice,
    mode: priceScaleMode,
    progress,
  });
}

export function getTradingViewNativeVolumeAtY({
  maxVolume,
  volumeBottom,
  volumeHeight,
  volumeTop,
  y,
}: {
  maxVolume: number;
  volumeBottom: number;
  volumeHeight: number;
  volumeTop: number;
  y: number;
}) {
  'worklet';

  if (
    !Number.isFinite(maxVolume) ||
    !Number.isFinite(volumeBottom) ||
    !Number.isFinite(volumeHeight) ||
    !Number.isFinite(volumeTop) ||
    !Number.isFinite(y) ||
    maxVolume <= 0 ||
    volumeHeight <= 0 ||
    y < volumeTop ||
    y > volumeBottom
  ) {
    return null;
  }

  const progress = (volumeBottom - y) / volumeHeight;
  return maxVolume * Math.min(Math.max(progress, 0), 1);
}

export function getTradingViewNativeCurrentPriceLayout({
  labelHeight,
  maxPrice,
  minPrice,
  price,
  priceChartHeight,
  priceScaleMode = 'linear',
}: {
  labelHeight: number;
  maxPrice: number;
  minPrice: number;
  price: number;
  priceChartHeight: number;
  priceScaleMode?: ITradingViewNativePriceScaleMode;
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
    minPrice,
    priceChartHeight,
    priceScaleMode,
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
