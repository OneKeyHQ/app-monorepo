import { colord } from 'colord';

import {
  type ITradingViewNativeAnyIndicatorId,
  type ITradingViewNativeIndicatorLineSettings,
  type ITradingViewNativeIndicatorSettings,
  type ITradingViewNativeIndicatorSettingsItem,
  type ITradingViewNativeMainIndicatorId,
  TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION,
  TRADING_VIEW_NATIVE_THEME_COLORS,
  createTradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  type ITradingViewIndicatorSettingsItem,
  type ITradingViewIndicatorSettingsLine,
  type ITradingViewIndicatorSettingsNumberParam,
  type ITradingViewIndicatorSettingsValue,
  TRADING_VIEW_SETTINGS_SCHEMA_VERSION,
} from '../TradingViewChartControls/chartSettings';

import {
  TRADING_VIEW_NATIVE_INDICATORS,
  TRADING_VIEW_NATIVE_SUB_INDICATORS,
  isTradingViewNativeIndicator,
  isTradingViewNativeSubIndicator,
} from './utils/chartIndicators';
import {
  getTradingViewNativeSubIndicatorDefinition,
  resolveTradingViewNativeSubIndicatorSettings,
} from './utils/subIndicatorRender';

import type { ITradingViewNativeAnyIndicator } from './utils/chartIndicators';
import type {
  ITradingViewNativeSubIndicatorDefinition,
  ITradingViewNativeSubIndicatorInputDefinition,
  ITradingViewNativeSubIndicatorInstanceConfig,
  ITradingViewNativeSubIndicatorLineStyle,
  ITradingViewNativeSubIndicatorSettingsOverrides,
} from './utils/subIndicatorRender';

const MAIN_INDICATOR_LINE_COLORS = [
  TRADING_VIEW_NATIVE_THEME_COLORS.brand,
  TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimary,
  TRADING_VIEW_NATIVE_THEME_COLORS.indicatorTertiary,
] as const;
const MAIN_INDICATOR_PERIODS = [5, 10, 20] as const;
const DEFAULT_UP_COLOR = TRADING_VIEW_NATIVE_THEME_COLORS.positive;
const DEFAULT_DOWN_COLOR = TRADING_VIEW_NATIVE_THEME_COLORS.negative;
const LEGACY_INDICATOR_SETTINGS_SCHEMA_VERSION = 2;
const LEGACY_OBV_MOVING_AVERAGE_PERIOD = 9;
const OBV_MOVING_AVERAGE_PERIOD = 30;
const LEGACY_INDICATOR_THEME_COLOR_MAP: Readonly<Record<string, string>> = {
  '#2196F3': TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimary,
  '#219D46': TRADING_VIEW_NATIVE_THEME_COLORS.positive,
  '#23BFD5': TRADING_VIEW_NATIVE_THEME_COLORS.quinary,
  '#26A69A': TRADING_VIEW_NATIVE_THEME_COLORS.positive,
  '#27C6DA': TRADING_VIEW_NATIVE_THEME_COLORS.quinary,
  '#30A46C': TRADING_VIEW_NATIVE_THEME_COLORS.positive,
  '#43A047': TRADING_VIEW_NATIVE_THEME_COLORS.positive,
  '#787B86': TRADING_VIEW_NATIVE_THEME_COLORS.band,
  '#7E57C2': TRADING_VIEW_NATIVE_THEME_COLORS.indicatorTertiary,
  '#AB47BC': TRADING_VIEW_NATIVE_THEME_COLORS.indicatorTertiary,
  '#B2DFDB': TRADING_VIEW_NATIVE_THEME_COLORS.positiveSubdued,
  '#C33759': TRADING_VIEW_NATIVE_THEME_COLORS.negative,
  '#E5484D': TRADING_VIEW_NATIVE_THEME_COLORS.negative,
  '#E9386F': TRADING_VIEW_NATIVE_THEME_COLORS.quaternary,
  '#F27206': TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
  '#F50057': TRADING_VIEW_NATIVE_THEME_COLORS.quaternary,
  '#FF5252': TRADING_VIEW_NATIVE_THEME_COLORS.negative,
  '#FF6D00': TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
  '#FF9D22': TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
  '#FFA726': TRADING_VIEW_NATIVE_THEME_COLORS.warning,
  '#FFCDD2': TRADING_VIEW_NATIVE_THEME_COLORS.negativeSubdued,
};
const INDICATOR_LINE_STYLES = new Set<string>([
  'solid',
  'medium',
  'bold',
  'extraBold',
  'dashed',
  'dotted',
]);
const INDICATOR_THEME_COLORS = new Set<string>(
  Object.values(TRADING_VIEW_NATIVE_THEME_COLORS),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIndicatorLineStyle(
  value: unknown,
): value is ITradingViewIndicatorSettingsLine['style'] {
  return typeof value === 'string' && INDICATOR_LINE_STYLES.has(value);
}

function isIndicatorLinePatternStyle(
  value: unknown,
): value is Extract<
  ITradingViewIndicatorSettingsLine['style'],
  'dashed' | 'dotted'
> {
  return value === 'dashed' || value === 'dotted';
}

function isIndicatorLineSecondaryStyle(
  value: unknown,
): value is 'solid' | 'dashed' | 'dotted' {
  return value === 'solid' || isIndicatorLinePatternStyle(value);
}

function isIndicatorColor(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (INDICATOR_THEME_COLORS.has(value) || colord(value).isValid())
  );
}

function normalizeStoredIndicatorLine(
  value: unknown,
): ITradingViewNativeIndicatorLineSettings | undefined {
  if (
    !isRecord(value) ||
    !isIndicatorColor(value.color) ||
    typeof value.enabled !== 'boolean' ||
    typeof value.period !== 'number' ||
    !Number.isFinite(value.period) ||
    !isIndicatorLineStyle(value.style)
  ) {
    return undefined;
  }

  const normalizedPeriod = Math.max(0, value.period);
  const hasInvalidSecondaryStyle =
    value.secondaryStyle !== undefined &&
    !isIndicatorLineStyle(value.secondaryStyle);
  if (!hasInvalidSecondaryStyle && normalizedPeriod === value.period) {
    return value as ITradingViewNativeIndicatorLineSettings;
  }

  return {
    color: value.color,
    enabled: value.enabled,
    period: normalizedPeriod,
    ...(isIndicatorLineStyle(value.secondaryStyle)
      ? { secondaryStyle: value.secondaryStyle }
      : {}),
    style: value.style,
  };
}

function normalizeStoredOpacityColors(value: unknown) {
  if (
    !isRecord(value) ||
    !isIndicatorColor(value.downColor) ||
    !isIndicatorColor(value.upColor)
  ) {
    return undefined;
  }

  return value as { downColor: string; upColor: string };
}

function normalizeStoredIndicatorSettingsItem(
  value: unknown,
): ITradingViewNativeIndicatorSettingsItem | undefined {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return undefined;
  }
  if (
    (!isTradingViewNativeIndicator(value.id) &&
      !isTradingViewNativeSubIndicator(value.id)) ||
    typeof value.active !== 'boolean' ||
    !isRecord(value.lines) ||
    !isRecord(value.parameters) ||
    typeof value.transparency !== 'number' ||
    !Number.isFinite(value.transparency)
  ) {
    return undefined;
  }

  let linesChanged = false;
  const normalizedLineEntries = Object.entries(value.lines).flatMap(
    ([id, line]) => {
      const normalizedLine = normalizeStoredIndicatorLine(line);
      linesChanged = linesChanged || !normalizedLine || normalizedLine !== line;
      return normalizedLine ? [[id, normalizedLine]] : [];
    },
  );
  const lines = linesChanged
    ? Object.fromEntries(normalizedLineEntries)
    : (value.lines as Record<string, ITradingViewNativeIndicatorLineSettings>);
  let parametersChanged = false;
  const normalizedParameterEntries = Object.entries(value.parameters).flatMap(
    ([id, parameter]) => {
      const isValid =
        typeof parameter === 'number' && Number.isFinite(parameter);
      parametersChanged = parametersChanged || !isValid;
      return isValid ? [[id, parameter]] : [];
    },
  );
  const parameters = parametersChanged
    ? Object.fromEntries(normalizedParameterEntries)
    : (value.parameters as Record<string, number>);
  const opacityColors = normalizeStoredOpacityColors(value.opacityColors);
  const transparency = Math.min(100, Math.max(0, value.transparency));
  const opacityColorsChanged =
    value.opacityColors !== undefined && opacityColors !== value.opacityColors;

  if (
    !linesChanged &&
    !parametersChanged &&
    !opacityColorsChanged &&
    transparency === value.transparency
  ) {
    return value as ITradingViewNativeIndicatorSettingsItem;
  }

  return {
    active: value.active,
    id: value.id,
    lines,
    ...(opacityColors ? { opacityColors } : {}),
    parameters,
    transparency,
  };
}

function migrateLegacyIndicatorThemeColor(color: string) {
  return LEGACY_INDICATOR_THEME_COLOR_MAP[color.toUpperCase()] ?? color;
}

function migrateLegacyIndicatorThemeColors(
  indicator: ITradingViewNativeIndicatorSettingsItem,
): ITradingViewNativeIndicatorSettingsItem {
  return {
    ...indicator,
    lines: Object.fromEntries(
      Object.entries(indicator.lines).map(([id, line]) => [
        id,
        {
          ...line,
          color:
            typeof line.color === 'string'
              ? migrateLegacyIndicatorThemeColor(line.color)
              : line.color,
        },
      ]),
    ),
    ...(indicator.opacityColors
      ? {
          opacityColors: {
            downColor:
              typeof indicator.opacityColors.downColor === 'string'
                ? migrateLegacyIndicatorThemeColor(
                    indicator.opacityColors.downColor,
                  )
                : indicator.opacityColors.downColor,
            upColor:
              typeof indicator.opacityColors.upColor === 'string'
                ? migrateLegacyIndicatorThemeColor(
                    indicator.opacityColors.upColor,
                  )
                : indicator.opacityColors.upColor,
          },
        }
      : {}),
  };
}

function migrateLegacyIndicatorDefaults(
  indicator: ITradingViewNativeIndicatorSettingsItem,
): ITradingViewNativeIndicatorSettingsItem {
  if (indicator.id === 'BOLL') {
    const upper = indicator.lines.upper;
    const lower = indicator.lines.lower;
    const shouldMigrateUpper =
      upper?.color === TRADING_VIEW_NATIVE_THEME_COLORS.quinary;
    const shouldMigrateLower =
      lower?.color === TRADING_VIEW_NATIVE_THEME_COLORS.quaternary;
    if (!shouldMigrateUpper && !shouldMigrateLower) {
      return indicator;
    }
    return {
      ...indicator,
      lines: {
        ...indicator.lines,
        ...(shouldMigrateUpper && upper
          ? {
              upper: {
                ...upper,
                color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
              },
            }
          : {}),
        ...(shouldMigrateLower && lower
          ? {
              lower: {
                ...lower,
                color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
              },
            }
          : {}),
      },
    };
  }

  if (indicator.id === 'OBV') {
    const movingAverage = indicator.lines['plot:movingAverage'];
    const isLegacyDefault =
      indicator.parameters.movingAveragePeriod ===
        LEGACY_OBV_MOVING_AVERAGE_PERIOD &&
      (!movingAverage ||
        (!movingAverage.enabled &&
          movingAverage.color ===
            TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimary &&
          movingAverage.period === 0 &&
          movingAverage.style === 'solid'));
    if (!isLegacyDefault) {
      return indicator;
    }
    return {
      ...indicator,
      lines: movingAverage
        ? {
            ...indicator.lines,
            'plot:movingAverage': {
              ...movingAverage,
              color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
              enabled: true,
            },
          }
        : indicator.lines,
      parameters: {
        ...indicator.parameters,
        movingAveragePeriod: OBV_MOVING_AVERAGE_PERIOD,
      },
    };
  }

  return indicator;
}

export function normalizeTradingViewNativeIndicatorSettings(
  value: unknown,
): ITradingViewNativeIndicatorSettings {
  if (!isRecord(value)) {
    return createTradingViewNativeIndicatorSettings();
  }

  const legacyIndicators = Array.isArray(value.indicators)
    ? value.indicators
    : [];
  const rawMainIndicators = Array.isArray(value.mainIndicators)
    ? value.mainIndicators
    : legacyIndicators;
  const rawSubIndicators = Array.isArray(value.subIndicators)
    ? value.subIndicators
    : legacyIndicators;
  const filteredMainIndicators = rawMainIndicators.flatMap((indicator) => {
    const normalizedIndicator = normalizeStoredIndicatorSettingsItem(indicator);
    return normalizedIndicator &&
      isTradingViewNativeIndicator(normalizedIndicator.id)
      ? [normalizedIndicator]
      : [];
  });
  const filteredSubIndicators = rawSubIndicators.flatMap((indicator) => {
    const normalizedIndicator = normalizeStoredIndicatorSettingsItem(indicator);
    return normalizedIndicator &&
      isTradingViewNativeSubIndicator(normalizedIndicator.id)
      ? [normalizedIndicator]
      : [];
  });
  const normalizedMainIndicators =
    filteredMainIndicators.length === rawMainIndicators.length &&
    filteredMainIndicators.every(
      (indicator, index) => indicator === rawMainIndicators[index],
    )
      ? (rawMainIndicators as ITradingViewNativeIndicatorSettingsItem[])
      : filteredMainIndicators;
  const normalizedSubIndicators =
    filteredSubIndicators.length === rawSubIndicators.length &&
    filteredSubIndicators.every(
      (indicator, index) => indicator === rawSubIndicators[index],
    )
      ? (rawSubIndicators as ITradingViewNativeIndicatorSettingsItem[])
      : filteredSubIndicators;
  const shouldMigrateThemeColors =
    value.schemaVersion !==
    TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION;
  const themeMigratedMainIndicators = shouldMigrateThemeColors
    ? normalizedMainIndicators.map(migrateLegacyIndicatorThemeColors)
    : normalizedMainIndicators;
  const themeMigratedSubIndicators = shouldMigrateThemeColors
    ? normalizedSubIndicators.map(migrateLegacyIndicatorThemeColors)
    : normalizedSubIndicators;
  const shouldMigrateIndicatorDefaults =
    typeof value.schemaVersion !== 'number' ||
    value.schemaVersion <= LEGACY_INDICATOR_SETTINGS_SCHEMA_VERSION;
  const mainIndicators = shouldMigrateIndicatorDefaults
    ? themeMigratedMainIndicators.map(migrateLegacyIndicatorDefaults)
    : themeMigratedMainIndicators;
  const subIndicators = shouldMigrateIndicatorDefaults
    ? themeMigratedSubIndicators.map(migrateLegacyIndicatorDefaults)
    : themeMigratedSubIndicators;

  if (
    !shouldMigrateThemeColors &&
    !shouldMigrateIndicatorDefaults &&
    rawMainIndicators === value.mainIndicators &&
    rawSubIndicators === value.subIndicators &&
    mainIndicators === rawMainIndicators &&
    subIndicators === rawSubIndicators
  ) {
    return value as ITradingViewNativeIndicatorSettings;
  }

  return {
    schemaVersion: TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION,
    mainIndicators,
    subIndicators,
  };
}

function normalizeMaxSelectableSubIndicatorCount(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : undefined;
}

function getStoredIndicator(
  settings: ITradingViewNativeIndicatorSettings,
  id: ITradingViewNativeAnyIndicatorId,
): ITradingViewNativeIndicatorSettingsItem | undefined {
  return (
    isTradingViewNativeIndicator(id)
      ? settings.mainIndicators
      : settings.subIndicators
  ).find((indicator) => indicator.id === id);
}

function getFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getStoredLine(
  storedIndicator: ITradingViewNativeIndicatorSettingsItem | undefined,
  id: string,
  fallback: ITradingViewNativeIndicatorLineSettings,
): ITradingViewNativeIndicatorLineSettings {
  const storedLine = storedIndicator?.lines[id];
  const storedLineStyle = storedLine?.style;
  const storedLineSecondaryStyle = storedLine?.secondaryStyle;
  const fallbackStyle = isIndicatorLinePatternStyle(fallback.style)
    ? 'solid'
    : fallback.style;
  const fallbackSecondaryStyle =
    fallback.secondaryStyle ??
    (isIndicatorLinePatternStyle(fallback.style) ? fallback.style : undefined);
  let storedStyle: ITradingViewIndicatorSettingsLine['style'] = fallbackStyle;
  let storedSecondaryStyle: ITradingViewIndicatorSettingsLine['secondaryStyle'] =
    fallbackSecondaryStyle;
  if (
    isIndicatorLineStyle(storedLineStyle) &&
    !isIndicatorLinePatternStyle(storedLineStyle)
  ) {
    storedStyle = storedLineStyle;
  }
  if (isIndicatorLineSecondaryStyle(storedLineSecondaryStyle)) {
    storedSecondaryStyle = storedLineSecondaryStyle;
  } else if (isIndicatorLinePatternStyle(storedLineStyle)) {
    storedSecondaryStyle = storedLineStyle;
  }
  const storedPeriod = getFiniteNumber(storedLine?.period, fallback.period);
  return {
    color: isIndicatorColor(storedLine?.color)
      ? storedLine.color
      : fallback.color,
    enabled:
      typeof storedLine?.enabled === 'boolean'
        ? storedLine.enabled
        : fallback.enabled,
    period:
      fallback.period > 0
        ? Math.max(1, Math.floor(storedPeriod))
        : fallback.period,
    ...(storedSecondaryStyle
      ? {
          secondaryStyle: storedSecondaryStyle,
        }
      : {}),
    style: storedStyle,
  };
}

function getStoredOpacityColors(
  storedIndicator: ITradingViewNativeIndicatorSettingsItem | undefined,
  fallback: { downColor: string; upColor: string },
) {
  const colors = storedIndicator?.opacityColors;
  return {
    downColor: isIndicatorColor(colors?.downColor)
      ? colors.downColor
      : fallback.downColor,
    upColor: isIndicatorColor(colors?.upColor)
      ? colors.upColor
      : fallback.upColor,
  };
}

function createLine({
  color,
  enabled = true,
  id,
  label,
  period = 0,
  showCheckbox = true,
  showColor = true,
  showPeriod = false,
  showSecondaryStyle = false,
  showStyle = true,
  secondaryStyle,
  storedIndicator,
  style = 'solid',
}: {
  color: string;
  enabled?: boolean;
  id: string;
  label: string;
  period?: number;
  showCheckbox?: boolean;
  showColor?: boolean;
  showPeriod?: boolean;
  showSecondaryStyle?: boolean;
  showStyle?: boolean;
  secondaryStyle?: ITradingViewIndicatorSettingsLine['secondaryStyle'];
  storedIndicator: ITradingViewNativeIndicatorSettingsItem | undefined;
  style?: ITradingViewIndicatorSettingsLine['style'];
}): ITradingViewIndicatorSettingsLine {
  const storedLine = getStoredLine(storedIndicator, id, {
    color,
    enabled,
    period,
    ...(secondaryStyle ? { secondaryStyle } : {}),
    style,
  });
  return {
    id,
    label,
    ...storedLine,
    showCheckbox,
    showColor,
    showPeriod,
    showSecondaryStyle,
    showStyle,
  };
}

function getSettingsLineWidthStyle(
  lineWidth: number,
): ITradingViewIndicatorSettingsLine['style'] {
  if (lineWidth >= 4) {
    return 'extraBold';
  }
  if (lineWidth >= 3) {
    return 'bold';
  }
  if (lineWidth >= 2) {
    return 'medium';
  }
  return 'solid';
}

function createParameter({
  fallbackValue,
  id,
  label,
  max,
  min,
  step,
  storedIndicator,
}: {
  fallbackValue: number;
  id: string;
  label: string;
  max?: number;
  min?: number;
  step?: number;
  storedIndicator: ITradingViewNativeIndicatorSettingsItem | undefined;
}): ITradingViewIndicatorSettingsNumberParam {
  const normalizedMin = typeof min === 'number' ? min : -Infinity;
  const normalizedMax = typeof max === 'number' ? max : Infinity;
  const storedValue = getFiniteNumber(
    storedIndicator?.parameters[id],
    fallbackValue,
  );
  return {
    id,
    label,
    value: Math.min(normalizedMax, Math.max(normalizedMin, storedValue)),
    ...(typeof min === 'number' ? { min } : {}),
    ...(typeof max === 'number' ? { max } : {}),
    ...(typeof step === 'number' ? { step } : {}),
  };
}

function getIndicatorTransparency(
  storedIndicator: ITradingViewNativeIndicatorSettingsItem | undefined,
  fallback: number,
) {
  return Math.min(
    100,
    Math.max(0, getFiniteNumber(storedIndicator?.transparency, fallback)),
  );
}

function createMainIndicator(
  id: ITradingViewNativeMainIndicatorId,
  settings: ITradingViewNativeIndicatorSettings,
): ITradingViewIndicatorSettingsItem {
  const storedIndicator = getStoredIndicator(settings, id);
  const base = {
    active: storedIndicator?.active ?? false,
    id,
    label: id,
    opacity: getIndicatorTransparency(storedIndicator, 0),
    opacityColors: getStoredOpacityColors(storedIndicator, {
      downColor: DEFAULT_DOWN_COLOR,
      upColor: DEFAULT_UP_COLOR,
    }),
    scope: 'main' as const,
    showOpacity: false,
    title: id,
  };

  if (id === 'MA' || id === 'EMA') {
    return {
      ...base,
      lines: MAIN_INDICATOR_PERIODS.map((period, index) =>
        createLine({
          color: MAIN_INDICATOR_LINE_COLORS[index],
          enabled: index < 3,
          id: `line:${index}`,
          label: `${id}${index + 1}`,
          period,
          showPeriod: true,
          storedIndicator,
        }),
      ),
    };
  }

  if (id === 'BOLL') {
    return {
      ...base,
      parameters: [
        createParameter({
          fallbackValue: 20,
          id: 'period',
          label: 'Length',
          min: 1,
          storedIndicator,
        }),
        createParameter({
          fallbackValue: 2,
          id: 'deviation',
          label: 'StdDev',
          min: 0,
          step: 0.1,
          storedIndicator,
        }),
      ],
      lines: [
        createLine({
          color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
          id: 'middle',
          label: 'BOLL',
          storedIndicator,
        }),
        createLine({
          color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
          id: 'upper',
          label: 'UB',
          storedIndicator,
        }),
        createLine({
          color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
          id: 'lower',
          label: 'LB',
          storedIndicator,
        }),
        createLine({
          color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
          id: 'background',
          label: 'Background',
          showStyle: false,
          storedIndicator,
        }),
      ],
    };
  }

  return {
    ...base,
    parameters: [
      createParameter({
        fallbackValue: 0.02,
        id: 'accelerationStart',
        label: 'Start',
        min: 0,
        step: 0.01,
        storedIndicator,
      }),
      createParameter({
        fallbackValue: 0.02,
        id: 'accelerationStep',
        label: 'Increment',
        min: 0,
        step: 0.01,
        storedIndicator,
      }),
      createParameter({
        fallbackValue: 0.2,
        id: 'accelerationMax',
        label: 'Maximum',
        min: 0,
        step: 0.01,
        storedIndicator,
      }),
    ],
    lines: [
      createLine({
        color: TRADING_VIEW_NATIVE_THEME_COLORS.quinary,
        id: 'sar',
        label: 'SAR',
        showCheckbox: false,
        showColor: false,
        showStyle: false,
        storedIndicator,
      }),
    ],
    showOpacity: true,
  };
}

function createSubIndicator(
  definition: ITradingViewNativeSubIndicatorDefinition,
  settings: ITradingViewNativeIndicatorSettings,
): ITradingViewIndicatorSettingsItem {
  const { indicator: id } = definition;
  const storedIndicator = getStoredIndicator(settings, id);
  const resolvedSettings = resolveTradingViewNativeSubIndicatorSettings(
    definition,
    undefined,
  );
  const numericInputs = definition.inputs.filter(
    (
      input,
    ): input is Extract<
      ITradingViewNativeSubIndicatorInputDefinition,
      { type: 'float' | 'integer' }
    > => input.type === 'float' || input.type === 'integer',
  );
  const parameters = numericInputs.map((input) =>
    createParameter({
      fallbackValue: input.defaultValue,
      id: input.id,
      label: input.title,
      max: input.max,
      min: input.min,
      step: input.step,
      storedIndicator,
    }),
  );
  parameters.push(
    ...definition.bands.map((band) =>
      createParameter({
        fallbackValue: band.defaultStyle.value,
        id: `band:${band.id}`,
        label: band.title,
        min: Number.NEGATIVE_INFINITY,
        storedIndicator,
      }),
    ),
  );

  const plotLines = definition.plots.map((plot) =>
    createLine({
      color: plot.defaultStyle.color,
      enabled: plot.defaultStyle.visible,
      id: `plot:${plot.id}`,
      label: plot.title,
      showColor: !plot.paletteId,
      showStyle: plot.defaultStyle.type === 'line',
      secondaryStyle: plot.defaultStyle.lineStyle,
      storedIndicator,
      style: getSettingsLineWidthStyle(plot.defaultStyle.lineWidth),
    }),
  );
  const bandLines = definition.bands.map((band) =>
    createLine({
      color: band.defaultStyle.color,
      enabled: band.defaultStyle.visible,
      id: `band:${band.id}`,
      label: band.title,
      showPeriod: false,
      showSecondaryStyle: true,
      secondaryStyle: band.defaultStyle.lineStyle,
      storedIndicator,
      style: getSettingsLineWidthStyle(band.defaultStyle.lineWidth),
    }),
  );
  const fillLines = definition.fills.map((fill) =>
    createLine({
      color: fill.defaultStyle.color,
      enabled: fill.defaultStyle.visible,
      id: `fill:${fill.id}`,
      label: fill.title,
      showStyle: false,
      storedIndicator,
    }),
  );
  const firstPalette = Object.values(resolvedSettings.palettes)[0];
  const opacityColors = getStoredOpacityColors(storedIndicator, {
    downColor: firstPalette?.[0] ?? DEFAULT_DOWN_COLOR,
    upColor: firstPalette?.[1] ?? DEFAULT_UP_COLOR,
  });

  return {
    active: storedIndicator?.active ?? false,
    description: definition.description,
    id,
    label: definition.shortTitle,
    lines: [...plotLines, ...bandLines, ...fillLines],
    opacity: getIndicatorTransparency(storedIndicator, id === 'VOL' ? 50 : 0),
    opacityColors,
    parameters,
    scope: 'sub',
    showOpacity: id === 'VOL',
    title:
      definition.shortTitle === definition.title
        ? definition.title
        : `${definition.shortTitle} (${definition.title})`,
  };
}

export function getTradingViewNativeIndicatorSettingsValue(
  settings: ITradingViewNativeIndicatorSettings,
): ITradingViewIndicatorSettingsValue {
  const normalizedSettings =
    normalizeTradingViewNativeIndicatorSettings(settings);
  return {
    schemaVersion: TRADING_VIEW_SETTINGS_SCHEMA_VERSION,
    indicators: [
      ...TRADING_VIEW_NATIVE_INDICATORS.map((indicator) =>
        createMainIndicator(indicator, normalizedSettings),
      ),
      ...TRADING_VIEW_NATIVE_SUB_INDICATORS.map((indicator) =>
        createSubIndicator(
          getTradingViewNativeSubIndicatorDefinition(indicator),
          normalizedSettings,
        ),
      ),
    ],
  };
}

export function createTradingViewNativeIndicatorSettingsValue(): ITradingViewIndicatorSettingsValue {
  return getTradingViewNativeIndicatorSettingsValue(
    createTradingViewNativeIndicatorSettings(),
  );
}

export function getTradingViewNativeIndicatorSettings(
  value: ITradingViewIndicatorSettingsValue,
): ITradingViewNativeIndicatorSettings {
  const indicators = value.indicators.flatMap((indicator) => {
    const id = indicator.id;
    if (
      !isTradingViewNativeIndicator(id) &&
      !isTradingViewNativeSubIndicator(id)
    ) {
      return [];
    }

    return [
      {
        active: indicator.active,
        id,
        lines: Object.fromEntries(
          indicator.lines.map((line) => [
            line.id,
            {
              color: line.color,
              enabled: line.enabled,
              period:
                line.showPeriod === true
                  ? Math.max(1, Math.floor(line.period))
                  : line.period,
              ...(line.secondaryStyle
                ? { secondaryStyle: line.secondaryStyle }
                : {}),
              style: line.style,
            },
          ]),
        ),
        ...(indicator.opacityColors
          ? { opacityColors: { ...indicator.opacityColors } }
          : {}),
        parameters: Object.fromEntries(
          (indicator.parameters ?? []).map((parameter) => [
            parameter.id,
            parameter.value,
          ]),
        ),
        transparency: indicator.opacity,
      },
    ];
  });
  return {
    schemaVersion: TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION,
    mainIndicators: indicators.filter((indicator) =>
      isTradingViewNativeIndicator(indicator.id),
    ),
    subIndicators: indicators.filter((indicator) =>
      isTradingViewNativeSubIndicator(indicator.id),
    ),
  };
}

export function updateTradingViewNativeIndicatorActiveState({
  active,
  indicator,
  maxSelectableSubIndicatorCount,
  settings,
}: {
  active: boolean;
  indicator: ITradingViewNativeAnyIndicator;
  maxSelectableSubIndicatorCount?: number;
  settings: ITradingViewNativeIndicatorSettings;
}): ITradingViewNativeIndicatorSettings {
  const normalizedSettings =
    normalizeTradingViewNativeIndicatorSettings(settings);
  const value = getTradingViewNativeIndicatorSettingsValue(normalizedSettings);
  const targetIndicator = value.indicators.find(
    (item) => item.id === indicator,
  );
  if (!targetIndicator || targetIndicator.active === active) {
    return normalizedSettings;
  }
  const normalizedMaxSelectableSubIndicatorCount =
    normalizeMaxSelectableSubIndicatorCount(maxSelectableSubIndicatorCount);
  if (
    active &&
    isTradingViewNativeSubIndicator(indicator) &&
    normalizedMaxSelectableSubIndicatorCount !== undefined &&
    value.indicators.filter(
      (item) => item.active && isTradingViewNativeSubIndicator(item.id),
    ).length >= normalizedMaxSelectableSubIndicatorCount
  ) {
    return normalizedSettings;
  }
  targetIndicator.active = active;
  const nextSettings = getTradingViewNativeIndicatorSettings(value);
  return isTradingViewNativeIndicator(indicator)
    ? {
        ...normalizedSettings,
        mainIndicators: nextSettings.mainIndicators,
      }
    : {
        ...normalizedSettings,
        subIndicators: nextSettings.subIndicators,
      };
}

export function reconcileTradingViewNativeIndicatorActiveState({
  activeIndicatorValues,
  replaceMainIndicators,
  replaceSubIndicators,
  settings,
}: {
  activeIndicatorValues: ReadonlySet<string>;
  replaceMainIndicators: boolean;
  replaceSubIndicators: boolean;
  settings: ITradingViewNativeIndicatorSettings;
}): ITradingViewNativeIndicatorSettings {
  const normalizedSettings =
    normalizeTradingViewNativeIndicatorSettings(settings);
  const value = getTradingViewNativeIndicatorSettingsValue(normalizedSettings);
  let settingsChanged = false;
  value.indicators.forEach((indicator) => {
    if (
      isTradingViewNativeIndicator(indicator.id)
        ? !replaceMainIndicators
        : !replaceSubIndicators
    ) {
      return;
    }
    const active = activeIndicatorValues.has(indicator.id);
    if (indicator.active !== active) {
      indicator.active = active;
      settingsChanged = true;
    }
  });
  if (!settingsChanged) {
    return normalizedSettings;
  }

  const nextSettings = getTradingViewNativeIndicatorSettings(value);
  const reconciledSettings = {
    ...normalizedSettings,
    ...(replaceMainIndicators
      ? { mainIndicators: nextSettings.mainIndicators }
      : {}),
    ...(replaceSubIndicators
      ? { subIndicators: nextSettings.subIndicators }
      : {}),
  };
  return reconciledSettings;
}

export function getTradingViewNativeActiveMainIndicators(
  settings: ITradingViewNativeIndicatorSettings,
) {
  return new Set(
    getTradingViewNativeIndicatorSettingsValue(settings).indicators.flatMap(
      (indicator) =>
        indicator.active && isTradingViewNativeIndicator(indicator.id)
          ? [indicator.id]
          : [],
    ),
  );
}

function getRuntimeLineStyle(
  style: ITradingViewIndicatorSettingsLine['style'],
): ITradingViewNativeSubIndicatorLineStyle {
  if (style === 'dashed' || style === 'dotted') {
    return style;
  }
  return 'solid';
}

function getRuntimeLineWidth(
  style: ITradingViewIndicatorSettingsLine['style'],
) {
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

function getSubIndicatorOverrides(
  indicator: ITradingViewIndicatorSettingsItem,
  definition: ITradingViewNativeSubIndicatorDefinition,
): ITradingViewNativeSubIndicatorSettingsOverrides {
  const lineMap = new Map(indicator.lines.map((line) => [line.id, line]));
  const parameterMap = new Map(
    (indicator.parameters ?? []).map((parameter) => [
      parameter.id,
      parameter.value,
    ]),
  );
  const plots = Object.fromEntries(
    definition.plots.map((plot) => {
      const line = lineMap.get(`plot:${plot.id}`);
      return [
        plot.id,
        {
          color: line?.color ?? plot.defaultStyle.color,
          lineStyle: getRuntimeLineStyle(
            line?.secondaryStyle ??
              (isIndicatorLinePatternStyle(line?.style)
                ? line.style
                : plot.defaultStyle.lineStyle),
          ),
          lineWidth: getRuntimeLineWidth(
            line?.style ??
              getSettingsLineWidthStyle(plot.defaultStyle.lineWidth),
          ),
          transparency:
            indicator.id === 'VOL'
              ? indicator.opacity
              : plot.defaultStyle.transparency,
          visible: line?.enabled ?? plot.defaultStyle.visible,
        },
      ];
    }),
  );
  const bands = Object.fromEntries(
    definition.bands.map((band) => {
      const line = lineMap.get(`band:${band.id}`);
      return [
        band.id,
        {
          color: line?.color ?? band.defaultStyle.color,
          lineStyle: getRuntimeLineStyle(
            line?.secondaryStyle ??
              (isIndicatorLinePatternStyle(line?.style)
                ? line.style
                : band.defaultStyle.lineStyle),
          ),
          lineWidth: getRuntimeLineWidth(
            line?.style ??
              getSettingsLineWidthStyle(band.defaultStyle.lineWidth),
          ),
          value: parameterMap.get(`band:${band.id}`) ?? band.defaultStyle.value,
          visible: line?.enabled ?? band.defaultStyle.visible,
        },
      ];
    }),
  );
  const fills = Object.fromEntries(
    definition.fills.map((fill) => {
      const line = lineMap.get(`fill:${fill.id}`);
      return [
        fill.id,
        {
          color: line?.color ?? fill.defaultStyle.color,
          transparency: fill.defaultStyle.transparency,
          visible: line?.enabled ?? fill.defaultStyle.visible,
        },
      ];
    }),
  );
  const inputs = Object.fromEntries(
    definition.inputs.flatMap((input) => {
      if (input.type !== 'float' && input.type !== 'integer') {
        return [];
      }
      return [[input.id, parameterMap.get(input.id) ?? input.defaultValue]];
    }),
  );
  const palettes =
    definition.palettes.length > 0 && indicator.opacityColors
      ? Object.fromEntries(
          definition.palettes.map((palette) => [
            palette.id,
            [
              indicator.opacityColors?.downColor ?? palette.defaultColors[0],
              indicator.opacityColors?.upColor ?? palette.defaultColors[1],
              ...palette.defaultColors.slice(2),
            ],
          ]),
        )
      : undefined;

  return {
    bands,
    fills,
    inputs,
    ...(palettes ? { palettes } : {}),
    plots,
  };
}

export function getTradingViewNativeSubIndicatorInstances(
  settings: ITradingViewNativeIndicatorSettings,
): ITradingViewNativeSubIndicatorInstanceConfig[] {
  return getTradingViewNativeIndicatorSettingsValue(
    settings,
  ).indicators.flatMap((indicator) => {
    if (!indicator.active || !isTradingViewNativeSubIndicator(indicator.id)) {
      return [];
    }
    const definition = getTradingViewNativeSubIndicatorDefinition(indicator.id);
    return [
      {
        id: indicator.id,
        indicator: indicator.id,
        isVisible: true,
        settings: getSubIndicatorOverrides(indicator, definition),
      },
    ];
  });
}

export function getTradingViewNativeMainIndicatorSettings(
  settings: ITradingViewNativeIndicatorSettings,
): Partial<
  Record<
    ITradingViewNativeMainIndicatorId,
    ITradingViewNativeIndicatorSettingsItem
  >
> {
  return Object.fromEntries(
    getTradingViewNativeIndicatorSettings(
      getTradingViewNativeIndicatorSettingsValue(settings),
    ).mainIndicators.flatMap((indicator) =>
      isTradingViewNativeIndicator(indicator.id)
        ? [[indicator.id, indicator]]
        : [],
    ),
  );
}
