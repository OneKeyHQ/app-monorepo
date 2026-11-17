import { getTradingViewNativeSubIndicatorDefinition } from './definitions';

import type {
  ITradingViewNativeSubIndicatorBandStyle,
  ITradingViewNativeSubIndicatorDefinition,
  ITradingViewNativeSubIndicatorFillStyle,
  ITradingViewNativeSubIndicatorInputDefinition,
  ITradingViewNativeSubIndicatorInputValue,
  ITradingViewNativeSubIndicatorInstanceConfig,
  ITradingViewNativeSubIndicatorLineStyle,
  ITradingViewNativeSubIndicatorPlotStyle,
  ITradingViewNativeSubIndicatorPlotType,
  ITradingViewNativeSubIndicatorResolvedInstance,
  ITradingViewNativeSubIndicatorResolvedSettings,
  ITradingViewNativeSubIndicatorScale,
  ITradingViewNativeSubIndicatorSettingsOverrides,
} from './types';

const LINE_STYLES: readonly ITradingViewNativeSubIndicatorLineStyle[] = [
  'dashed',
  'dotted',
  'solid',
];
const PLOT_TYPES: readonly ITradingViewNativeSubIndicatorPlotType[] = [
  'columns',
  'histogram',
  'line',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  return Math.max(normalizeFiniteNumber(value, fallback), 0);
}

function normalizeTransparency(value: unknown, fallback: number): number {
  return clamp(normalizeFiniteNumber(value, fallback), 0, 100);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue = value.trim();
  return normalizedValue || fallback;
}

function normalizeLineStyle(
  value: unknown,
  fallback: ITradingViewNativeSubIndicatorLineStyle,
): ITradingViewNativeSubIndicatorLineStyle {
  return typeof value === 'string' &&
    (LINE_STYLES as readonly string[]).includes(value)
    ? (value as ITradingViewNativeSubIndicatorLineStyle)
    : fallback;
}

function normalizePlotType(
  value: unknown,
  fallback: ITradingViewNativeSubIndicatorPlotType,
): ITradingViewNativeSubIndicatorPlotType {
  return typeof value === 'string' &&
    (PLOT_TYPES as readonly string[]).includes(value)
    ? (value as ITradingViewNativeSubIndicatorPlotType)
    : fallback;
}

function normalizeNumberInput(
  value: unknown,
  definition: Extract<
    ITradingViewNativeSubIndicatorInputDefinition,
    { type: 'float' | 'integer' }
  >,
): number {
  const definitionMin = Number.isFinite(definition.min)
    ? definition.min
    : Number.MIN_SAFE_INTEGER;
  const definitionMax = Number.isFinite(definition.max)
    ? definition.max
    : Number.MAX_SAFE_INTEGER;
  let min = Math.min(definitionMin, definitionMax);
  let max = Math.max(definitionMin, definitionMax);

  if (definition.type === 'integer') {
    min = Math.ceil(min);
    max = Math.floor(max);
  }

  const defaultValue = Number.isFinite(definition.defaultValue)
    ? definition.defaultValue
    : 0;
  const normalizedDefault = clamp(
    definition.type === 'integer' ? Math.round(defaultValue) : defaultValue,
    min,
    max,
  );

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return normalizedDefault;
  }

  return clamp(
    definition.type === 'integer' ? Math.round(value) : value,
    min,
    max,
  );
}

function normalizeChoiceInput(
  value: unknown,
  definition: Extract<
    ITradingViewNativeSubIndicatorInputDefinition,
    { type: 'select' | 'source' }
  >,
): string {
  const defaultValue = definition.options.includes(definition.defaultValue)
    ? definition.defaultValue
    : (definition.options[0] ?? definition.defaultValue);

  return typeof value === 'string' && definition.options.includes(value)
    ? value
    : defaultValue;
}

function normalizeInput(
  value: unknown,
  definition: ITradingViewNativeSubIndicatorInputDefinition,
): ITradingViewNativeSubIndicatorInputValue {
  switch (definition.type) {
    case 'boolean':
      return normalizeBoolean(value, definition.defaultValue);
    case 'float':
    case 'integer':
      return normalizeNumberInput(value, definition);
    case 'select':
    case 'source':
      return normalizeChoiceInput(value, definition);
    default: {
      const exhaustiveDefinition: never = definition;
      return exhaustiveDefinition;
    }
  }
}

function normalizePlotStyle(
  defaultStyle: ITradingViewNativeSubIndicatorPlotStyle,
  override: unknown,
): ITradingViewNativeSubIndicatorPlotStyle {
  const values = isRecord(override) ? override : {};
  return {
    baseline: normalizeFiniteNumber(values.baseline, defaultStyle.baseline),
    color: normalizeColor(values.color, defaultStyle.color),
    joinPoints: normalizeBoolean(values.joinPoints, defaultStyle.joinPoints),
    lineStyle: normalizeLineStyle(values.lineStyle, defaultStyle.lineStyle),
    lineWidth: normalizeNonNegativeNumber(
      values.lineWidth,
      defaultStyle.lineWidth,
    ),
    transparency: normalizeTransparency(
      values.transparency,
      defaultStyle.transparency,
    ),
    type: normalizePlotType(values.type, defaultStyle.type),
    visible: normalizeBoolean(values.visible, defaultStyle.visible),
  };
}

function normalizeBandStyle(
  defaultStyle: ITradingViewNativeSubIndicatorBandStyle,
  override: unknown,
): ITradingViewNativeSubIndicatorBandStyle {
  const values = isRecord(override) ? override : {};
  return {
    color: normalizeColor(values.color, defaultStyle.color),
    lineStyle: normalizeLineStyle(values.lineStyle, defaultStyle.lineStyle),
    lineWidth: normalizeNonNegativeNumber(
      values.lineWidth,
      defaultStyle.lineWidth,
    ),
    transparency: normalizeTransparency(
      values.transparency,
      defaultStyle.transparency,
    ),
    value: normalizeFiniteNumber(values.value, defaultStyle.value),
    visible: normalizeBoolean(values.visible, defaultStyle.visible),
  };
}

function normalizeFillStyle(
  defaultStyle: ITradingViewNativeSubIndicatorFillStyle,
  override: unknown,
): ITradingViewNativeSubIndicatorFillStyle {
  const values = isRecord(override) ? override : {};
  return {
    color: normalizeColor(values.color, defaultStyle.color),
    transparency: normalizeTransparency(
      values.transparency,
      defaultStyle.transparency,
    ),
    visible: normalizeBoolean(values.visible, defaultStyle.visible),
  };
}

function normalizePaletteColors(
  defaultColors: readonly string[],
  override: unknown,
): string[] {
  const normalizedDefaultColors = defaultColors.map((color) => color.trim());

  if (!Array.isArray(override)) {
    return normalizedDefaultColors;
  }

  return normalizedDefaultColors.map((defaultColor, index) =>
    normalizeColor(override[index], defaultColor),
  );
}

function cloneScale(
  scale: ITradingViewNativeSubIndicatorScale,
): ITradingViewNativeSubIndicatorScale {
  if (scale.kind === 'fixed') {
    return { ...scale };
  }

  return {
    includeValues: [...scale.includeValues],
    kind: 'auto',
    padding: { ...scale.padding },
  };
}

function normalizeScale(
  override: unknown,
  defaultScale: ITradingViewNativeSubIndicatorScale,
): ITradingViewNativeSubIndicatorScale {
  if (!isRecord(override)) {
    return cloneScale(defaultScale);
  }

  if (override.kind === 'fixed') {
    const minValue = override.minValue;
    const maxValue = override.maxValue;
    if (
      typeof minValue === 'number' &&
      Number.isFinite(minValue) &&
      typeof maxValue === 'number' &&
      Number.isFinite(maxValue) &&
      maxValue > minValue
    ) {
      return { kind: 'fixed', maxValue, minValue };
    }

    return cloneScale(defaultScale);
  }

  if (override.kind !== 'auto') {
    return cloneScale(defaultScale);
  }

  const defaultAutoScale =
    defaultScale.kind === 'auto'
      ? defaultScale
      : {
          includeValues: [],
          kind: 'auto' as const,
          padding: { bottomRatio: 0, topRatio: 0 },
        };
  const includeValues = Array.isArray(override.includeValues)
    ? override.includeValues.filter(
        (value): value is number =>
          typeof value === 'number' && Number.isFinite(value),
      )
    : [...defaultAutoScale.includeValues];
  const padding = isRecord(override.padding) ? override.padding : {};

  return {
    includeValues,
    kind: 'auto',
    padding: {
      bottomRatio: normalizeNonNegativeNumber(
        padding.bottomRatio,
        defaultAutoScale.padding.bottomRatio,
      ),
      topRatio: normalizeNonNegativeNumber(
        padding.topRatio,
        defaultAutoScale.padding.topRatio,
      ),
    },
  };
}

export function resolveTradingViewNativeSubIndicatorSettings(
  definition: ITradingViewNativeSubIndicatorDefinition,
  overrides?: ITradingViewNativeSubIndicatorSettingsOverrides,
): ITradingViewNativeSubIndicatorResolvedSettings {
  const overrideValues: unknown = overrides;
  const normalizedOverrides = isRecord(overrideValues) ? overrideValues : {};
  const inputOverrides = isRecord(normalizedOverrides.inputs)
    ? normalizedOverrides.inputs
    : {};
  const plotOverrides = isRecord(normalizedOverrides.plots)
    ? normalizedOverrides.plots
    : {};
  const bandOverrides = isRecord(normalizedOverrides.bands)
    ? normalizedOverrides.bands
    : {};
  const fillOverrides = isRecord(normalizedOverrides.fills)
    ? normalizedOverrides.fills
    : {};
  const paletteOverrides = isRecord(normalizedOverrides.palettes)
    ? normalizedOverrides.palettes
    : {};

  return {
    bands: Object.fromEntries(
      definition.bands.map((band) => [
        band.id,
        normalizeBandStyle(band.defaultStyle, bandOverrides[band.id]),
      ]),
    ),
    fills: Object.fromEntries(
      definition.fills.map((fill) => [
        fill.id,
        normalizeFillStyle(fill.defaultStyle, fillOverrides[fill.id]),
      ]),
    ),
    inputs: Object.fromEntries(
      definition.inputs.map((input) => [
        input.id,
        normalizeInput(inputOverrides[input.id], input),
      ]),
    ),
    palettes: Object.fromEntries(
      definition.palettes.map((palette) => [
        palette.id,
        normalizePaletteColors(
          palette.defaultColors,
          paletteOverrides[palette.id],
        ),
      ]),
    ),
    plots: Object.fromEntries(
      definition.plots.map((plot) => [
        plot.id,
        normalizePlotStyle(plot.defaultStyle, plotOverrides[plot.id]),
      ]),
    ),
    scale: normalizeScale(normalizedOverrides.scale, definition.scale),
  };
}

export function resolveTradingViewNativeSubIndicatorInstance(
  config: ITradingViewNativeSubIndicatorInstanceConfig,
): ITradingViewNativeSubIndicatorResolvedInstance {
  const definition = getTradingViewNativeSubIndicatorDefinition(
    config.indicator,
  );
  return {
    id: config.id,
    indicator: config.indicator,
    isVisible: typeof config.isVisible === 'boolean' ? config.isVisible : true,
    settings: resolveTradingViewNativeSubIndicatorSettings(
      definition,
      config.settings,
    ),
  };
}
