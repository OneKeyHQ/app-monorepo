import type { ITradingViewNativeChartControlsConfigData } from '../../../types';

// TradingView defines SeriesType.HLCBars as 21; the app bridge fixture was
// introduced in c1bb2df6c5.
const REMOVED_HLC_CHART_TYPE = {
  label: 'candles hlc',
  value: 21,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeTradingViewLayoutRestored(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

export function normalizeTradingViewChartTypeState(
  chartTypes: unknown,
  activeChartType: unknown,
): {
  chartTypes: ITradingViewNativeChartControlsConfigData['chartTypes'];
  activeChartType: number;
  chartTypeToSync?: number;
} | null {
  const activeValue = Number(activeChartType);
  if (!Array.isArray(chartTypes) || !Number.isFinite(activeValue)) {
    return null;
  }

  const normalizedChartTypes: ITradingViewNativeChartControlsConfigData['chartTypes'] =
    [];
  let removedActiveHlcChartType = false;
  for (const chartType of chartTypes) {
    if (!isRecord(chartType)) {
      return null;
    }

    const label =
      typeof chartType.label === 'string' ? chartType.label.trim() : '';
    const value = Number(chartType.value);
    if (!label || !Number.isFinite(value)) {
      return null;
    }

    const isRemovedHlcChartType =
      value === REMOVED_HLC_CHART_TYPE.value &&
      label.toLowerCase() === REMOVED_HLC_CHART_TYPE.label;
    if (isRemovedHlcChartType) {
      removedActiveHlcChartType ||= value === activeValue;
    } else {
      normalizedChartTypes.push({ label, value });
    }
  }

  const activeChartTypeStillExists = normalizedChartTypes.some(
    (chartType) => chartType.value === activeValue,
  );
  const fallbackChartType =
    normalizedChartTypes.find((chartType) => {
      const normalizedLabel = chartType.label.toLowerCase();
      return normalizedLabel === 'candle' || normalizedLabel === 'candles';
    }) ?? normalizedChartTypes[0];
  if (
    removedActiveHlcChartType &&
    !activeChartTypeStillExists &&
    fallbackChartType
  ) {
    return {
      chartTypes: normalizedChartTypes,
      activeChartType: fallbackChartType.value,
      chartTypeToSync: fallbackChartType.value,
    };
  }

  return {
    chartTypes: normalizedChartTypes,
    activeChartType: activeValue,
  };
}
