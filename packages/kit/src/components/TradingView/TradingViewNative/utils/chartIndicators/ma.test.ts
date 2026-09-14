import { calculateTradingViewNativeSimpleMovingAverage } from './ma';

describe('TradingViewNative MA indicator', () => {
  it('calculates a simple moving average after a complete window', () => {
    expect(
      calculateTradingViewNativeSimpleMovingAverage([1, 2, 3, 4, 5, 6], 3),
    ).toEqual([null, null, 2, 3, 4, 5]);
  });
});
