import { isTradingViewNativePriceUp } from './chartStyle';

describe('TradingViewNative chart style', () => {
  it('uses the up style when the current close is at or above its open', () => {
    expect(isTradingViewNativePriceUp({ c: 101, o: 100 })).toBe(true);
    expect(isTradingViewNativePriceUp({ c: 100, o: 100 })).toBe(true);
  });

  it('uses the down style when the current close is below its open', () => {
    expect(isTradingViewNativePriceUp({ c: 99, o: 100 })).toBe(false);
  });
});
