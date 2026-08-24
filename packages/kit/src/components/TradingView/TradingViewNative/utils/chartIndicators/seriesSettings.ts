import type {
  ITradingViewNativeIndicatorLineSettings,
  ITradingViewNativeIndicatorSettingsItem,
} from '@onekeyhq/shared/types/tradingViewNative';

import type { ITradingViewNativeIndicatorSeries } from './types';

export function getTradingViewNativeIndicatorParameter(
  settings: ITradingViewNativeIndicatorSettingsItem | undefined,
  id: string,
  fallback: number,
) {
  const value = settings?.parameters[id];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getTradingViewNativeIndicatorLine(
  settings: ITradingViewNativeIndicatorSettingsItem | undefined,
  id: string,
  fallback: ITradingViewNativeIndicatorLineSettings,
): ITradingViewNativeIndicatorLineSettings {
  const line = settings?.lines[id];
  return {
    color: line?.color || fallback.color,
    enabled:
      typeof line?.enabled === 'boolean' ? line.enabled : fallback.enabled,
    period:
      typeof line?.period === 'number' && Number.isFinite(line.period)
        ? line.period
        : fallback.period,
    ...(line?.secondaryStyle || fallback.secondaryStyle
      ? { secondaryStyle: line?.secondaryStyle ?? fallback.secondaryStyle }
      : {}),
    style: line?.style ?? fallback.style,
  };
}

function getLineWidth(style: ITradingViewNativeIndicatorLineSettings['style']) {
  if (style === 'medium') {
    return 2;
  }
  if (style === 'bold') {
    return 3;
  }
  if (style === 'extraBold') {
    return 4;
  }
  return 1;
}

function getLineStyle(
  line: ITradingViewNativeIndicatorLineSettings,
): NonNullable<ITradingViewNativeIndicatorSeries['style']>['lineStyle'] {
  const style = line.secondaryStyle ?? line.style;
  return style === 'dashed' || style === 'dotted' ? style : 'solid';
}

export function getTradingViewNativeIndicatorSeriesStyle(
  line: ITradingViewNativeIndicatorLineSettings,
  settings: ITradingViewNativeIndicatorSettingsItem | undefined,
): NonNullable<ITradingViewNativeIndicatorSeries['style']> {
  return {
    color: line.color,
    lineStyle: getLineStyle(line),
    lineWidth: getLineWidth(line.style),
    opacity: 1 - Math.min(100, Math.max(0, settings?.transparency ?? 0)) / 100,
  };
}
