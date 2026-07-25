import {
  getTradingViewNativeLineColors,
  isTradingViewNativeLinePriceUp,
  isTradingViewNativePriceUp,
} from './chartStyle';

describe('TradingViewNative chart style', () => {
  it('uses the up style when the current close is at or above its open', () => {
    expect(isTradingViewNativePriceUp({ c: 101, o: 100 })).toBe(true);
    expect(isTradingViewNativePriceUp({ c: 100, o: 100 })).toBe(true);
  });

  it('uses the down style when the current close is below its open', () => {
    expect(isTradingViewNativePriceUp({ c: 99, o: 100 })).toBe(false);
  });

  it('uses the period direction for a line current price', () => {
    expect(isTradingViewNativeLinePriceUp([{ c: 100 }, { c: 101 }])).toBe(true);
    expect(isTradingViewNativeLinePriceUp([{ c: 100 }, { c: 99 }])).toBe(false);
  });

  it('keeps the line color fixed while the current price color changes', () => {
    const colors = { down: 'red', line: 'theme', up: 'green' };
    expect(
      getTradingViewNativeLineColors({
        ...colors,
        points: [{ c: 100 }, { c: 101 }],
      }),
    ).toEqual({ currentPrice: 'green', line: 'theme' });
    expect(
      getTradingViewNativeLineColors({
        ...colors,
        points: [{ c: 100 }, { c: 99 }],
      }),
    ).toEqual({ currentPrice: 'red', line: 'theme' });
  });
});
