import { runInNewContext } from 'vm';

import { formatChartPrice } from './formatChartPrice';

describe('chart axis prices', () => {
  it('compresses only more than five leading decimal zeros', () => {
    expect(formatChartPrice(0.000_000_12)).toBe('$0.0₆12');
    expect(formatChartPrice(0.000_001_2, 20)).toBe('$0.0000012');
    expect(formatChartPrice(1e-30)).toBe('$0.0₂₉1');
  });
  it('removes floating-point tick noise without flattening real small prices', () => {
    for (let tick = 1; tick <= 9; tick += 1) {
      expect(formatChartPrice(tick * 0.1)).toBe(`$0.${tick}`);
    }
    expect(formatChartPrice(0.700_000_000_000_000_2)).toBe('$0.7');
    expect(formatChartPrice(0.299_999_999_999_999_93)).toBe('$0.3');
    expect(formatChartPrice(-0.1 - 0.2)).toBe('-$0.3');
    expect(formatChartPrice(0.700_001)).toBe('$0.700001');
    expect(formatChartPrice(1.2e-16)).toBe('$0.0₁₅12');
  });
  it('keeps eight amount positions and replaces the last two on overflow', () => {
    expect(formatChartPrice(12.345_67)).toBe('$12.34567');
    expect(formatChartPrice(12.345_678_9)).toBe('$12.345...');
    expect(formatChartPrice(12.345_678_9, 7)).toBe('$12.34...');
    expect(formatChartPrice(0.000_000_123_456)).toBe('$0.0₆12...');
    expect(formatChartPrice(-1.234_567_89e-30, 7)).toBe('-$0.0₂₉...');
  });
  it('converts K/M/B without discarding precision before truncation', () => {
    expect(formatChartPrice(999)).toBe('$999');
    expect(formatChartPrice(1000)).toBe('$1K');
    expect(formatChartPrice(1_000_000)).toBe('$1M');
    expect(formatChartPrice(1_000_000_000)).toBe('$1B');
    expect(formatChartPrice(1_234_567)).toBe('$1.234567M');
    expect(formatChartPrice(1_234_567.89)).toBe('$1.2345...M');
    expect(formatChartPrice(1e30)).toBe('$100000...B');
    expect(formatChartPrice(0)).toBe('$0');
    expect(formatChartPrice(NaN)).toBe('--');
  });
  it('executes identically without module dependencies in the native WebView', () => {
    for (const price of [
      0,
      0.1 + 0.2,
      0.700_000_000_000_000_2,
      0.000_000_123,
      -1e-30,
      1_234_567,
    ]) {
      expect(
        runInNewContext(`(${formatChartPrice.toString()})(${price}, 7)`),
      ).toBe(formatChartPrice(price, 7));
    }
  });
});
