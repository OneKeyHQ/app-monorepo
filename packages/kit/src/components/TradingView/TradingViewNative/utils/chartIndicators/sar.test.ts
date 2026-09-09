import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { calculateTradingViewNativeParabolicSar } from './sar';

describe('TradingViewNative SAR indicator', () => {
  it('moves parabolic SAR with the trend and flips it on reversal', () => {
    const points: IMarketTokenKLineDataPoint[] = [
      { c: 1, h: 2, l: 0, o: 1, t: 1, v: 1 },
      { c: 2, h: 3, l: 1, o: 1, t: 2, v: 1 },
      { c: 3, h: 4, l: 2, o: 2, t: 3, v: 1 },
      { c: 4, h: 5, l: 3, o: 3, t: 4, v: 1 },
      { c: 0, h: 4, l: -1, o: 4, t: 5, v: 1 },
    ];

    const values = calculateTradingViewNativeParabolicSar(points);

    expect(values[0]).toBeNull();
    expect(values[1]).toBe(0);
    expect(values[2]).toBe(0);
    expect(values[3]).toBeCloseTo(0.16);
    expect(values[4]).toBe(5);
  });
});
