import type {
  ITradingViewNativeChartSettings,
  ITradingViewNativeIndicatorSettingsItem,
  ITradingViewNativeMainIndicatorId,
} from '@onekeyhq/shared/types/tradingViewNative';

import { resolveTradingViewSettingsThemeColor } from '../../TradingViewChartControls/chartSettings/TradingViewSettingsThemeColors';

import type { ITradingViewNativeSubIndicatorInstanceConfig } from './subIndicatorRender';
import type { ITradingViewSettingsThemeColorMap } from '../../TradingViewChartControls/chartSettings/TradingViewSettingsThemeColors';

function resolveStyleRecordColors<TValue extends { color?: string }>(
  values: Readonly<Record<string, TValue>> | undefined,
  themeColors: ITradingViewSettingsThemeColorMap,
) {
  if (!values) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => [
      id,
      typeof value.color === 'string'
        ? {
            ...value,
            color: resolveTradingViewSettingsThemeColor(
              value.color,
              themeColors,
            ),
          }
        : value,
    ]),
  );
}

export function resolveTradingViewNativeChartThemeColors(
  settings: ITradingViewNativeChartSettings,
  themeColors: ITradingViewSettingsThemeColorMap,
): ITradingViewNativeChartSettings {
  const resolveColor = (color: string) =>
    resolveTradingViewSettingsThemeColor(color, themeColors);

  return {
    ...settings,
    background: {
      ...settings.background,
      colors: settings.background.colors.map(resolveColor) as [string, string],
    },
    candles: {
      body: {
        ...settings.candles.body,
        downColor: resolveColor(settings.candles.body.downColor),
        upColor: resolveColor(settings.candles.body.upColor),
      },
      border: {
        ...settings.candles.border,
        downColor: resolveColor(settings.candles.border.downColor),
        upColor: resolveColor(settings.candles.border.upColor),
      },
      wick: {
        ...settings.candles.wick,
        downColor: resolveColor(settings.candles.wick.downColor),
        upColor: resolveColor(settings.candles.wick.upColor),
      },
    },
    crossLine: {
      ...settings.crossLine,
      color: resolveColor(settings.crossLine.color),
    },
    grid: {
      ...settings.grid,
      horizontalColor: resolveColor(settings.grid.horizontalColor),
      verticalColor: resolveColor(settings.grid.verticalColor),
    },
    latestPriceLine: {
      ...settings.latestPriceLine,
      downColor: resolveColor(settings.latestPriceLine.downColor),
      upColor: resolveColor(settings.latestPriceLine.upColor),
    },
  };
}

function resolveIndicatorItemThemeColors(
  indicator: ITradingViewNativeIndicatorSettingsItem,
  themeColors: ITradingViewSettingsThemeColorMap,
): ITradingViewNativeIndicatorSettingsItem {
  return {
    ...indicator,
    lines: Object.fromEntries(
      Object.entries(indicator.lines).map(([id, line]) => [
        id,
        {
          ...line,
          color: resolveTradingViewSettingsThemeColor(line.color, themeColors),
        },
      ]),
    ),
    ...(indicator.opacityColors
      ? {
          opacityColors: {
            downColor: resolveTradingViewSettingsThemeColor(
              indicator.opacityColors.downColor,
              themeColors,
            ),
            upColor: resolveTradingViewSettingsThemeColor(
              indicator.opacityColors.upColor,
              themeColors,
            ),
          },
        }
      : {}),
  };
}

export function resolveTradingViewNativeMainIndicatorThemeColors(
  settings: Partial<
    Record<
      ITradingViewNativeMainIndicatorId,
      ITradingViewNativeIndicatorSettingsItem
    >
  >,
  themeColors: ITradingViewSettingsThemeColorMap,
) {
  return Object.fromEntries(
    Object.entries(settings).map(([id, indicator]) => [
      id,
      resolveIndicatorItemThemeColors(indicator, themeColors),
    ]),
  ) as Partial<
    Record<
      ITradingViewNativeMainIndicatorId,
      ITradingViewNativeIndicatorSettingsItem
    >
  >;
}

export function resolveTradingViewNativeSubIndicatorThemeColors(
  instances: readonly ITradingViewNativeSubIndicatorInstanceConfig[],
  themeColors: ITradingViewSettingsThemeColorMap,
): ITradingViewNativeSubIndicatorInstanceConfig[] {
  return instances.map((instance) => {
    const settings = instance.settings;
    if (!settings) {
      return instance;
    }
    return {
      ...instance,
      settings: {
        ...settings,
        bands: resolveStyleRecordColors(settings.bands, themeColors),
        fills: resolveStyleRecordColors(settings.fills, themeColors),
        palettes: settings.palettes
          ? Object.fromEntries(
              Object.entries(settings.palettes).map(([id, colors]) => [
                id,
                colors.map((color) =>
                  resolveTradingViewSettingsThemeColor(color, themeColors),
                ),
              ]),
            )
          : undefined,
        plots: resolveStyleRecordColors(settings.plots, themeColors),
      },
    };
  });
}
