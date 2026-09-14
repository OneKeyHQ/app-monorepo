// cspell:ignore ADXR MACD StochRSI TRIX
import { TRADING_VIEW_NATIVE_THEME_COLORS } from '@onekeyhq/shared/types/tradingViewNative';

import { TRADING_VIEW_NATIVE_SUB_INDICATORS } from '../chartIndicators';

import type {
  ITradingViewNativeSubIndicatorBandDefinition,
  ITradingViewNativeSubIndicatorDefinition,
  ITradingViewNativeSubIndicatorFillDefinition,
  ITradingViewNativeSubIndicatorInputDefinition,
  ITradingViewNativeSubIndicatorPaletteDefinition,
  ITradingViewNativeSubIndicatorPlotDefinition,
  ITradingViewNativeSubIndicatorPlotType,
  ITradingViewNativeSubIndicatorScale,
} from './types';
import type { ITradingViewNativeSubIndicator } from '../chartIndicators';

const DEFAULT_AUTO_SCALE_PADDING_RATIO = 0.08;
const DEFAULT_LINE_COLOR = TRADING_VIEW_NATIVE_THEME_COLORS.indicatorPrimary;
const DEFAULT_SECONDARY_LINE_COLOR =
  TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary;
const DEFAULT_OSCILLATOR_COLOR =
  TRADING_VIEW_NATIVE_THEME_COLORS.indicatorTertiary;
const DEFAULT_BAND_COLOR = TRADING_VIEW_NATIVE_THEME_COLORS.band;

const SOURCE_OPTIONS = [
  'open',
  'high',
  'low',
  'close',
  'hl2',
  'hlc3',
  'ohlc4',
] as const;

function createAutoScale({
  bottomRatio = DEFAULT_AUTO_SCALE_PADDING_RATIO,
  includeValues = [],
  topRatio = DEFAULT_AUTO_SCALE_PADDING_RATIO,
}: {
  bottomRatio?: number;
  includeValues?: readonly number[];
  topRatio?: number;
} = {}): ITradingViewNativeSubIndicatorScale {
  return {
    includeValues,
    kind: 'auto',
    padding: { bottomRatio, topRatio },
  };
}

function createIntegerInput({
  defaultValue,
  id,
  max = 2000,
  min = 1,
  title,
  visibleWhenPlotIds,
}: {
  defaultValue: number;
  id: string;
  max?: number;
  min?: number;
  title: string;
  visibleWhenPlotIds?: readonly string[];
}): ITradingViewNativeSubIndicatorInputDefinition {
  return {
    defaultValue,
    id,
    max,
    min,
    title,
    type: 'integer',
    ...(visibleWhenPlotIds ? { visibleWhenPlotIds } : {}),
  };
}

function createPlot({
  color,
  id,
  paletteId,
  title,
  transparency = 0,
  type = 'line',
  visible = true,
  zOrder = 10,
}: {
  color: string;
  id: string;
  paletteId?: string;
  title: string;
  transparency?: number;
  type?: ITradingViewNativeSubIndicatorPlotType;
  visible?: boolean;
  zOrder?: number;
}): ITradingViewNativeSubIndicatorPlotDefinition {
  return {
    defaultStyle: {
      baseline: 0,
      color,
      joinPoints: false,
      lineStyle: 'solid',
      lineWidth: 1,
      transparency,
      type,
      visible,
    },
    id,
    ...(paletteId ? { paletteId } : {}),
    title,
    zOrder,
  };
}

function createPalette({
  colors,
  id,
  title,
}: {
  colors: readonly string[];
  id: string;
  title: string;
}): ITradingViewNativeSubIndicatorPaletteDefinition {
  return { defaultColors: colors, id, title };
}

function createBand({
  id,
  title,
  value,
  zOrder = -10,
}: {
  id: string;
  title: string;
  value: number;
  zOrder?: number;
}): ITradingViewNativeSubIndicatorBandDefinition {
  return {
    defaultStyle: {
      color: DEFAULT_BAND_COLOR,
      lineStyle: 'dashed',
      lineWidth: 1,
      transparency: 0,
      value,
      visible: true,
    },
    id,
    title,
    zOrder,
  };
}

function createBandFill({
  color,
  fromId,
  id = 'background',
  title = 'Background',
  toId,
}: {
  color: string;
  fromId: string;
  id?: string;
  title?: string;
  toId: string;
}): ITradingViewNativeSubIndicatorFillDefinition {
  return {
    defaultStyle: {
      color,
      transparency: 90,
      visible: true,
    },
    fromId,
    id,
    title,
    toId,
    type: 'band-band',
    zOrder: -20,
  };
}

const DEFINITIONS = {
  VOL: {
    bands: [],
    description: 'Volume',
    fills: [],
    format: { type: 'volume' },
    indicator: 'VOL',
    inputs: [
      createIntegerInput({
        defaultValue: 20,
        id: 'movingAveragePeriod',
        title: 'MA Length',
        visibleWhenPlotIds: ['movingAverage'],
      }),
      {
        defaultValue: false,
        id: 'colorBasedOnPreviousClose',
        title: 'Color based on previous close',
        type: 'boolean',
      },
      createIntegerInput({
        defaultValue: 9,
        id: 'smoothingPeriod',
        max: 10_000,
        title: 'Smoothing Length',
        visibleWhenPlotIds: ['smoothedMovingAverage'],
      }),
    ],
    palettes: [
      createPalette({
        colors: [
          TRADING_VIEW_NATIVE_THEME_COLORS.negative,
          TRADING_VIEW_NATIVE_THEME_COLORS.positive,
        ],
        id: 'volume',
        title: 'Volume direction',
      }),
    ],
    plots: [
      createPlot({
        color: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
        id: 'volume',
        paletteId: 'volume',
        title: 'Volume',
        transparency: 50,
        type: 'columns',
      }),
      createPlot({
        color: DEFAULT_LINE_COLOR,
        id: 'movingAverage',
        title: 'Volume MA',
        visible: false,
        zOrder: 11,
      }),
      createPlot({
        color: DEFAULT_LINE_COLOR,
        id: 'smoothedMovingAverage',
        title: 'Smoothed MA',
        visible: false,
        zOrder: 12,
      }),
    ],
    scale: createAutoScale({ bottomRatio: 0 }),
    shortTitle: 'VOL',
    title: 'Volume',
  },
  MACD: {
    bands: [],
    description: 'Moving Average Convergence/Divergence',
    fills: [],
    format: { type: 'inherit' },
    indicator: 'MACD',
    inputs: [
      createIntegerInput({
        defaultValue: 12,
        id: 'fastPeriod',
        title: 'Fast Length',
      }),
      createIntegerInput({
        defaultValue: 26,
        id: 'slowPeriod',
        title: 'Slow Length',
      }),
      createIntegerInput({
        defaultValue: 9,
        id: 'signalPeriod',
        max: 50,
        title: 'Signal Length',
      }),
      {
        defaultValue: 'close',
        id: 'source',
        options: SOURCE_OPTIONS,
        title: 'Source',
        type: 'source',
      },
    ],
    palettes: [
      createPalette({
        colors: [
          TRADING_VIEW_NATIVE_THEME_COLORS.positive,
          TRADING_VIEW_NATIVE_THEME_COLORS.positiveSubdued,
          TRADING_VIEW_NATIVE_THEME_COLORS.negativeSubdued,
          TRADING_VIEW_NATIVE_THEME_COLORS.negative,
        ],
        id: 'histogram',
        title: 'Histogram momentum',
      }),
    ],
    plots: [
      createPlot({
        color: DEFAULT_LINE_COLOR,
        id: 'macd',
        title: 'DIF',
        zOrder: 11,
      }),
      createPlot({
        color: DEFAULT_SECONDARY_LINE_COLOR,
        id: 'signal',
        title: 'DEA',
        zOrder: 12,
      }),
      createPlot({
        color: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
        id: 'histogram',
        paletteId: 'histogram',
        title: 'MACD',
        type: 'columns',
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'MACD',
    title: 'MACD',
  },
  RSI: {
    bands: [
      createBand({ id: 'upper', title: 'Upper Limit', value: 70 }),
      createBand({ id: 'middle', title: 'Middle Limit', value: 50 }),
      createBand({ id: 'lower', title: 'Lower Limit', value: 30 }),
    ],
    description: 'Relative Strength Index',
    fills: [
      createBandFill({
        color: DEFAULT_OSCILLATOR_COLOR,
        fromId: 'upper',
        toId: 'lower',
      }),
    ],
    format: { precision: 2, type: 'price' },
    indicator: 'RSI',
    inputs: [
      createIntegerInput({
        defaultValue: 14,
        id: 'period',
        title: 'Length',
      }),
      createIntegerInput({
        defaultValue: 14,
        id: 'movingAveragePeriod',
        max: 10_000,
        title: 'Smoothing Length',
        visibleWhenPlotIds: ['movingAverage'],
      }),
    ],
    palettes: [],
    plots: [
      createPlot({
        color: DEFAULT_OSCILLATOR_COLOR,
        id: 'rsi',
        title: 'RSI',
      }),
      createPlot({
        color: DEFAULT_LINE_COLOR,
        id: 'movingAverage',
        title: 'Smoothed MA',
        visible: false,
        zOrder: 11,
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'RSI',
    title: 'Relative Strength Index',
  },
  StochRSI: {
    bands: [
      createBand({ id: 'upper', title: 'Upper Limit', value: 80 }),
      createBand({ id: 'lower', title: 'Lower Limit', value: 20 }),
    ],
    description: 'Stochastic RSI',
    fills: [
      createBandFill({
        color: DEFAULT_LINE_COLOR,
        fromId: 'upper',
        toId: 'lower',
      }),
    ],
    format: { precision: 2, type: 'price' },
    indicator: 'StochRSI',
    inputs: [
      createIntegerInput({
        defaultValue: 14,
        id: 'rsiPeriod',
        max: 10_000,
        title: 'RSI Length',
      }),
      createIntegerInput({
        defaultValue: 14,
        id: 'stochasticPeriod',
        max: 10_000,
        title: 'Stochastic Length',
      }),
      createIntegerInput({
        defaultValue: 3,
        id: 'kPeriod',
        max: 10_000,
        title: 'K',
      }),
      createIntegerInput({
        defaultValue: 3,
        id: 'dPeriod',
        max: 10_000,
        title: 'D',
      }),
    ],
    palettes: [],
    plots: [
      createPlot({ color: DEFAULT_LINE_COLOR, id: 'k', title: '%K' }),
      createPlot({
        color: DEFAULT_SECONDARY_LINE_COLOR,
        id: 'd',
        title: '%D',
        zOrder: 11,
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'StochRSI',
    title: 'Stochastic RSI',
  },
  OBV: {
    bands: [],
    description: 'On Balance Volume',
    fills: [],
    format: { type: 'volume' },
    indicator: 'OBV',
    inputs: [
      createIntegerInput({
        defaultValue: 30,
        id: 'movingAveragePeriod',
        max: 10_000,
        title: 'Smoothing Length',
        visibleWhenPlotIds: ['movingAverage'],
      }),
    ],
    palettes: [],
    plots: [
      createPlot({ color: DEFAULT_LINE_COLOR, id: 'obv', title: 'OBV' }),
      createPlot({
        color: DEFAULT_SECONDARY_LINE_COLOR,
        id: 'movingAverage',
        title: 'MAOBV',
        zOrder: 11,
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'OBV',
    title: 'On Balance Volume',
  },
  MFI: {
    bands: [
      createBand({ id: 'upper', title: 'Upper Limit', value: 80 }),
      createBand({ id: 'lower', title: 'Lower Limit', value: 20 }),
    ],
    description: 'Money Flow Index',
    fills: [
      createBandFill({
        color: DEFAULT_OSCILLATOR_COLOR,
        fromId: 'upper',
        toId: 'lower',
      }),
    ],
    format: { precision: 2, type: 'price' },
    indicator: 'MFI',
    inputs: [
      createIntegerInput({
        defaultValue: 14,
        id: 'period',
        title: 'Length',
      }),
    ],
    palettes: [],
    plots: [
      createPlot({
        color: DEFAULT_OSCILLATOR_COLOR,
        id: 'mfi',
        title: 'MFI',
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'MFI',
    title: 'Money Flow Index',
  },
  TRIX: {
    bands: [createBand({ id: 'zero', title: 'Zero', value: 0 })],
    description: 'TRIX',
    fills: [],
    format: { precision: 2, type: 'price' },
    indicator: 'TRIX',
    inputs: [
      createIntegerInput({
        defaultValue: 18,
        id: 'period',
        title: 'Length',
      }),
    ],
    palettes: [],
    plots: [
      createPlot({ color: DEFAULT_LINE_COLOR, id: 'trix', title: 'TRIX' }),
    ],
    scale: createAutoScale(),
    shortTitle: 'TRIX',
    title: 'TRIX',
  },
  EMV: {
    bands: [],
    description: 'Ease Of Movement',
    fills: [],
    format: { type: 'volume' },
    indicator: 'EMV',
    inputs: [
      createIntegerInput({
        defaultValue: 10_000,
        id: 'divisor',
        max: 1_000_000_000,
        title: 'Divisor',
      }),
      createIntegerInput({
        defaultValue: 14,
        id: 'period',
        title: 'Length',
      }),
    ],
    palettes: [],
    plots: [
      createPlot({
        color: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
        id: 'emv',
        title: 'EOM',
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'EMV',
    title: 'Ease Of Movement',
  },
  WR: {
    bands: [
      createBand({ id: 'upper', title: 'Upper Limit', value: -20 }),
      createBand({ id: 'lower', title: 'Lower Limit', value: -80 }),
    ],
    description: 'Williams %R',
    fills: [
      createBandFill({
        color: DEFAULT_OSCILLATOR_COLOR,
        fromId: 'upper',
        toId: 'lower',
      }),
    ],
    format: { precision: 2, type: 'price' },
    indicator: 'WR',
    inputs: [
      createIntegerInput({
        defaultValue: 14,
        id: 'period',
        title: 'Length',
      }),
    ],
    palettes: [],
    plots: [
      createPlot({
        color: DEFAULT_OSCILLATOR_COLOR,
        id: 'williamsR',
        title: '%R',
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'WR',
    title: 'Williams %R',
  },
  ROC: {
    bands: [createBand({ id: 'zero', title: 'Zero Line', value: 0 })],
    description: 'Rate Of Change',
    fills: [],
    format: { precision: 2, type: 'price' },
    indicator: 'ROC',
    inputs: [
      createIntegerInput({
        defaultValue: 9,
        id: 'period',
        max: 1_000_000_000_000,
        title: 'Length',
      }),
    ],
    palettes: [],
    plots: [createPlot({ color: DEFAULT_LINE_COLOR, id: 'roc', title: 'ROC' })],
    scale: createAutoScale(),
    shortTitle: 'ROC',
    title: 'Rate Of Change',
  },
  MTM: {
    bands: [createBand({ id: 'zero', title: 'Zero', value: 0 })],
    description: 'Momentum',
    fills: [],
    format: { type: 'inherit' },
    indicator: 'MTM',
    inputs: [
      createIntegerInput({
        defaultValue: 10,
        id: 'period',
        title: 'Length',
      }),
      {
        defaultValue: 'close',
        id: 'source',
        options: SOURCE_OPTIONS,
        title: 'Source',
        type: 'source',
      },
    ],
    palettes: [],
    plots: [
      createPlot({
        color: DEFAULT_LINE_COLOR,
        id: 'momentum',
        title: 'Momentum',
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'MTM',
    title: 'Momentum',
  },
  DMI: {
    bands: [],
    description: 'Directional Movement Index',
    fills: [],
    format: { precision: 4, type: 'price' },
    indicator: 'DMI',
    inputs: [
      createIntegerInput({
        defaultValue: 14,
        id: 'diPeriod',
        title: 'DI Length',
      }),
      createIntegerInput({
        defaultValue: 14,
        id: 'adxSmoothingPeriod',
        max: 50,
        title: 'ADX Smoothing',
      }),
    ],
    palettes: [],
    plots: [
      createPlot({
        color: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
        id: 'plusDi',
        title: '+DI',
      }),
      createPlot({
        color: TRADING_VIEW_NATIVE_THEME_COLORS.negative,
        id: 'minusDi',
        title: '-DI',
        zOrder: 11,
      }),
      createPlot({
        color: TRADING_VIEW_NATIVE_THEME_COLORS.warning,
        id: 'dx',
        title: 'DX',
        zOrder: 12,
      }),
      createPlot({
        color: TRADING_VIEW_NATIVE_THEME_COLORS.quaternary,
        id: 'adx',
        title: 'ADX',
        zOrder: 13,
      }),
      createPlot({
        color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorTertiary,
        id: 'adxr',
        title: 'ADXR',
        zOrder: 14,
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'DMI',
    title: 'Directional Movement Index',
  },
  CCI: {
    bands: [
      createBand({ id: 'upper', title: 'Upper Limit', value: 100 }),
      createBand({ id: 'lower', title: 'Lower Limit', value: -100 }),
    ],
    description: 'Commodity Channel Index',
    fills: [
      createBandFill({
        color: DEFAULT_LINE_COLOR,
        fromId: 'upper',
        toId: 'lower',
      }),
    ],
    format: { precision: 2, type: 'price' },
    indicator: 'CCI',
    inputs: [
      createIntegerInput({
        defaultValue: 20,
        id: 'period',
        title: 'Length',
      }),
      createIntegerInput({
        defaultValue: 20,
        id: 'movingAveragePeriod',
        max: 10_000,
        title: 'Smoothing Length',
        visibleWhenPlotIds: ['movingAverage'],
      }),
    ],
    palettes: [],
    plots: [
      createPlot({
        color: DEFAULT_LINE_COLOR,
        id: 'cci',
        title: 'CCI',
        zOrder: 11,
      }),
      createPlot({
        color: DEFAULT_LINE_COLOR,
        id: 'movingAverage',
        title: 'Smoothed MA',
        visible: false,
      }),
    ],
    scale: createAutoScale(),
    shortTitle: 'CCI',
    title: 'Commodity Channel Index',
  },
} satisfies Record<
  ITradingViewNativeSubIndicator,
  ITradingViewNativeSubIndicatorDefinition
>;

export const TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS: readonly ITradingViewNativeSubIndicatorDefinition[] =
  TRADING_VIEW_NATIVE_SUB_INDICATORS.map((indicator) => DEFINITIONS[indicator]);

export function getTradingViewNativeSubIndicatorDefinition(
  indicator: ITradingViewNativeSubIndicator,
): ITradingViewNativeSubIndicatorDefinition {
  return DEFINITIONS[indicator];
}
