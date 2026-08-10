// cspell:ignore Bollinger
import { calculateTradingViewNativeBollingerBands } from './boll';

describe('TradingViewNative BOLL indicator', () => {
  it('calculates Bollinger bands with population standard deviation', () => {
    const bands = calculateTradingViewNativeBollingerBands([1, 2, 3], 3, 2);

    expect(bands.middle).toEqual([null, null, 2]);
    expect(bands.upper[2]).toBeCloseTo(3.632_993_161_9);
    expect(bands.lower[2]).toBeCloseTo(0.367_006_838_1);
  });
});
