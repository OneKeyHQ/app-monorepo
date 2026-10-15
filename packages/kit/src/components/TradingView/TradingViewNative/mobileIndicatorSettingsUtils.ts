import type {
  ITradingViewNativeAnyIndicatorId,
  ITradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import { normalizeTradingViewNativeIndicatorSettings } from './indicatorSettingsAdapter';

import type {
  ITradingViewIndicatorSettingsItem,
  ITradingViewIndicatorSettingsLine,
} from '../TradingViewChartControls/chartSettings';

export type IMobileIndicatorNumberField = {
  key: string;
  id: string;
  target: 'parameter' | 'line';
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
};

export function getMobileIndicatorNumberFields(
  indicator: ITradingViewIndicatorSettingsItem,
): IMobileIndicatorNumberField[] {
  return [
    ...(indicator.parameters ?? []).map((parameter) => ({
      ...parameter,
      key: `parameter:${parameter.id}`,
      target: 'parameter' as const,
      min: parameter.min ?? 0,
      max: parameter.max ?? Number.POSITIVE_INFINITY,
      step: parameter.step,
    })),
    ...indicator.lines
      .filter((line) => line.showPeriod !== false)
      .map((line) => ({
        key: `line:${line.id}`,
        id: line.id,
        target: 'line' as const,
        label: line.label,
        value: line.period,
        min: 1,
        max: Number.POSITIVE_INFINITY,
        step: 1,
      })),
  ];
}

export function getMobileIndicatorLineNumberField(
  line: ITradingViewIndicatorSettingsLine,
  fields: IMobileIndicatorNumberField[],
) {
  if (line.showPeriod !== false) {
    return fields.find((field) => field.key === `line:${line.id}`);
  }
  const parameterIds: Partial<Record<string, string>> = {
    'plot:movingAverage': 'movingAveragePeriod',
    'plot:smoothedMovingAverage': 'smoothingPeriod',
  };
  const parameterId =
    parameterIds[line.id] ??
    (line.id.startsWith('band:') ? line.id : undefined);
  return fields.find(
    (field) => field.target === 'parameter' && field.id === parameterId,
  );
}

export function createMobileIndicatorNumberDrafts(
  indicator: ITradingViewIndicatorSettingsItem,
): Record<string, string> {
  return Object.fromEntries(
    getMobileIndicatorNumberFields(indicator).map((field) => [
      field.key,
      String(field.value),
    ]),
  );
}

export function normalizeMobileIndicatorNumber(
  text: string,
  field: IMobileIndicatorNumberField,
): number {
  const trimmed = text.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
    return field.value;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return field.value;
  }
  const bounded = Math.min(field.max, Math.max(field.min, parsed));
  if (
    field.step === undefined ||
    !Number.isFinite(field.step) ||
    field.step <= 0
  ) {
    return bounded;
  }
  const base = Number.isFinite(field.min) ? field.min : 0;
  const precision = (value: number) => {
    const [coefficient, exponent = '0'] = String(value).split('e');
    return Math.max(
      0,
      (coefficient.split('.')[1]?.length ?? 0) - Number(exponent),
    );
  };
  const stepped = base + Math.round((bounded - base) / field.step) * field.step;
  const result = Number(
    stepped.toFixed(
      Math.min(12, Math.max(precision(field.step), precision(base))),
    ),
  );
  return Number.isFinite(result)
    ? Math.min(field.max, Math.max(field.min, result))
    : field.value;
}

export function applyMobileIndicatorNumberDrafts(
  indicator: ITradingViewIndicatorSettingsItem,
  drafts: Record<string, string>,
): ITradingViewIndicatorSettingsItem {
  const values = new Map(
    getMobileIndicatorNumberFields(indicator).map((field) => [
      field.key,
      normalizeMobileIndicatorNumber(drafts[field.key] ?? '', field),
    ]),
  );
  return {
    ...indicator,
    parameters: indicator.parameters?.map((parameter) => ({
      ...parameter,
      value: values.get(`parameter:${parameter.id}`) ?? parameter.value,
    })),
    lines: indicator.lines.map((line) => ({
      ...line,
      period: values.get(`line:${line.id}`) ?? line.period,
    })),
  };
}

export function mergeMobileIndicatorSettings(
  current: ITradingViewNativeIndicatorSettings,
  next: ITradingViewNativeIndicatorSettings,
  indicatorId: ITradingViewNativeAnyIndicatorId,
): ITradingViewNativeIndicatorSettings {
  const normalized = normalizeTradingViewNativeIndicatorSettings(current);
  const scope = next.mainIndicators.some(
    (indicator) => indicator.id === indicatorId,
  )
    ? 'mainIndicators'
    : 'subIndicators';
  const updatedIndicator = next[scope].find(
    (indicator) => indicator.id === indicatorId,
  );
  if (!updatedIndicator) {
    return normalized;
  }
  const existingIndicator = normalized[scope].find(
    (indicator) => indicator.id === indicatorId,
  );
  const mergedIndicator = {
    ...updatedIndicator,
    active: existingIndicator?.active ?? updatedIndicator.active,
  };
  return {
    ...normalized,
    [scope]: existingIndicator
      ? normalized[scope].map((indicator) =>
          indicator.id === indicatorId ? mergedIndicator : indicator,
        )
      : [...normalized[scope], mergedIndicator],
  };
}
