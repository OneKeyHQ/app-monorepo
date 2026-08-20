// cspell:ignore Williams
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';
import { calculateTradingViewNativeWilliamsR } from './williamsR';

describe('TradingViewNative Williams %R indicator', () => {
  it('uses the rolling high-low range', () => {
    const points: IMarketTokenKLineDataPoint[] = [
      { c: 2, h: 3, l: 1, o: 2, t: 1, v: 10 },
      { c: 3, h: 4, l: 2, o: 3, t: 2, v: 10 },
      { c: 4, h: 5, l: 3, o: 4, t: 3, v: 10 },
    ];

    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeWilliamsR(points, 3),
      [null, null, -25],
    );
  });

  it('uses the legacy default 14-bar period', () => {
    const points = buildTradingViewNativeIndicatorTestPoints(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );

    expect(
      getFirstTradingViewNativeFiniteValueIndex(
        calculateTradingViewNativeWilliamsR(points),
      ),
    ).toBe(13);
  });

  it('returns null for a zero high-low range', () => {
    const points: IMarketTokenKLineDataPoint[] = [
      { c: 1, h: 1, l: 1, o: 1, t: 1, v: 10 },
      { c: 1, h: 1, l: 1, o: 1, t: 2, v: 10 },
    ];
    const result = calculateTradingViewNativeWilliamsR(points, 2);

    expect(result).toEqual([null, null]);
    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(result);
  });

  it('calculates a tiny but non-zero high-low range', () => {
    const points: IMarketTokenKLineDataPoint[] = [
      { c: 1.5e-11, h: 2e-11, l: 1e-11, o: 1.5e-11, t: 1, v: 10 },
      {
        c: 1.75e-11,
        h: 2e-11,
        l: 1e-11,
        o: 1.5e-11,
        t: 2,
        v: 10,
      },
    ];

    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeWilliamsR(points, 2),
      [null, -25],
    );
  });
});
