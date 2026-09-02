import type {
  ITradingViewNativeSubIndicatorRenderPane,
  ITradingViewNativeSubIndicatorValueRange,
} from './types';

function getNormalizedPaddingRatio(value: number) {
  'worklet';

  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function getExpandedEqualValueRange({
  bottomPaddingRatio,
  topPaddingRatio,
  value,
}: {
  bottomPaddingRatio: number;
  topPaddingRatio: number;
  value: number;
}): ITradingViewNativeSubIndicatorValueRange {
  'worklet';

  const magnitude = Math.max(Math.abs(value), 1);
  let minValue = value - magnitude * bottomPaddingRatio;
  let maxValue = value + magnitude * topPaddingRatio;

  if (minValue === maxValue) {
    const fallbackPadding = magnitude * 0.05;
    minValue -= fallbackPadding;
    maxValue += fallbackPadding;
  }

  return { maxValue, minValue };
}

function getNormalizedVisibleIndexes({
  endIndex,
  startIndex,
}: {
  endIndex: number;
  startIndex: number;
}) {
  'worklet';

  const normalizedStartIndex = Number.isFinite(startIndex)
    ? Math.max(Math.floor(startIndex), 0)
    : 0;
  const normalizedEndIndex = Number.isFinite(endIndex)
    ? Math.max(Math.floor(endIndex), normalizedStartIndex)
    : normalizedStartIndex;

  return { normalizedEndIndex, normalizedStartIndex };
}

export function getTradingViewNativeSubIndicatorValueRange({
  endIndex,
  pane,
  startIndex,
}: {
  endIndex: number;
  pane: ITradingViewNativeSubIndicatorRenderPane;
  startIndex: number;
}): ITradingViewNativeSubIndicatorValueRange | null {
  'worklet';

  if (!pane.isVisible) {
    return null;
  }

  if (pane.scale.kind === 'fixed') {
    const { maxValue, minValue } = pane.scale;
    return Number.isFinite(minValue) &&
      Number.isFinite(maxValue) &&
      maxValue > minValue
      ? { maxValue, minValue }
      : null;
  }

  const { normalizedEndIndex, normalizedStartIndex } =
    getNormalizedVisibleIndexes({ endIndex, startIndex });
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;
  const includeValue = (value: number | null | undefined) => {
    if (value !== null && value !== undefined && Number.isFinite(value)) {
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
    }
  };
  for (const series of pane.series) {
    let shouldIncludeSeries = series.style.visible;
    for (const fill of pane.fills) {
      if (
        fill.style.visible &&
        fill.type === 'plot-plot' &&
        (fill.fromId === series.id || fill.toId === series.id)
      ) {
        shouldIncludeSeries = true;
        break;
      }
    }

    if (shouldIncludeSeries) {
      const seriesEndIndex = Math.min(normalizedEndIndex, series.values.length);
      for (
        let index = Math.min(normalizedStartIndex, seriesEndIndex);
        index < seriesEndIndex;
        index += 1
      ) {
        includeValue(series.values[index]);
      }
      if (
        series.style.type === 'columns' ||
        series.style.type === 'histogram'
      ) {
        includeValue(series.style.baseline);
      }
    }
  }
  for (const band of pane.bands) {
    let shouldIncludeBand = band.style.visible;
    for (const fill of pane.fills) {
      if (
        fill.style.visible &&
        fill.type === 'band-band' &&
        (fill.fromId === band.id || fill.toId === band.id)
      ) {
        shouldIncludeBand = true;
        break;
      }
    }
    if (shouldIncludeBand) {
      includeValue(band.style.value);
    }
  }
  for (const value of pane.scale.includeValues) {
    includeValue(value);
  }

  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return null;
  }

  const bottomPaddingRatio = getNormalizedPaddingRatio(
    pane.scale.padding.bottomRatio,
  );
  const topPaddingRatio = getNormalizedPaddingRatio(
    pane.scale.padding.topRatio,
  );
  if (minValue === maxValue) {
    return getExpandedEqualValueRange({
      bottomPaddingRatio,
      topPaddingRatio,
      value: minValue,
    });
  }

  const valueSpan = maxValue - minValue;
  return {
    maxValue: maxValue + valueSpan * topPaddingRatio,
    minValue: minValue - valueSpan * bottomPaddingRatio,
  };
}
