import {
  type ITradingViewNativeChartCandlePartSettings,
  type ITradingViewNativeChartSettings,
  TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION,
  TRADING_VIEW_NATIVE_THEME_COLORS,
  createTradingViewNativeChartSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import { createTradingViewChartSettingsValue } from '../TradingViewChartControls/chartSettings';

import type { ITradingViewChartSettingsValue } from '../TradingViewChartControls/chartSettings';

type ITradingViewNativeCandlePart =
  keyof ITradingViewNativeChartSettings['candles'];

const CANDLE_PARTS = new Set<ITradingViewNativeCandlePart>([
  'body',
  'border',
  'wick',
]);

function migrateLegacyTrendColor(color: string) {
  const normalizedColor = color.toUpperCase();
  if (normalizedColor === '#219D46' || normalizedColor === '#30A46C') {
    return TRADING_VIEW_NATIVE_THEME_COLORS.positive;
  }
  if (normalizedColor === '#C33759' || normalizedColor === '#E5484D') {
    return TRADING_VIEW_NATIVE_THEME_COLORS.negative;
  }
  return color;
}

export function normalizeTradingViewNativeChartSettings(
  settings: ITradingViewNativeChartSettings,
): ITradingViewNativeChartSettings {
  if (
    settings.schemaVersion === TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION
  ) {
    return settings;
  }

  const migrateBackgroundColor = (color: string, index: number) => {
    const normalizedColor = color.toUpperCase();
    if (index === 0 && normalizedColor === '#000000') {
      return TRADING_VIEW_NATIVE_THEME_COLORS.background;
    }
    if (index === 1 && normalizedColor === '#171717') {
      return TRADING_VIEW_NATIVE_THEME_COLORS.backgroundSubdued;
    }
    return color;
  };
  const migrateGridColor = (color: string) =>
    color.toUpperCase() === '#171717'
      ? TRADING_VIEW_NATIVE_THEME_COLORS.grid
      : color;

  return {
    ...settings,
    schemaVersion: TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION,
    candles: {
      body: {
        ...settings.candles.body,
        downColor: migrateLegacyTrendColor(settings.candles.body.downColor),
        upColor: migrateLegacyTrendColor(settings.candles.body.upColor),
      },
      border: {
        ...settings.candles.border,
        downColor: migrateLegacyTrendColor(settings.candles.border.downColor),
        upColor: migrateLegacyTrendColor(settings.candles.border.upColor),
      },
      wick: {
        ...settings.candles.wick,
        downColor: migrateLegacyTrendColor(settings.candles.wick.downColor),
        upColor: migrateLegacyTrendColor(settings.candles.wick.upColor),
      },
    },
    latestPriceLine: {
      ...settings.latestPriceLine,
      downColor: migrateLegacyTrendColor(settings.latestPriceLine.downColor),
      upColor: migrateLegacyTrendColor(settings.latestPriceLine.upColor),
    },
    background: {
      ...settings.background,
      colors: settings.background.colors.map(migrateBackgroundColor) as [
        string,
        string,
      ],
    },
    grid: {
      ...settings.grid,
      horizontalColor: migrateGridColor(settings.grid.horizontalColor),
      verticalColor: migrateGridColor(settings.grid.verticalColor),
    },
    crossLine: {
      ...settings.crossLine,
      color:
        settings.crossLine.color.toUpperCase() === '#BFC3CF'
          ? TRADING_VIEW_NATIVE_THEME_COLORS.crosshair
          : settings.crossLine.color,
    },
  };
}

function isTradingViewNativeCandlePart(
  value: string,
): value is ITradingViewNativeCandlePart {
  return CANDLE_PARTS.has(value as ITradingViewNativeCandlePart);
}

function getCandlePartSettings({
  fallback,
  itemId,
  value,
}: {
  fallback: ITradingViewNativeChartCandlePartSettings;
  itemId: ITradingViewNativeCandlePart;
  value: ITradingViewChartSettingsValue;
}): ITradingViewNativeChartCandlePartSettings {
  const item = value.appearanceSections
    .find((section) => section.id === 'candles')
    ?.items.find((candidate) => candidate.id === itemId);

  return item
    ? {
        enabled: item.enabled,
        upColor: item.upColor,
        downColor: item.downColor,
      }
    : { ...fallback };
}

export function getTradingViewChartSettingsValue(
  settings: ITradingViewNativeChartSettings,
): ITradingViewChartSettingsValue {
  const normalizedSettings = normalizeTradingViewNativeChartSettings(settings);
  const value = createTradingViewChartSettingsValue();

  return {
    ...value,
    appearanceSections: value.appearanceSections.map((section) =>
      section.id === 'candles'
        ? {
            ...section,
            items: section.items.map((item) =>
              isTradingViewNativeCandlePart(item.id)
                ? {
                    ...item,
                    ...normalizedSettings.candles[item.id],
                  }
                : item,
            ),
          }
        : section,
    ),
    options: {
      countdown: normalizedSettings.options.countdown,
      depth: normalizedSettings.options.depth,
      priceChange: normalizedSettings.options.priceChange,
      latestPrice: normalizedSettings.options.latestPrice,
      futureEvents: normalizedSettings.options.futureEvents,
      pastEvents: normalizedSettings.options.pastEvents,
      clickInteraction: normalizedSettings.options.clickInteraction,
      crossLine: normalizedSettings.options.crossLine,
    },
    latestPriceLine: { ...normalizedSettings.latestPriceLine },
    background: {
      ...normalizedSettings.background,
      colors: [...normalizedSettings.background.colors],
    },
    grid: { ...normalizedSettings.grid },
    crossLine: { ...normalizedSettings.crossLine },
    colorMode: normalizedSettings.colorMode,
    priceColorMode: normalizedSettings.priceColorMode,
  };
}

export function getTradingViewNativeChartSettings({
  currentSettings,
  value,
}: {
  currentSettings: ITradingViewNativeChartSettings;
  value: ITradingViewChartSettingsValue;
}): ITradingViewNativeChartSettings {
  const fallback = createTradingViewNativeChartSettings();
  const normalizedCurrentSettings =
    normalizeTradingViewNativeChartSettings(currentSettings);

  return {
    schemaVersion: fallback.schemaVersion,
    candles: {
      body: getCandlePartSettings({
        fallback: fallback.candles.body,
        itemId: 'body',
        value,
      }),
      border: getCandlePartSettings({
        fallback: fallback.candles.border,
        itemId: 'border',
        value,
      }),
      wick: getCandlePartSettings({
        fallback: fallback.candles.wick,
        itemId: 'wick',
        value,
      }),
    },
    options: {
      ...value.options,
      yAxis: normalizedCurrentSettings.options.yAxis,
    },
    latestPriceLine: { ...value.latestPriceLine },
    background: {
      ...value.background,
      colors: [...value.background.colors],
    },
    grid: { ...value.grid },
    crossLine: { ...value.crossLine },
    colorMode: value.colorMode,
    priceColorMode: value.priceColorMode,
  };
}
