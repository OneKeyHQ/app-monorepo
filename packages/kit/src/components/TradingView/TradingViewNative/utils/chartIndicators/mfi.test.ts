// cspell:ignore MFI
import { calculateTradingViewNativeMoneyFlowIndex } from './mfi';
import {
  buildTradingViewNativeIndicatorTestPoints,
  expectTradingViewNativeIndicatorValuesToBeCloseTo,
  expectTradingViewNativeIndicatorValuesToBeFiniteOrNull,
  getFirstTradingViewNativeFiniteValueIndex,
} from './testUtils';

describe('TradingViewNative MFI indicator', () => {
  it('uses complete positive and negative money-flow windows', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeMoneyFlowIndex(
        buildTradingViewNativeIndicatorTestPoints(
          [1, 2, 1, 3],
          [10, 10, 20, 10],
        ),
        2,
      ),
      [null, null, 50, 60],
    );
  });

  it('uses the legacy default 14-flow warm-up window', () => {
    const points = buildTradingViewNativeIndicatorTestPoints(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
    const result = calculateTradingViewNativeMoneyFlowIndex(points);

    expect(getFirstTradingViewNativeFiniteValueIndex(result)).toBe(14);
    expect(result[14]).toBe(100);
  });

  it('does not emit non-finite values for invalid OHLCV input', () => {
    const points = buildTradingViewNativeIndicatorTestPoints(
      [1, Number.NaN, 2],
      [0, 10, 0],
    );

    expectTradingViewNativeIndicatorValuesToBeFiniteOrNull(
      calculateTradingViewNativeMoneyFlowIndex(points),
    );
  });
});
