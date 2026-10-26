// cspell:ignore MACD StochRSI TRIX trix
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_SUB_INDICATORS,
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
} from '../chartIndicators';

import { calculateTradingViewNativeSubIndicator } from './calculators';
import { getTradingViewNativeSubIndicatorDefinition } from './definitions';
import { resolveTradingViewNativeSubIndicatorInstance } from './settings';

import type {
  ITradingViewNativeSubIndicatorInputValue,
  ITradingViewNativeSubIndicatorResolvedInstance,
} from './types';
import type { ITradingViewNativeSubIndicator } from '../chartIndicators';

const EXPECTED_PLOT_IDS = {
  CCI: ['cci', 'movingAverage'],
  DMI: ['plusDi', 'minusDi', 'dx', 'adx', 'adxr'],
  EMV: ['emv'],
  MACD: ['macd', 'signal', 'histogram'],
  MFI: ['mfi'],
  MTM: ['momentum'],
  OBV: ['obv', 'movingAverage'],
  ROC: ['roc'],
  RSI: ['rsi', 'movingAverage'],
  StochRSI: ['k', 'd'],
  TRIX: ['trix'],
  VOL: ['volume', 'movingAverage', 'smoothedMovingAverage'],
  WR: ['williamsR'],
} as const satisfies Record<ITradingViewNativeSubIndicator, readonly string[]>;

function buildTestPoints(count = 80): IMarketTokenKLineDataPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + Math.sin(index / 2) * 8 + index * 0.15;
    const open = close + (index % 2 === 0 ? -1.25 : 0.75);
    return {
      c: close,
      h: Math.max(open, close) + 2 + (index % 3) * 0.1,
      l: Math.min(open, close) - 1.5 - (index % 4) * 0.1,
      o: open,
      t: 1_700_000_000 + index * 3600,
      v: 100 + index * 3 + (index % 5) * 11,
    };
  });
}

function createResolvedInstance(
  indicator: ITradingViewNativeSubIndicator,
  inputs: Readonly<
    Record<string, ITradingViewNativeSubIndicatorInputValue>
  > = {},
): ITradingViewNativeSubIndicatorResolvedInstance {
  return resolveTradingViewNativeSubIndicatorInstance({
    id: `test.${indicator}`,
    indicator,
    settings: { inputs },
  });
}

function calculate(
  indicator: ITradingViewNativeSubIndicator,
  points: readonly IMarketTokenKLineDataPoint[],
  inputs: Readonly<
    Record<string, ITradingViewNativeSubIndicatorInputValue>
  > = {},
) {
  return calculateTradingViewNativeSubIndicator(
    createResolvedInstance(indicator, inputs),
    points,
  );
}

function expectFiniteOrNullValues(values: readonly (number | null)[]): void {
  expect(
    values.every(
      (value) =>
        value === null || (typeof value === 'number' && Number.isFinite(value)),
    ),
  ).toBe(true);
}

describe('TradingViewNative sub-indicator calculators adapter', () => {
  it.each(TRADING_VIEW_NATIVE_SUB_INDICATORS)(
    'dispatches %s with definition-aligned plots and palettes',
    (indicator) => {
      const points = buildTestPoints();
      const definition = getTradingViewNativeSubIndicatorDefinition(indicator);
      const calculation = calculate(indicator, points);

      expect(calculation.indicator).toBe(indicator);
      expect(calculation.pointCount).toBe(points.length);
      expect(Object.keys(calculation.plots)).toEqual(
        EXPECTED_PLOT_IDS[indicator],
      );
      expect(Object.keys(calculation.plots)).toEqual(
        definition.plots.map((plot) => plot.id),
      );
      expect(Object.keys(calculation.paletteIndexes)).toEqual(
        definition.palettes.map((palette) => palette.id),
      );

      Object.values(calculation.plots).forEach((values) => {
        expect(values).toHaveLength(points.length);
        expectFiniteOrNullValues(values);
      });
      Object.values(calculation.paletteIndexes).forEach((indexes) => {
        expect(indexes).toHaveLength(points.length);
      });
    },
  );

  it('passes every definition input to its indicator algorithm', () => {
    const points = buildTestPoints(48);
    const closes = points.map((point) => point.c);
    const opens = points.map((point) => point.o);
    const highs = points.map((point) => point.h);
    const volumes = points.map((point) => point.v);

    expect(
      calculate('VOL', points, {
        colorBasedOnPreviousClose: true,
        movingAveragePeriod: 3,
        smoothingPeriod: 2,
      }).plots,
    ).toEqual(calculateTradingViewNativeVolume(volumes, 3, 2));
    expect(
      calculate('MACD', points, {
        fastPeriod: 2,
        signalPeriod: 2,
        slowPeriod: 4,
        source: 'open',
      }).plots,
    ).toEqual(
      calculateTradingViewNativeMacd(opens, {
        fastPeriod: 2,
        signalPeriod: 2,
        slowPeriod: 4,
      }),
    );
    expect(
      calculate('RSI', points, {
        movingAveragePeriod: 3,
        period: 4,
      }).plots,
    ).toEqual(
      calculateTradingViewNativeRelativeStrengthIndex(closes, {
        movingAveragePeriod: 3,
        period: 4,
      }),
    );
    expect(
      calculate('StochRSI', points, {
        dPeriod: 2,
        kPeriod: 3,
        rsiPeriod: 4,
        stochasticPeriod: 5,
      }).plots,
    ).toEqual(
      calculateTradingViewNativeStochasticRsi(closes, {
        dPeriod: 2,
        kPeriod: 3,
        rsiPeriod: 4,
        stochasticPeriod: 5,
      }),
    );
    expect(calculate('OBV', points, { movingAveragePeriod: 3 }).plots).toEqual(
      calculateTradingViewNativeOnBalanceVolume(points, 3),
    );
    expect(calculate('MFI', points, { period: 4 }).plots).toEqual({
      mfi: calculateTradingViewNativeMoneyFlowIndex(points, 4),
    });
    expect(calculate('TRIX', points, { period: 3 }).plots).toEqual({
      trix: calculateTradingViewNativeTrix(closes, 3),
    });
    expect(calculate('EMV', points, { divisor: 500, period: 3 }).plots).toEqual(
      {
        emv: calculateTradingViewNativeEaseOfMovement(points, {
          divisor: 500,
          period: 3,
        }),
      },
    );
    expect(calculate('WR', points, { period: 4 }).plots).toEqual({
      williamsR: calculateTradingViewNativeWilliamsR(points, 4),
    });
    expect(calculate('ROC', points, { period: 3 }).plots).toEqual({
      roc: calculateTradingViewNativeRateOfChange(closes, 3),
    });
    expect(
      calculate('MTM', points, { period: 3, source: 'high' }).plots,
    ).toEqual({
      momentum: calculateTradingViewNativeMomentum(highs, 3),
    });
    expect(
      calculate('DMI', points, {
        adxSmoothingPeriod: 3,
        diPeriod: 4,
      }).plots,
    ).toEqual(
      calculateTradingViewNativeDirectionalMovementIndex(points, {
        adxSmoothingPeriod: 3,
        diPeriod: 4,
      }),
    );
    expect(
      calculate('CCI', points, {
        movingAveragePeriod: 3,
        period: 4,
      }).plots,
    ).toEqual(
      calculateTradingViewNativeCommodityChannelIndex(points, {
        movingAveragePeriod: 3,
        period: 4,
      }),
    );
  });

  it.each([
    ['open', 2],
    ['high', 4],
    ['low', 2],
    ['close', 2],
    ['hl2', 3],
    ['hlc3', 8 / 3],
    ['ohlc4', 2.5],
  ] as const)('extracts the %s source', (source, expectedMomentum) => {
    const points: IMarketTokenKLineDataPoint[] = [
      { c: 4, h: 5, l: 1, o: 1, t: 1, v: 10 },
      { c: 6, h: 9, l: 3, o: 3, t: 2, v: 20 },
    ];

    const result = calculate('MTM', points, { period: 1, source });

    expect(result.plots.momentum[0]).toBeNull();
    expect(result.plots.momentum[1]).toBeCloseTo(expectedMomentum, 10);
  });

  it('creates Volume palette indexes from candle or previous-close direction', () => {
    const points: IMarketTokenKLineDataPoint[] = [
      { c: 10, h: 13, l: 9, o: 12, t: 1, v: 10 },
      { c: 11, h: 12, l: 7, o: 8, t: 2, v: 20 },
      { c: 10, h: 11, l: 9, o: 10, t: 3, v: 30 },
      { c: 12, h: 13, l: 11, o: 11, t: 4, v: Number.NaN },
    ];

    expect(
      calculate('VOL', points, {
        colorBasedOnPreviousClose: false,
      }).paletteIndexes.volume,
    ).toEqual([0, 1, 1, null]);
    expect(
      calculate('VOL', points, {
        colorBasedOnPreviousClose: true,
      }).paletteIndexes.volume,
    ).toEqual([0, 1, 0, null]);
  });

  it('creates all four MACD histogram momentum palette indexes', () => {
    const closeValues = [
      1, 2, 5, 9, 7, 4, 2, 1, 3, 7, 11, 8, 5, 2, 1, 4, 9, 12, 8, 3, 1,
    ];
    const points = closeValues.map((close, index) => ({
      c: close,
      h: close + 1,
      l: close - 1,
      o: close,
      t: index,
      v: 10,
    }));
    const calculation = calculate('MACD', points, {
      fastPeriod: 2,
      signalPeriod: 2,
      slowPeriod: 3,
    });

    expect(calculation.paletteIndexes.histogram).toEqual([
      null,
      null,
      null,
      0,
      3,
      3,
      2,
      2,
      0,
      0,
      1,
      3,
      3,
      2,
      2,
      0,
      0,
      1,
      3,
      3,
      2,
    ]);
    expect(
      new Set(
        calculation.paletteIndexes.histogram.filter(
          (value): value is number => value !== null,
        ),
      ),
    ).toEqual(new Set([0, 1, 2, 3]));
  });

  it('uses a rising palette color for the first histogram after a gap', () => {
    const closeValues = [1, 2, 5, 9, Number.NaN, 9, 8, 5, 1];
    const points = closeValues.map((close, index) => ({
      c: close,
      h: close + 1,
      l: close - 1,
      o: close,
      t: index,
      v: 10,
    }));
    const calculation = calculate('MACD', points, {
      fastPeriod: 2,
      signalPeriod: 2,
      slowPeriod: 3,
    });

    expect(calculation.paletteIndexes.histogram).toEqual([
      null,
      null,
      null,
      0,
      null,
      null,
      null,
      null,
      2,
    ]);
  });

  it('falls back to definition defaults for malformed resolved settings', () => {
    const points = buildTestPoints(20);
    const validInstance = createResolvedInstance('MTM');
    const malformedInstance = {
      ...validInstance,
      settings: {
        ...validInstance.settings,
        inputs: { period: 'invalid', source: 'median' },
      },
    } as unknown as ITradingViewNativeSubIndicatorResolvedInstance;

    const result = calculateTradingViewNativeSubIndicator(
      malformedInstance,
      points,
    );
    const defaultResult = calculateTradingViewNativeSubIndicator(
      validInstance,
      points,
    );

    expect(result.inputValues).toEqual({ period: 10, source: 'close' });
    expect(result.plots).toEqual(defaultResult.plots);
  });

  it('rejects an unknown runtime indicator before dispatch', () => {
    const instance = {
      ...createResolvedInstance('RSI'),
      indicator: 'UNKNOWN',
    } as unknown as ITradingViewNativeSubIndicatorResolvedInstance;

    expect(() =>
      calculateTradingViewNativeSubIndicator(instance, buildTestPoints()),
    ).toThrow('Unsupported TradingViewNative sub-indicator: UNKNOWN');
  });

  it('normalizes every output to point-aligned finite values or null', () => {
    const points = buildTestPoints(35);
    points[15] = {
      c: Number.NaN,
      h: Number.POSITIVE_INFINITY,
      l: Number.NEGATIVE_INFINITY,
      o: Number.NaN,
      t: points[15]?.t ?? 0,
      v: Number.NaN,
    };

    TRADING_VIEW_NATIVE_SUB_INDICATORS.forEach((indicator) => {
      const calculation = calculate(indicator, points);
      Object.values(calculation.plots).forEach((values) => {
        expect(values).toHaveLength(points.length);
        expectFiniteOrNullValues(values);
      });
      Object.values(calculation.paletteIndexes).forEach((indexes) => {
        expect(indexes).toHaveLength(points.length);
        expect(
          indexes.every(
            (value) =>
              value === null ||
              (typeof value === 'number' && Number.isInteger(value)),
          ),
        ).toBe(true);
      });
    });
  });
});
