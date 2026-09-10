// cspell:ignore ADXR MACD Macd StochRSI TRIX trix
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  calculateTradingViewNativeCommodityChannelIndex,
  calculateTradingViewNativeDirectionalMovementIndex,
  calculateTradingViewNativeEaseOfMovement,
  calculateTradingViewNativeMacd,
  calculateTradingViewNativeMomentum,
  calculateTradingViewNativeMoneyFlowIndex,
  calculateTradingViewNativeOnBalanceVolume,
  calculateTradingViewNativeRateOfChange,
  calculateTradingViewNativeRelativeStrengthIndex,
  calculateTradingViewNativeStochasticRsi,
  calculateTradingViewNativeTrix,
  calculateTradingViewNativeVolume,
  calculateTradingViewNativeWilliamsR,
  isTradingViewNativeSubIndicator,
} from '../chartIndicators';

import { getTradingViewNativeSubIndicatorDefinition } from './definitions';

import type {
  ITradingViewNativeSubIndicatorCalculation,
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
    default: {
      const exhaustiveIndicator: never = indicator;
      return exhaustiveIndicator;
    }
  }
}

export function calculateTradingViewNativeSubIndicator(
  instance: ITradingViewNativeSubIndicatorResolvedInstance,
  points: readonly IMarketTokenKLineDataPoint[],
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
  );

  return createCalculation({
    definition,
    inputValues,
    pointCount: points.length,
    rawCalculation,
  });
}
