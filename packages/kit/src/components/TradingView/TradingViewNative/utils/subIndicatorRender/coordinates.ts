import { formatTradingViewNativePriceTick } from '../chartLayout';
import { formatTradingViewNativeVolume } from '../chartLegend';
import {
  getTradingViewNativePriceAtProgress,
  getTradingViewNativePriceProgress,
} from '../priceScale';

import { getTradingViewNativeSubIndicatorValueRange } from './range';

import type {
  ITradingViewNativeSubIndicatorFormat,
  ITradingViewNativeSubIndicatorRenderPane,
  ITradingViewNativeSubIndicatorValueRange,
} from './types';

const MAX_FIXED_PRECISION = 20;
const INHERITED_PRICE_PLAIN_DECIMAL_BOUNDARY = 0.000_888_8;
const VOLUME_UNIT_RANGES = [
  { max: 1_000_000, min: 1000, suffix: 'K' },
  { max: 1_000_000_000, min: 1_000_000, suffix: 'M' },
  { max: 1_000_000_000_000, min: 1_000_000_000, suffix: 'B' },
  { max: Number.POSITIVE_INFINITY, min: 1_000_000_000_000, suffix: 'T' },
] as const;
// Widest suffix first: "M" is the widest of these glyphs in common UI fonts.
const VOLUME_SUFFIXES_BY_WIDTH = ['M', 'K', 'B', 'T'];

function getNormalizedPrecision(precision: number | undefined) {
  'worklet';

  return typeof precision === 'number' && Number.isFinite(precision)
    ? Math.min(Math.max(Math.floor(precision), 0), MAX_FIXED_PRECISION)
    : undefined;
}

function formatSignedTradingViewNativeVolume(
  value: number,
  maxFractionDigits?: number,
) {
  'worklet';

  if (!Number.isFinite(value)) {
    return '--';
  }
  let absoluteValue = Math.abs(value);
  if (maxFractionDigits !== undefined && absoluteValue < 1000) {
    // Match the four significant digits of K/M/B/T labels below one unit.
    absoluteValue = Number(
      Number(absoluteValue.toPrecision(4)).toFixed(maxFractionDigits),
    );
  } else if (absoluteValue > 0 && absoluteValue < 0.0001) {
    return formatTradingViewNativePriceTick(value, 6);
  }
  const formattedValue = formatTradingViewNativeVolume(absoluteValue);
  return value < 0 && absoluteValue > 0 && formattedValue !== '--'
    ? `-${formattedValue}`
    : formattedValue;
}

export function formatTradingViewNativeSubIndicatorValue(
  value: number,
  format: ITradingViewNativeSubIndicatorFormat,
) {
  'worklet';

  if (!Number.isFinite(value)) {
    return '--';
  }
  const precision = getNormalizedPrecision(format.precision);
  if (format.type === 'volume') {
    return formatSignedTradingViewNativeVolume(value, precision);
  }
  // An inherited format carries the main price axis precision once it is known.
  if (
    (format.type === 'price' || format.type === 'inherit') &&
    precision !== undefined
  ) {
    const text = value.toFixed(precision);
    // toFixed keeps the sign of negative values that round to zero.
    return Number(text) === 0 ? text.replace('-', '') : text;
  }
  return formatTradingViewNativePriceTick(value);
}

// Legend and crosshair readouts never show a nonzero value as zero. Axis ticks
// keep the fixed precision so the reserved axis width stays bounded.
export function formatTradingViewNativeSubIndicatorReadoutValue(
  value: number,
  format: ITradingViewNativeSubIndicatorFormat,
) {
  'worklet';

  const text = formatTradingViewNativeSubIndicatorValue(value, format);
  if (
    value === 0 ||
    getNormalizedPrecision(format.precision) === undefined ||
    Number(text) !== 0
  ) {
    return text;
  }
  return formatTradingViewNativeSubIndicatorValue(value, { type: format.type });
}

export function getTradingViewNativeSubIndicatorY({
  bottom,
  range,
  top,
  value,
}: {
  bottom: number;
  range: ITradingViewNativeSubIndicatorValueRange;
  top: number;
  value: number;
}) {
  'worklet';

  const height = Math.max(bottom - top, 0);
  const valueSpan = range.maxValue - range.minValue;
  if (!Number.isFinite(value) || height <= 0 || valueSpan <= 0) {
    return top + height / 2;
  }
  const progress = getTradingViewNativePriceProgress({
    maxPrice: range.maxValue,
    minPrice: range.minValue,
    mode: range.mode ?? 'linear',
    price: value,
  });
  // Non-positive values cannot be plotted on a logarithmic axis.
  return progress === null ? bottom + height : top + progress * height;
}

export function getTradingViewNativeSubIndicatorValueAtY({
  bottom,
  range,
  top,
  y,
}: {
  bottom: number;
  range: ITradingViewNativeSubIndicatorValueRange;
  top: number;
  y: number;
}) {
  'worklet';

  const height = bottom - top;
  const valueSpan = range.maxValue - range.minValue;
  if (
    height <= 0 ||
    valueSpan <= 0 ||
    !Number.isFinite(y) ||
    y < top ||
    y > bottom
  ) {
    return null;
  }
  return getTradingViewNativePriceAtProgress({
    maxPrice: range.maxValue,
    minPrice: range.minValue,
    mode: range.mode ?? 'linear',
    progress: (y - top) / height,
  });
}

export function getTradingViewNativeSubIndicatorAxisLabel(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
) {
  'worklet';

  let widestLabel = '';
  const includeLabel = (label: string, preferOnTie = false) => {
    if (
      label.length > widestLabel.length ||
      (preferOnTie && label.length === widestLabel.length)
    ) {
      widestLabel = label;
    }
  };
  const includeValue = (
    value: number | null | undefined,
    format: ITradingViewNativeSubIndicatorFormat,
  ) => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return;
    }
    includeLabel(formatTradingViewNativeSubIndicatorValue(value, format));
  };

  for (const pane of panes) {
    if (pane.isVisible) {
      let pointCount = 0;
      for (const series of pane.series) {
        pointCount = Math.max(pointCount, series.values.length);
      }
      const range = getTradingViewNativeSubIndicatorValueRange({
        endIndex: pointCount,
        pane,
        startIndex: 0,
      });
      if (range) {
        for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
          includeValue(
            getTradingViewNativePriceAtProgress({
              maxPrice: range.maxValue,
              minPrice: range.minValue,
              mode: range.mode ?? 'linear',
              progress,
            }),
            pane.format,
          );
        }
        if (pane.format.type === 'volume') {
          const maxAbsoluteValue = Math.max(
            Math.abs(range.minValue),
            Math.abs(range.maxValue),
          );
          let referenceAbsoluteValue = maxAbsoluteValue;
          if (range.minValue > 0) {
            referenceAbsoluteValue = range.minValue;
          } else if (range.maxValue < 0) {
            referenceAbsoluteValue = Math.abs(range.maxValue);
          }
          if (referenceAbsoluteValue > 0 && referenceAbsoluteValue < 1000) {
            const magnitudeExponent = Math.floor(
              Math.log10(referenceAbsoluteValue),
            );
            const syntheticMagnitude = 8.888_88 * 10 ** magnitudeExponent;
            if (range.maxValue > 0) {
              includeValue(syntheticMagnitude, pane.format);
            }
            if (range.minValue < 0) {
              includeValue(-syntheticMagnitude, pane.format);
            }
          }
          if (range.minValue <= 0.888_888 && range.maxValue >= 0.888_888) {
            includeValue(0.888_888, pane.format);
          }
          if (range.minValue <= -0.888_888 && range.maxValue >= -0.888_888) {
            includeValue(-0.888_888, pane.format);
          }
          for (const positiveBoundary of [999.999]) {
            if (
              positiveBoundary >= range.minValue &&
              positiveBoundary <= range.maxValue
            ) {
              includeValue(positiveBoundary, pane.format);
            }
            const negativeBoundary = -positiveBoundary;
            if (
              negativeBoundary >= range.minValue &&
              negativeBoundary <= range.maxValue
            ) {
              includeValue(negativeBoundary, pane.format);
            }
          }
          let positiveSuffix = '';
          let negativeSuffix = '';
          const widerSuffix = (current: string, suffix: string) =>
            current &&
            VOLUME_SUFFIXES_BY_WIDTH.indexOf(current) <=
              VOLUME_SUFFIXES_BY_WIDTH.indexOf(suffix)
              ? current
              : suffix;
          for (const unitRange of VOLUME_UNIT_RANGES) {
            if (
              range.maxValue >= unitRange.min &&
              range.minValue < unitRange.max
            ) {
              positiveSuffix = widerSuffix(positiveSuffix, unitRange.suffix);
            }
            if (
              range.minValue <= -unitRange.min &&
              range.maxValue > -unitRange.max
            ) {
              negativeSuffix = widerSuffix(negativeSuffix, unitRange.suffix);
            }
          }
          // Same-length samples may carry a narrower suffix than the range reaches.
          if (positiveSuffix) {
            includeLabel(`888.8${positiveSuffix}`, true);
          }
          if (negativeSuffix) {
            includeLabel(`-888.8${negativeSuffix}`, true);
          }
        } else if (
          pane.format.type === 'inherit' &&
          // Fixed-precision labels are widest at the range ends sampled above.
          // Only significant-digit labels can grow longer near zero.
          getNormalizedPrecision(pane.format.precision) === undefined
        ) {
          const maxAbsoluteValue = Math.max(
            Math.abs(range.minValue),
            Math.abs(range.maxValue),
          );
          let referenceAbsoluteValue = Math.min(maxAbsoluteValue, 0.9999);
          if (range.minValue > 0) {
            referenceAbsoluteValue = range.minValue;
          } else if (range.maxValue < 0) {
            referenceAbsoluteValue = Math.abs(range.maxValue);
          }
          if (referenceAbsoluteValue > 0 && referenceAbsoluteValue < 1) {
            const magnitudeExponent = Math.floor(
              Math.log10(referenceAbsoluteValue),
            );
            const syntheticMagnitude = 8.888 * 10 ** magnitudeExponent;
            if (range.maxValue > 0) {
              includeValue(syntheticMagnitude, pane.format);
            }
            if (range.minValue < 0) {
              includeValue(-syntheticMagnitude, pane.format);
            }
          }
          if (
            INHERITED_PRICE_PLAIN_DECIMAL_BOUNDARY >= range.minValue &&
            INHERITED_PRICE_PLAIN_DECIMAL_BOUNDARY <= range.maxValue
          ) {
            includeValue(INHERITED_PRICE_PLAIN_DECIMAL_BOUNDARY, pane.format);
          }
          if (
            -INHERITED_PRICE_PLAIN_DECIMAL_BOUNDARY >= range.minValue &&
            -INHERITED_PRICE_PLAIN_DECIMAL_BOUNDARY <= range.maxValue
          ) {
            includeValue(-INHERITED_PRICE_PLAIN_DECIMAL_BOUNDARY, pane.format);
          }
        }
      }
    }
  }
  return widestLabel;
}
