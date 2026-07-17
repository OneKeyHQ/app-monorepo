import { formatTradingViewNativePriceTick } from './chartLayout';

describe('TradingViewNative chart layout', () => {
  it('formats price ticks with six significant digits', () => {
    expect(formatTradingViewNativePriceTick(123.456_789)).toBe('123.457');
    expect(formatTradingViewNativePriceTick(1)).toBe('1');
  });
});
