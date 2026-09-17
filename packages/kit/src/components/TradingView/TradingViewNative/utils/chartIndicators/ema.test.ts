import { calculateTradingViewNativeExponentialMovingAverage } from './ema';

describe('TradingViewNative EMA indicator', () => {
  it('seeds an exponential moving average with the first complete average', () => {
    expect(
      calculateTradingViewNativeExponentialMovingAverage([1, 2, 3, 10], 3),
    ).toEqual([null, null, 2, 6]);
  });
});
