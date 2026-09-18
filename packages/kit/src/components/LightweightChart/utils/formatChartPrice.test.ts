import { readFileSync } from 'fs';
import { runInNewContext } from 'vm';

import { numberFormatAsRaw } from '@onekeyhq/shared/src/utils/numberUtils';

import { formatChartPrice } from './formatChartPrice';

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

// Flattens the header's `NumberSizeableText` output into the same plain string
// the chart axis renders, so the two can be compared literally.
function formatHeaderPrice(price: string): string {
  const parts = numberFormatAsRaw(price, {
    formatter: 'price',
    formatterOptions: { currency: '$' },
  });
  if (typeof parts === 'string') {
    return parts;
  }
  return parts
    .map((part) =>
      typeof part === 'string'
        ? part
        : String(part.value).replace(/[0-9]/g, (digit) =>
            SUBSCRIPT_DIGITS.charAt(Number(digit)),
          ),
    )
    .join('');
}

describe('chart axis prices', () => {
  it('compresses deep decimals and prevents truncating all significant digits', () => {
    expect(formatChartPrice(0.000_000_12)).toBe('$0.0₆12');
    expect(formatChartPrice(0.000_001_2)).toBe('$0.0₅12');
    // The subscript form tracks the leading-zero count, not the width budget,
    // so a generous budget must not switch back to the plain form.
    expect(formatChartPrice(0.000_001_2, 20)).toBe('$0.0₅12');
    expect(formatChartPrice(1e-30)).toBe('$0.0₂₉1');
    expect(formatChartPrice(0.123_456_789)).toBe('$0.1235');
    expect(formatChartPrice(0.999_999_99)).toBe('$1');
    expect(formatChartPrice(0.012_345_678_9)).toBe('$0.01235');
    expect(formatChartPrice(0.000_065_3, 10)).toBe('$0.0000653');
    expect(formatChartPrice(0.000_064_59, 10)).toBe('$0.00006459');
  });
  it('rounds half-up on the decimal value, not on its binary neighbour', () => {
    // The double behind 0.0012345 is 0.00123449999..., so toFixed(6) would
    // round down and disagree with the header's BigNumber ROUND_HALF_UP.
    expect(formatChartPrice(0.001_234_5)).toBe('$0.001235');
    expect(formatChartPrice(0.000_012_345, 10)).toBe('$0.00001235');
    expect(formatChartPrice(0.999_95)).toBe('$1');
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
    expect(formatChartPrice(0.700_001)).toBe('$0.7');
    expect(formatChartPrice(1.2e-16)).toBe('$0.0₁₅12');
  });
  it('fits overflow by dropping decimals instead of appending an ellipsis', () => {
    expect(formatChartPrice(12.345_67)).toBe('$12.35');
    expect(formatChartPrice(12.345_678_9)).toBe('$12.35');
    expect(formatChartPrice(12.345_678_9, 7)).toBe('$12.35');
    expect(formatChartPrice(716.681_23)).toBe('$716.68');
    expect(formatChartPrice(0.000_000_123_456)).toBe('$0.0₆1235');
    expect(formatChartPrice(-1.234_567_89e-30, 7)).toBe('-$0.0₂₉12');
  });
  it('converts K/M/B without inserting an ellipsis in front of the unit', () => {
    expect(formatChartPrice(999)).toBe('$999');
    expect(formatChartPrice(999.995)).toBe('$1K');
    expect(formatChartPrice(1000)).toBe('$1K');
    expect(formatChartPrice(77_250)).toBe('$77.25K');
    expect(formatChartPrice(76_819.04)).toBe('$76.82K');
    expect(formatChartPrice(999_999)).toBe('$1M');
    expect(formatChartPrice(999_999.995)).toBe('$1M');
    expect(formatChartPrice(1_000_000)).toBe('$1M');
    expect(formatChartPrice(1_000_000_000)).toBe('$1B');
    expect(formatChartPrice(1_234_567)).toBe('$1.23M');
    expect(formatChartPrice(1_234_567.89)).toBe('$1.23M');
    expect(formatChartPrice(1e30)).toBe('$10000000B...');
    expect(formatChartPrice(0)).toBe('$0');
    expect(formatChartPrice(NaN)).toBe('--');
  });
  // OK-63597: the axis label, the hover bubble and the header all show the same
  // quote, so they must not disagree on rounding or on the subscript form.
  it.each([
    '0.0000653',
    '0.00006459',
    '0.00000653',
    // Five zeros plus four digits does not fit the plain form in 10 characters.
    // Without the subscript the tail would be cut off and change the value.
    '0.000001235',
    '0.0012345',
    '0.000000123456',
    '0.123456789',
    '0.7',
    '0.700001',
    '12.34567',
    '332.41',
    '716.68123',
  ])('matches the header price formatter for %s', (price) => {
    expect(formatChartPrice(Number(price), 10)).toBe(formatHeaderPrice(price));
  });
  it('keeps the axis compact where the header stays verbose', () => {
    // Deliberate divergences: axis ticks drop trailing zeros and compact
    // thousands, otherwise a round scale reads "$100.00 / $200.00 / $300.00".
    // Both forms carry the same digits, so neither can be read as a different
    // price the way a rounding mismatch can.
    expect(formatHeaderPrice('1')).toBe('$1.00');
    expect(formatChartPrice(1, 10)).toBe('$1');
    expect(formatHeaderPrice('1000')).toBe('$1,000.00');
    expect(formatChartPrice(1000, 10)).toBe('$1K');
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
      999.995,
      999_999,
      999_999.995,
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
