import { readFileSync } from 'fs';
import { runInNewContext } from 'vm';

import { formatChartPrice } from './formatChartPrice';

describe('chart axis prices', () => {
  it('compresses deep decimals and prevents truncating all significant digits', () => {
    expect(formatChartPrice(0.000_000_12)).toBe('$0.0₆12');
    expect(formatChartPrice(0.000_001_2)).toBe('$0.0₅12');
    expect(formatChartPrice(0.000_001_2, 20)).toBe('$0.0000012');
    expect(formatChartPrice(1e-30)).toBe('$0.0₂₉1');
    expect(formatChartPrice(0.123_456_789)).toBe('$0.123456');
    expect(formatChartPrice(0.999_999_99)).toBe('$0.999999');
    expect(formatChartPrice(0.012_345_678_9)).toBe('$0.012345');
  });
  it.each([7, 8])('preserves small tick values at width %i', (limit) => {
    for (const price of [0.000_123_456, 0.000_012_345_6]) {
      expect(formatChartPrice(price, limit)).toContain('1');
    }
    const labels = [0.000_001_5, 0.000_002_5, 0.000_003_5].map((price) =>
      formatChartPrice(price, limit),
    );
    expect(new Set(labels).size).toBe(3);
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
  it('fits overflow by dropping decimals instead of appending an ellipsis', () => {
    expect(formatChartPrice(12.345_67)).toBe('$12.35');
    expect(formatChartPrice(12.345_678_9)).toBe('$12.35');
    expect(formatChartPrice(12.345_678_9, 7)).toBe('$12.35');
    expect(formatChartPrice(716.681_23)).toBe('$716.68');
    expect(formatChartPrice(0.000_000_123_456)).toBe('$0.0₆1234');
    expect(formatChartPrice(-1.234_567_89e-30, 7)).toBe('-$0.0₂₉12');
  });
  it('converts K/M/B without inserting an ellipsis in front of the unit', () => {
    expect(formatChartPrice(999)).toBe('$999');
    expect(formatChartPrice(1000)).toBe('$1K');
    expect(formatChartPrice(77_250)).toBe('$77.25K');
    expect(formatChartPrice(76_819.04)).toBe('$76.82K');
    expect(formatChartPrice(1_000_000)).toBe('$1M');
    expect(formatChartPrice(1_000_000_000)).toBe('$1B');
    expect(formatChartPrice(1_234_567)).toBe('$1.23M');
    expect(formatChartPrice(1_234_567.89)).toBe('$1.23M');
    expect(formatChartPrice(1e30)).toBe('$10000000B...');
    expect(formatChartPrice(0)).toBe('$0');
    expect(formatChartPrice(NaN)).toBe('--');
  });
  it('executes identically without module dependencies in the native WebView', () => {
    const nativeFormatChartPrice = runInNewContext(
      `(${readFileSync(
        'packages/kit/src/components/LightweightChart/utils/formatChartPrice.text-js',
        'utf8',
      )})`,
    ) as (price: number, maxCharacters?: number) => string;
    for (const price of [
      0,
      0.1 + 0.2,
      0.700_000_000_000_000_2,
      0.123_456_789,
      0.999_999_99,
      0.012_345_678_9,
      0.000_123_456,
      0.000_012_345_6,
      0.000_001_5,
      0.000_000_123,
      -1e-30,
      77_250,
      76_819.04,
      716.681_23,
      1_234_567,
      1_234_567.89,
    ]) {
      expect(
        runInNewContext(`(${formatChartPrice.toString()})(${price}, 7)`),
      ).toBe(formatChartPrice(price, 7));
      expect(nativeFormatChartPrice(price, 7)).toBe(formatChartPrice(price, 7));
    }
  });
});
