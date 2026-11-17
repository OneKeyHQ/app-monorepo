// cspell:ignore ADXR bollinger BRAR KDJ keltner MACD Macd SKDJ StochRSI TRIX trix
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  calculateTradingViewNativeAverageTrueRange,
  calculateTradingViewNativeBrar,
  calculateTradingViewNativeBullBearPower,
  calculateTradingViewNativeCommodityChannelIndex,
  calculateTradingViewNativeDirectionalMovementIndex,
  calculateTradingViewNativeDma,
  calculateTradingViewNativeEaseOfMovement,
  calculateTradingViewNativeKdj,
  calculateTradingViewNativeKst,
  calculateTradingViewNativeMaSlope,
  calculateTradingViewNativeMacd,
  calculateTradingViewNativeMassIndex,
  calculateTradingViewNativeMomentum,
  calculateTradingViewNativeMoneyFlowIndex,
  calculateTradingViewNativeNegativeVolumeIndex,
  calculateTradingViewNativeOnBalanceVolume,
  calculateTradingViewNativePriceMomentumOscillator,
  calculateTradingViewNativePriceVolumeTrend,
  calculateTradingViewNativePsychologicalLine,
  calculateTradingViewNativeQqe,
  calculateTradingViewNativeRankCorrelationIndex,
  calculateTradingViewNativeRateOfChange,
  calculateTradingViewNativeRelativeStrengthIndex,
  calculateTradingViewNativeRelativeVolatilityIndex,
  calculateTradingViewNativeSkdj,
  calculateTradingViewNativeSqueezeMomentum,
  calculateTradingViewNativeStochasticRsi,
  calculateTradingViewNativeTrendStrengthIndex,
  calculateTradingViewNativeTrix,
  calculateTradingViewNativeVolume,
  calculateTradingViewNativeVolumeRatio,
  calculateTradingViewNativeWilliamsR,
  isTradingViewNativeSubIndicator,
} from '../chartIndicators';

import { getTradingViewNativeSubIndicatorDefinition } from './definitions';

import type {
  ITradingViewNativeSubIndicatorCalculation,
  ITradingViewNativeSubIndicatorCalculationOptions,
  ITradingViewNativeSubIndicatorDefinition,
  ITradingViewNativeSubIndicatorInputDefinition,
  ITradingViewNativeSubIndicatorInputValue,
  ITradingViewNativeSubIndicatorResolvedInstance,
} from './types';
import type {
  ITradingViewNativeIndicatorValues,
  ITradingViewNativeSubIndicator,
} from '../chartIndicators';

const PRICE_SOURCES = [
  'open',
  'high',
  'low',
  'close',
  'hl2',
  'hlc3',
  'ohlc4',
] as const;

type ITradingViewNativePriceSource = (typeof PRICE_SOURCES)[number];

interface ITradingViewNativeRawCalculation {
  paletteIndexes: Record<string, Array<number | null>>;
  plots: Record<string, ITradingViewNativeIndicatorValues>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getRawInputValue(
  instance: ITradingViewNativeSubIndicatorResolvedInstance,
  inputId: string,
): unknown {
  const settings: unknown = instance.settings;
  if (!isRecord(settings) || !isRecord(settings.inputs)) {
    return undefined;
  }

  return settings.inputs[inputId];
}

function normalizeCalculationInput(
  definition: ITradingViewNativeSubIndicatorInputDefinition,
  value: unknown,
): ITradingViewNativeSubIndicatorInputValue {
  switch (definition.type) {
    case 'boolean':
      return typeof value === 'boolean' ? value : definition.defaultValue;
    case 'float':
    case 'integer': {
      const candidate = isFiniteNumber(value) ? value : definition.defaultValue;
      const normalizedCandidate =
        definition.type === 'integer' ? Math.round(candidate) : candidate;
      return Math.min(
        Math.max(normalizedCandidate, definition.min),
        definition.max,
      );
    }
    case 'select':
    case 'source':
      return typeof value === 'string' && definition.options.includes(value)
        ? value
        : definition.defaultValue;
    default: {
      const exhaustiveDefinition: never = definition;
      return exhaustiveDefinition;
    }
  }
}

function resolveCalculationInputValues(
  instance: ITradingViewNativeSubIndicatorResolvedInstance,
  definition: ITradingViewNativeSubIndicatorDefinition,
): Record<string, ITradingViewNativeSubIndicatorInputValue> {
  return Object.fromEntries(
    definition.inputs.map((input) => [
      input.id,
      normalizeCalculationInput(input, getRawInputValue(instance, input.id)),
    ]),
  );
}

function getNumberInput(
  indicator: ITradingViewNativeSubIndicator,
  inputs: Readonly<Record<string, ITradingViewNativeSubIndicatorInputValue>>,
  inputId: string,
): number {
  const value = inputs[inputId];
  if (isFiniteNumber(value)) {
    return value;
  }

  throw new OneKeyLocalError(
    `Invalid ${indicator} calculation input: ${inputId} must be a finite number`,
  );
}

function getBooleanInput(
  indicator: ITradingViewNativeSubIndicator,
  inputs: Readonly<Record<string, ITradingViewNativeSubIndicatorInputValue>>,
  inputId: string,
): boolean {
  const value = inputs[inputId];
  if (typeof value === 'boolean') {
    return value;
  }

  throw new OneKeyLocalError(
    `Invalid ${indicator} calculation input: ${inputId} must be a boolean`,
  );
}

function getSourceInput(
  indicator: ITradingViewNativeSubIndicator,
  inputs: Readonly<Record<string, ITradingViewNativeSubIndicatorInputValue>>,
  inputId: string,
): ITradingViewNativePriceSource {
  const value = inputs[inputId];
  if (
    typeof value === 'string' &&
    (PRICE_SOURCES as readonly string[]).includes(value)
  ) {
    return value as ITradingViewNativePriceSource;
  }

  throw new OneKeyLocalError(
    `Invalid ${indicator} calculation input: ${inputId} must be a supported price source`,
  );
}

function toFiniteValue(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function getSourceValues(
  points: readonly IMarketTokenKLineDataPoint[],
  source: ITradingViewNativePriceSource,
): ITradingViewNativeIndicatorValues {
  return points.map((point) => {
    if (!point) {
      return null;
    }

    switch (source) {
      case 'open':
        return toFiniteValue(point.o);
      case 'high':
        return toFiniteValue(point.h);
      case 'low':
        return toFiniteValue(point.l);
      case 'close':
        return toFiniteValue(point.c);
      case 'hl2':
        return isFiniteNumber(point.h) && isFiniteNumber(point.l)
          ? toFiniteValue((point.h + point.l) / 2)
          : null;
      case 'hlc3':
        return isFiniteNumber(point.h) &&
          isFiniteNumber(point.l) &&
          isFiniteNumber(point.c)
          ? toFiniteValue((point.h + point.l + point.c) / 3)
          : null;
      case 'ohlc4':
        return isFiniteNumber(point.o) &&
          isFiniteNumber(point.h) &&
          isFiniteNumber(point.l) &&
          isFiniteNumber(point.c)
          ? toFiniteValue((point.o + point.h + point.l + point.c) / 4)
          : null;
      default: {
        const exhaustiveSource: never = source;
        return exhaustiveSource;
      }
    }
  });
}

function createVolumePaletteIndexes({
  colorBasedOnPreviousClose,
  points,
  volume,
}: {
  colorBasedOnPreviousClose: boolean;
  points: readonly IMarketTokenKLineDataPoint[];
  volume: ITradingViewNativeIndicatorValues;
}): Array<number | null> {
  return volume.map((volumeValue, index) => {
    const point = points[index];
    if (!isFiniteNumber(volumeValue) || !point || !isFiniteNumber(point.c)) {
      return null;
    }

    const previousClose = points[index - 1]?.c;
    const comparisonValue =
      colorBasedOnPreviousClose && isFiniteNumber(previousClose)
        ? previousClose
        : point.o;

    if (!isFiniteNumber(comparisonValue)) {
      return null;
    }

    return point.c >= comparisonValue ? 1 : 0;
  });
}

function createMacdPaletteIndexes(
  histogram: ITradingViewNativeIndicatorValues,
): Array<number | null> {
  return histogram.map((value, index) => {
    if (!isFiniteNumber(value)) {
      return null;
    }

    const previousValue = histogram[index - 1];
    if (!isFiniteNumber(previousValue)) {
      return value > 0 ? 0 : 2;
    }

    const baseIndex = value > 0 ? 1 : 3;
    return value - previousValue > 0 ? baseIndex - 1 : baseIndex;
  });
}

// Index 0 is the falling/negative color and 1 the rising/positive one, the
// same order as the volume palette.
function createSignPaletteIndexes(
  values: ITradingViewNativeIndicatorValues,
): Array<number | null> {
  return values.map((value) => {
    if (!isFiniteNumber(value)) {
      return null;
    }
    return value >= 0 ? 1 : 0;
  });
}

function createDirectionPaletteIndexes(
  values: ITradingViewNativeIndicatorValues,
): Array<number | null> {
  return values.map((value, index) => {
    if (!isFiniteNumber(value)) {
      return null;
    }
    const previousValue = values[index - 1];
    return value >= (isFiniteNumber(previousValue) ? previousValue : 0) ? 1 : 0;
  });
}

// Squeeze on, squeeze off, neither: the order of the squeeze palette.
function createSqueezePaletteIndexes(
  squeeze: ITradingViewNativeIndicatorValues,
): Array<number | null> {
  return squeeze.map((value) => {
    if (!isFiniteNumber(value)) {
      return null;
    }
    if (value > 0) {
      return 0;
    }
    return value < 0 ? 1 : 2;
  });
}

function assertExactCalculationKeys({
  actualKeys,
  indicator,
  keyType,
  expectedKeys,
}: {
  actualKeys: readonly string[];
  expectedKeys: readonly string[];
  indicator: ITradingViewNativeSubIndicator;
  keyType: 'palette' | 'plot';
}): void {
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !actualKeys.includes(key))
  ) {
    throw new OneKeyLocalError(
      `${indicator} calculation ${keyType} keys do not match its definition`,
    );
  }
}

function normalizeValues(
  values: readonly (number | null | undefined)[],
  pointCount: number,
): ITradingViewNativeIndicatorValues {
  return Array.from({ length: pointCount }, (_, index) => {
    const value = values[index];
    return isFiniteNumber(value) ? value : null;
  });
}

function normalizePaletteIndexes(
  indexes: readonly (number | null | undefined)[],
  colorCount: number,
  pointCount: number,
): Array<number | null> {
  return Array.from({ length: pointCount }, (_, index) => {
    const paletteIndex = indexes[index];
    return isFiniteNumber(paletteIndex) &&
      Number.isInteger(paletteIndex) &&
      paletteIndex >= 0 &&
      paletteIndex < colorCount
      ? paletteIndex
      : null;
  });
}

function createCalculation({
  definition,
  inputValues,
  pointCount,
  rawCalculation,
}: {
  definition: ITradingViewNativeSubIndicatorDefinition;
  inputValues: Record<string, ITradingViewNativeSubIndicatorInputValue>;
  pointCount: number;
  rawCalculation: ITradingViewNativeRawCalculation;
}): ITradingViewNativeSubIndicatorCalculation {
  const expectedPlotIds = definition.plots.map((plot) => plot.id);
  const expectedPaletteIds = definition.palettes.map((palette) => palette.id);

  assertExactCalculationKeys({
    actualKeys: Object.keys(rawCalculation.plots),
    expectedKeys: expectedPlotIds,
    indicator: definition.indicator,
    keyType: 'plot',
  });
  assertExactCalculationKeys({
    actualKeys: Object.keys(rawCalculation.paletteIndexes),
    expectedKeys: expectedPaletteIds,
    indicator: definition.indicator,
    keyType: 'palette',
  });

  return {
    indicator: definition.indicator,
    inputValues: { ...inputValues },
    paletteIndexes: Object.fromEntries(
      expectedPaletteIds.map((paletteId) => [
        paletteId,
        normalizePaletteIndexes(
          rawCalculation.paletteIndexes[paletteId] ?? [],
          definition.palettes.find((palette) => palette.id === paletteId)
            ?.defaultColors.length ?? 0,
          pointCount,
        ),
      ]),
    ),
    plots: Object.fromEntries(
      expectedPlotIds.map((plotId) => [
        plotId,
        normalizeValues(rawCalculation.plots[plotId] ?? [], pointCount),
      ]),
    ),
    pointCount,
  };
}

function calculateRawSubIndicator(
  indicator: ITradingViewNativeSubIndicator,
  inputs: Record<string, ITradingViewNativeSubIndicatorInputValue>,
  points: readonly IMarketTokenKLineDataPoint[],
  { zeroVolumeIsMissing }: ITradingViewNativeSubIndicatorCalculationOptions,
): ITradingViewNativeRawCalculation {
  const closes = getSourceValues(points, 'close');

  switch (indicator) {
    case 'VOL': {
      const result = calculateTradingViewNativeVolume(
        points.map((point) => point?.v),
        getNumberInput(indicator, inputs, 'movingAveragePeriod'),
        getNumberInput(indicator, inputs, 'smoothingPeriod'),
      );
      return {
        paletteIndexes: {
          volume: createVolumePaletteIndexes({
            colorBasedOnPreviousClose: getBooleanInput(
              indicator,
              inputs,
              'colorBasedOnPreviousClose',
            ),
            points,
            volume: result.volume,
          }),
        },
        plots: {
          movingAverage: result.movingAverage,
          smoothedMovingAverage: result.smoothedMovingAverage,
          volume: result.volume,
        },
      };
    }
    case 'MACD': {
      const source = getSourceInput(indicator, inputs, 'source');
      const result = calculateTradingViewNativeMacd(
        getSourceValues(points, source),
        {
          fastPeriod: getNumberInput(indicator, inputs, 'fastPeriod'),
          signalPeriod: getNumberInput(indicator, inputs, 'signalPeriod'),
          slowPeriod: getNumberInput(indicator, inputs, 'slowPeriod'),
        },
      );
      return {
        paletteIndexes: {
          histogram: createMacdPaletteIndexes(result.histogram),
        },
        plots: {
          macd: result.macd,
          signal: result.signal,
          histogram: result.histogram,
        },
      };
    }
    case 'RSI': {
      const result = calculateTradingViewNativeRelativeStrengthIndex(closes, {
        movingAveragePeriod: getNumberInput(
          indicator,
          inputs,
          'movingAveragePeriod',
        ),
        period: getNumberInput(indicator, inputs, 'period'),
      });
      return {
        paletteIndexes: {},
        plots: { movingAverage: result.movingAverage, rsi: result.rsi },
      };
    }
    case 'StochRSI': {
      const result = calculateTradingViewNativeStochasticRsi(closes, {
        dPeriod: getNumberInput(indicator, inputs, 'dPeriod'),
        kPeriod: getNumberInput(indicator, inputs, 'kPeriod'),
        rsiPeriod: getNumberInput(indicator, inputs, 'rsiPeriod'),
        stochasticPeriod: getNumberInput(indicator, inputs, 'stochasticPeriod'),
      });
      return { paletteIndexes: {}, plots: { d: result.d, k: result.k } };
    }
    case 'OBV': {
      const result = calculateTradingViewNativeOnBalanceVolume(
        points,
        getNumberInput(indicator, inputs, 'movingAveragePeriod'),
        { zeroVolumeIsMissing },
      );
      return {
        paletteIndexes: {},
        plots: { movingAverage: result.movingAverage, obv: result.obv },
      };
    }
    case 'MFI':
      return {
        paletteIndexes: {},
        plots: {
          mfi: calculateTradingViewNativeMoneyFlowIndex(
            points,
            getNumberInput(indicator, inputs, 'period'),
          ),
        },
      };
    case 'TRIX':
      return {
        paletteIndexes: {},
        plots: {
          trix: calculateTradingViewNativeTrix(
            closes,
            getNumberInput(indicator, inputs, 'period'),
          ),
        },
      };
    case 'EMV':
      return {
        paletteIndexes: {},
        plots: {
          emv: calculateTradingViewNativeEaseOfMovement(points, {
            divisor: getNumberInput(indicator, inputs, 'divisor'),
            period: getNumberInput(indicator, inputs, 'period'),
          }),
        },
      };
    case 'WR':
      return {
        paletteIndexes: {},
        plots: {
          williamsR: calculateTradingViewNativeWilliamsR(
            points,
            getNumberInput(indicator, inputs, 'period'),
          ),
        },
      };
    case 'ROC':
      return {
        paletteIndexes: {},
        plots: {
          roc: calculateTradingViewNativeRateOfChange(
            closes,
            getNumberInput(indicator, inputs, 'period'),
          ),
        },
      };
    case 'MTM': {
      const source = getSourceInput(indicator, inputs, 'source');
      return {
        paletteIndexes: {},
        plots: {
          momentum: calculateTradingViewNativeMomentum(
            getSourceValues(points, source),
            getNumberInput(indicator, inputs, 'period'),
          ),
        },
      };
    }
    case 'DMI': {
      const result = calculateTradingViewNativeDirectionalMovementIndex(
        points,
        {
          adxSmoothingPeriod: getNumberInput(
            indicator,
            inputs,
            'adxSmoothingPeriod',
          ),
          diPeriod: getNumberInput(indicator, inputs, 'diPeriod'),
        },
      );
      return {
        paletteIndexes: {},
        plots: {
          adx: result.adx,
          adxr: result.adxr,
          dx: result.dx,
          minusDi: result.minusDi,
          plusDi: result.plusDi,
        },
      };
    }
    case 'CCI': {
      const result = calculateTradingViewNativeCommodityChannelIndex(points, {
        movingAveragePeriod: getNumberInput(
          indicator,
          inputs,
          'movingAveragePeriod',
        ),
        period: getNumberInput(indicator, inputs, 'period'),
      });
      return {
        paletteIndexes: {},
        plots: { cci: result.cci, movingAverage: result.movingAverage },
      };
    }
    case 'KDJ': {
      const result = calculateTradingViewNativeKdj(points, {
        dPeriod: getNumberInput(indicator, inputs, 'dPeriod'),
        kPeriod: getNumberInput(indicator, inputs, 'kPeriod'),
        period: getNumberInput(indicator, inputs, 'period'),
      });
      return {
        paletteIndexes: {},
        plots: { d: result.d, j: result.j, k: result.k },
      };
    }
    case 'SKDJ': {
      const result = calculateTradingViewNativeSkdj(points, {
        period: getNumberInput(indicator, inputs, 'period'),
        smoothingPeriod: getNumberInput(indicator, inputs, 'smoothingPeriod'),
      });
      return { paletteIndexes: {}, plots: { d: result.d, k: result.k } };
    }
    case 'DMA': {
      const result = calculateTradingViewNativeDma(closes, {
        longPeriod: getNumberInput(indicator, inputs, 'longPeriod'),
        movingAveragePeriod: getNumberInput(
          indicator,
          inputs,
          'movingAveragePeriod',
        ),
        shortPeriod: getNumberInput(indicator, inputs, 'shortPeriod'),
      });
      return {
        paletteIndexes: {},
        plots: { dif: result.dif, movingAverage: result.movingAverage },
      };
    }
    case 'VR': {
      const result = calculateTradingViewNativeVolumeRatio(points, {
        movingAveragePeriod: getNumberInput(
          indicator,
          inputs,
          'movingAveragePeriod',
        ),
        period: getNumberInput(indicator, inputs, 'period'),
      });
      return {
        paletteIndexes: {},
        plots: { movingAverage: result.movingAverage, vr: result.vr },
      };
    }
    case 'BRAR': {
      const result = calculateTradingViewNativeBrar(
        points,
        getNumberInput(indicator, inputs, 'period'),
      );
      return { paletteIndexes: {}, plots: { ar: result.ar, br: result.br } };
    }
    case 'PSY': {
      const result = calculateTradingViewNativePsychologicalLine(closes, {
        movingAveragePeriod: getNumberInput(
          indicator,
          inputs,
          'movingAveragePeriod',
        ),
        period: getNumberInput(indicator, inputs, 'period'),
      });
      return {
        paletteIndexes: {},
        plots: { movingAverage: result.movingAverage, psy: result.psy },
      };
    }
    case 'PVT':
      return {
        paletteIndexes: {},
        plots: { pvt: calculateTradingViewNativePriceVolumeTrend(points) },
      };
    case 'ATR':
      return {
        paletteIndexes: {},
        plots: {
          atr: calculateTradingViewNativeAverageTrueRange(
            points,
            getNumberInput(indicator, inputs, 'period'),
          ),
        },
      };
    case 'SMI': {
      const result = calculateTradingViewNativeSqueezeMomentum(points, {
        bollingerMultiplier: getNumberInput(
          indicator,
          inputs,
          'bollingerMultiplier',
        ),
        bollingerPeriod: getNumberInput(indicator, inputs, 'bollingerPeriod'),
        keltnerMultiplier: getNumberInput(
          indicator,
          inputs,
          'keltnerMultiplier',
        ),
        keltnerPeriod: getNumberInput(indicator, inputs, 'keltnerPeriod'),
        momentumPeriod: getNumberInput(indicator, inputs, 'momentumPeriod'),
      });
      return {
        paletteIndexes: {
          momentum: createMacdPaletteIndexes(result.momentum),
          squeeze: createSqueezePaletteIndexes(result.squeeze),
        },
        plots: { momentum: result.momentum, squeeze: result.squeeze },
      };
    }
    case 'TSI':
      return {
        paletteIndexes: {},
        plots: {
          tsi: calculateTradingViewNativeTrendStrengthIndex(
            closes,
            getNumberInput(indicator, inputs, 'period'),
          ),
        },
      };
    case 'RVI': {
      const result = calculateTradingViewNativeRelativeVolatilityIndex(closes, {
        period: getNumberInput(indicator, inputs, 'period'),
        signalPeriod: getNumberInput(indicator, inputs, 'signalPeriod'),
      });
      return {
        paletteIndexes: {},
        plots: { rvi: result.rvi, signal: result.signal },
      };
    }
    case 'QQE': {
      const result = calculateTradingViewNativeQqe(closes, {
        fastFactor: getNumberInput(indicator, inputs, 'fastFactor'),
        rsiPeriod: getNumberInput(indicator, inputs, 'rsiPeriod'),
        slowFactor: getNumberInput(indicator, inputs, 'slowFactor'),
        smoothingPeriod: getNumberInput(indicator, inputs, 'smoothingPeriod'),
      });
      return {
        paletteIndexes: {},
        plots: { fast: result.fast, rsi: result.rsi, slow: result.slow },
      };
    }
    case 'MASS':
      return {
        paletteIndexes: {},
        plots: {
          mass: calculateTradingViewNativeMassIndex(
            points,
            getNumberInput(indicator, inputs, 'period'),
          ),
        },
      };
    case 'KST': {
      const result = calculateTradingViewNativeKst(closes, {
        rocPeriods: [
          getNumberInput(indicator, inputs, 'rocPeriod1'),
          getNumberInput(indicator, inputs, 'rocPeriod2'),
          getNumberInput(indicator, inputs, 'rocPeriod3'),
          getNumberInput(indicator, inputs, 'rocPeriod4'),
        ],
        signalPeriod: getNumberInput(indicator, inputs, 'signalPeriod'),
        smoothingPeriods: [
          getNumberInput(indicator, inputs, 'smoothingPeriod1'),
          getNumberInput(indicator, inputs, 'smoothingPeriod2'),
          getNumberInput(indicator, inputs, 'smoothingPeriod3'),
          getNumberInput(indicator, inputs, 'smoothingPeriod4'),
        ],
      });
      return {
        paletteIndexes: {},
        plots: { kst: result.kst, signal: result.signal },
      };
    }
    case 'BBP': {
      const bbp = calculateTradingViewNativeBullBearPower(
        points,
        getNumberInput(indicator, inputs, 'period'),
      );
      return {
        paletteIndexes: { power: createSignPaletteIndexes(bbp) },
        plots: { bbp },
      };
    }
    case 'NVI': {
      const result = calculateTradingViewNativeNegativeVolumeIndex(
        points,
        getNumberInput(indicator, inputs, 'movingAveragePeriod'),
      );
      return {
        paletteIndexes: {},
        plots: { movingAverage: result.movingAverage, nvi: result.nvi },
      };
    }
    case 'PMO': {
      const result = calculateTradingViewNativePriceMomentumOscillator(closes, {
        firstPeriod: getNumberInput(indicator, inputs, 'firstPeriod'),
        secondPeriod: getNumberInput(indicator, inputs, 'secondPeriod'),
        signalPeriod: getNumberInput(indicator, inputs, 'signalPeriod'),
      });
      return {
        paletteIndexes: {},
        plots: { pmo: result.pmo, signal: result.signal },
      };
    }
    case 'RCI':
      return {
        paletteIndexes: {},
        plots: {
          long: calculateTradingViewNativeRankCorrelationIndex(
            closes,
            getNumberInput(indicator, inputs, 'longPeriod'),
          ),
          middle: calculateTradingViewNativeRankCorrelationIndex(
            closes,
            getNumberInput(indicator, inputs, 'middlePeriod'),
          ),
          short: calculateTradingViewNativeRankCorrelationIndex(
            closes,
            getNumberInput(indicator, inputs, 'shortPeriod'),
          ),
        },
      };
    case 'SLOPE': {
      const slope = calculateTradingViewNativeMaSlope(closes, {
        lookback: getNumberInput(indicator, inputs, 'lookback'),
        period: getNumberInput(indicator, inputs, 'period'),
      });
      return {
        paletteIndexes: { direction: createDirectionPaletteIndexes(slope) },
        plots: { slope },
      };
    }
    default: {
      const exhaustiveIndicator: never = indicator;
      return exhaustiveIndicator;
    }
  }
}

export function calculateTradingViewNativeSubIndicator(
  instance: ITradingViewNativeSubIndicatorResolvedInstance,
  points: readonly IMarketTokenKLineDataPoint[],
  options: ITradingViewNativeSubIndicatorCalculationOptions = {},
): ITradingViewNativeSubIndicatorCalculation {
  const runtimeIndicator: unknown = instance.indicator;
  if (
    typeof runtimeIndicator !== 'string' ||
    !isTradingViewNativeSubIndicator(runtimeIndicator)
  ) {
    throw new OneKeyLocalError(
      `Unsupported TradingViewNative sub-indicator: ${String(runtimeIndicator)}`,
    );
  }

  const definition =
    getTradingViewNativeSubIndicatorDefinition(runtimeIndicator);
  const inputValues = resolveCalculationInputValues(instance, definition);
  const rawCalculation = calculateRawSubIndicator(
    runtimeIndicator,
    inputValues,
    points,
    options,
  );

  return createCalculation({
    definition,
    inputValues,
    pointCount: points.length,
    rawCalculation,
  });
}
