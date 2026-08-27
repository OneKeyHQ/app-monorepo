import { calculateTradingViewNativeWilderMovingAverage } from './rma';
import { expectTradingViewNativeIndicatorValuesToBeCloseTo } from './testUtils';

describe('TradingViewNative Wilder RMA', () => {
  it('seeds with an SMA and then uses alpha 1 / period', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeWilderMovingAverage([1, 2, 3, 10], 3),
      [null, null, 2, 14 / 3],
    );
  });

  it('starts a new seed window after an invalid value', () => {
    expectTradingViewNativeIndicatorValuesToBeCloseTo(
      calculateTradingViewNativeWilderMovingAverage([1, 2, null, 3, 4], 2),
      [null, 1.5, null, null, 3.5],
    );
  });
});
