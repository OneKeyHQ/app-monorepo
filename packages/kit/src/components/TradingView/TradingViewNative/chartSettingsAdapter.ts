import { colord } from 'colord';

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
const LINE_STYLES = ['solid', 'dashed'] as const;
const BACKGROUND_STYLES = ['solid', 'gradient'] as const;
const GRID_STYLES = ['both', 'horizontal', 'vertical', 'none'] as const;
const COLOR_MODES = ['modern', 'classic'] as const;
const PRICE_COLOR_MODES = ['greenUpRedDown', 'redUpGreenDown'] as const;
const THEME_COLORS = new Set<string>(
  Object.values(TRADING_VIEW_NATIVE_THEME_COLORS),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeColor(value: unknown, fallback: string) {
  return typeof value === 'string' &&
    (THEME_COLORS.has(value) || colord(value).isValid())
    ? value
    : fallback;
}

function normalizeStringUnion<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && values.includes(value as T)
    ? (value as T)
    : fallback;
}

function normalizeCandlePartSettings(
  value: unknown,
  fallback: ITradingViewNativeChartCandlePartSettings,
): ITradingViewNativeChartCandlePartSettings {
  const record = isRecord(value) ? value : {};
  return {
    enabled: normalizeBoolean(record.enabled, fallback.enabled),
    upColor: normalizeColor(record.upColor, fallback.upColor),
    downColor: normalizeColor(record.downColor, fallback.downColor),
  };
}

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
  settings: unknown,
): ITradingViewNativeChartSettings {
  const fallback = createTradingViewNativeChartSettings();
  const record = isRecord(settings) ? settings : {};
  const candles = isRecord(record.candles) ? record.candles : {};
  const options = isRecord(record.options) ? record.options : {};
  const latestPriceLine = isRecord(record.latestPriceLine)
    ? record.latestPriceLine
    : {};
  const background = isRecord(record.background) ? record.background : {};
  const backgroundColors = Array.isArray(background.colors)
    ? background.colors
    : [];
  const grid = isRecord(record.grid) ? record.grid : {};
  const crossLine = isRecord(record.crossLine) ? record.crossLine : {};
  const shouldMigrateThemeColors =
    record.schemaVersion !== TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION;

  const normalizedSettings: ITradingViewNativeChartSettings = {
    schemaVersion: TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION,
    candles: {
      body: normalizeCandlePartSettings(candles.body, fallback.candles.body),
      border: normalizeCandlePartSettings(
        candles.border,
        fallback.candles.border,
      ),
      wick: normalizeCandlePartSettings(candles.wick, fallback.candles.wick),
    },
    options: {
      yAxis: normalizeBoolean(options.yAxis, fallback.options.yAxis),
      depth: normalizeBoolean(options.depth, fallback.options.depth),
      priceChange: normalizeBoolean(
        options.priceChange,
        fallback.options.priceChange,
      ),
      latestPrice: normalizeBoolean(
        options.latestPrice,
        fallback.options.latestPrice,
      ),
      futureEvents: normalizeBoolean(
        options.futureEvents,
        fallback.options.futureEvents,
      ),
      pastEvents: normalizeBoolean(
        options.pastEvents,
        fallback.options.pastEvents,
      ),
      clickInteraction: normalizeBoolean(
        options.clickInteraction,
        fallback.options.clickInteraction,
      ),
      crossLine: normalizeBoolean(
        options.crossLine,
        fallback.options.crossLine,
      ),
    },
    latestPriceLine: {
      upColor: normalizeColor(
        latestPriceLine.upColor,
        fallback.latestPriceLine.upColor,
      ),
      downColor: normalizeColor(
        latestPriceLine.downColor,
        fallback.latestPriceLine.downColor,
      ),
      style: normalizeStringUnion(
        latestPriceLine.style,
        LINE_STYLES,
        fallback.latestPriceLine.style,
      ),
    },
    background: {
      style: normalizeStringUnion(
        background.style,
        BACKGROUND_STYLES,
        fallback.background.style,
      ),
      colors: [
        normalizeColor(backgroundColors[0], fallback.background.colors[0]),
        normalizeColor(backgroundColors[1], fallback.background.colors[1]),
      ],
    },
    grid: {
      style: normalizeStringUnion(grid.style, GRID_STYLES, fallback.grid.style),
      horizontalColor: normalizeColor(
        grid.horizontalColor,
        fallback.grid.horizontalColor,
      ),
      verticalColor: normalizeColor(
        grid.verticalColor,
        fallback.grid.verticalColor,
      ),
    },
    crossLine: {
      color: normalizeColor(crossLine.color, fallback.crossLine.color),
      style: normalizeStringUnion(
        crossLine.style,
        LINE_STYLES,
        fallback.crossLine.style,
      ),
    },
    colorMode: normalizeStringUnion(
      record.colorMode,
      COLOR_MODES,
      fallback.colorMode,
    ),
    priceColorMode: normalizeStringUnion(
      record.priceColorMode,
      PRICE_COLOR_MODES,
      fallback.priceColorMode,
    ),
  };

  if (!shouldMigrateThemeColors) {
    return normalizedSettings;
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
    ...normalizedSettings,
    schemaVersion: TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION,
    candles: {
      body: {
        ...normalizedSettings.candles.body,
        downColor: migrateLegacyTrendColor(
          normalizedSettings.candles.body.downColor,
        ),
        upColor: migrateLegacyTrendColor(
          normalizedSettings.candles.body.upColor,
        ),
      },
      border: {
        ...normalizedSettings.candles.border,
        downColor: migrateLegacyTrendColor(
          normalizedSettings.candles.border.downColor,
        ),
        upColor: migrateLegacyTrendColor(
          normalizedSettings.candles.border.upColor,
        ),
      },
      wick: {
        ...normalizedSettings.candles.wick,
        downColor: migrateLegacyTrendColor(
          normalizedSettings.candles.wick.downColor,
        ),
        upColor: migrateLegacyTrendColor(
          normalizedSettings.candles.wick.upColor,
        ),
      },
    },
    latestPriceLine: {
      ...normalizedSettings.latestPriceLine,
      downColor: migrateLegacyTrendColor(
        normalizedSettings.latestPriceLine.downColor,
      ),
      upColor: migrateLegacyTrendColor(
        normalizedSettings.latestPriceLine.upColor,
      ),
    },
    background: {
      ...normalizedSettings.background,
      colors: normalizedSettings.background.colors.map(
        migrateBackgroundColor,
      ) as [string, string],
    },
    grid: {
      ...normalizedSettings.grid,
      horizontalColor: migrateGridColor(
        normalizedSettings.grid.horizontalColor,
      ),
      verticalColor: migrateGridColor(normalizedSettings.grid.verticalColor),
    },
    crossLine: {
      ...normalizedSettings.crossLine,
      color:
        normalizedSettings.crossLine.color.toUpperCase() === '#BFC3CF'
          ? TRADING_VIEW_NATIVE_THEME_COLORS.crosshair
          : normalizedSettings.crossLine.color,
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
      ...value.options,
      yAxis: normalizedSettings.options.yAxis,
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
  value,
}: {
  currentSettings: ITradingViewNativeChartSettings;
  value: ITradingViewChartSettingsValue;
}): ITradingViewNativeChartSettings {
  const fallback = createTradingViewNativeChartSettings();

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
      yAxis: value.options.yAxis,
      depth: value.options.depth,
      priceChange: value.options.priceChange,
      latestPrice: value.options.latestPrice,
      futureEvents: value.options.futureEvents,
      pastEvents: value.options.pastEvents,
      clickInteraction: value.options.clickInteraction,
      crossLine: value.options.crossLine,
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
