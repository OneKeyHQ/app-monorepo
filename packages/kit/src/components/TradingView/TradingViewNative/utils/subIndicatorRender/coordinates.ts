import { formatTradingViewNativePriceTick } from '../chartLayout';
import { formatTradingViewNativeVolume } from '../chartLegend';

import { getTradingViewNativeSubIndicatorValueRange } from './range';

import type {
  ITradingViewNativeSubIndicatorFormat,
  ITradingViewNativeSubIndicatorRenderPane,
  ITradingViewNativeSubIndicatorValueRange,
} from './types';

const MAX_FIXED_PRECISION = 20;
const INHERITED_PRICE_PLAIN_DECIMAL_BOUNDARY = 0.000_088_88;

function getNormalizedPrecision(precision: number | undefined) {
  'worklet';

  return typeof precision === 'number' && Number.isFinite(precision)
    ? Math.min(Math.max(Math.floor(precision), 0), MAX_FIXED_PRECISION)
    : undefined;
}

function formatSignedTradingViewNativeVolume(value: number) {
  'worklet';

  if (!Number.isFinite(value)) {
    return '--';
  }
  const formattedValue = formatTradingViewNativeVolume(Math.abs(value));
  return value < 0 && formattedValue !== '--'
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
  if (format.type === 'volume') {
    return formatSignedTradingViewNativeVolume(value);
  }
  const precision = getNormalizedPrecision(format.precision);
  if (format.type === 'price' && precision !== undefined) {
    return value.toFixed(precision);
  }
  return formatTradingViewNativePriceTick(value);
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
  return top + ((range.maxValue - value) / valueSpan) * height;
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
  return range.maxValue - ((y - top) / height) * valueSpan;
}

export function getTradingViewNativeSubIndicatorAxisLabel(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
) {
  'worklet';

  let widestLabel = '';
  const includeLabel = (label: string) => {
    if (label.length > widestLabel.length) {
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
        const valueSpan = range.maxValue - range.minValue;
        for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
          includeValue(range.maxValue - valueSpan * progress, pane.format);
        }
        if (pane.format.type === 'volume') {
          if (range.minValue < 0 && range.maxValue > 0) {
            includeLabel('-8.88888e-888');
          }
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
          for (const unitRange of [
            { max: 1_000_000, min: 1000 },
            { max: 1_000_000_000, min: 1_000_000 },
            { max: 1_000_000_000_000, min: 1_000_000_000 },
            { max: Number.POSITIVE_INFINITY, min: 1_000_000_000_000 },
          ]) {
            if (
              range.maxValue >= unitRange.min &&
              range.minValue < unitRange.max
            ) {
              includeLabel('888.8T');
            }
            if (
              range.minValue <= -unitRange.min &&
              range.maxValue > -unitRange.max
            ) {
              includeLabel('-888.8T');
            }
          }
        } else if (pane.format.type === 'inherit') {
          if (range.minValue < 0 && range.maxValue > 0) {
            includeLabel('-8.888e-888');
          }
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
