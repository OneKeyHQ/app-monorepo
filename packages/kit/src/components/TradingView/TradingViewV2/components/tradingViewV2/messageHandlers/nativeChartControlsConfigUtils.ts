import type { ITradingViewNativeChartControlsConfigData } from '../../../types';

const REMOVED_HLC_CHART_TYPE_VALUE = 21;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeTradingViewLayoutRestored(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

export function normalizeTradingViewChartTypes(
  chartTypes: unknown,
): ITradingViewNativeChartControlsConfigData['chartTypes'] | null {
  if (!Array.isArray(chartTypes)) {
    return null;
  }

  const normalizedChartTypes: ITradingViewNativeChartControlsConfigData['chartTypes'] =
    [];
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
      value === REMOVED_HLC_CHART_TYPE_VALUE ||
      label.toLowerCase().includes('hlc');
    if (!isRemovedHlcChartType) {
      normalizedChartTypes.push({ label, value });
    }
  }

  return normalizedChartTypes;
}
