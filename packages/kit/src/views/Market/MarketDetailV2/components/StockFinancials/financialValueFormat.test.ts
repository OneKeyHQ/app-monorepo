import { formatFinancialValue } from './financialValueFormat';

describe('financial value formatting', () => {
  it.each([
    [0, '0'],
    [-0, '0'],
    [109.52, '109.52'],
    [1000, '1K'],
    [1_234_567, '1.23M'],
    [-109_000_000_000, '-109B'],
    [999.999, '1K'],
    [999_999, '1M'],
    [999_999_999, '1B'],
    [0.000_001, '0.000001'],
    [0.000_000_123_4, '0.0₆123'],
    [-0.000_000_123_4, '-0.0₆123'],
    [1e-12, '0.0₁₁1'],
    [null, '--'],
    [NaN, '--'],
    [Infinity, '--'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatFinancialValue(value)).toBe(expected);
  });

  it('preserves the unit when shortening values to the available space', () => {
    expect(formatFinancialValue(1e18)).toBe('1000...B');
    expect(formatFinancialValue(-123_456_789_000, { maxCharacters: 7 })).toBe(
      '-12...B',
    );
  });

  it('formats margins without scaling an already-percent value again', () => {
    expect(formatFinancialValue(23.456, { percent: true })).toBe('23.5%');
    expect(formatFinancialValue(-4, { percent: true })).toBe('-4%');
    expect(formatFinancialValue(null, { percent: true })).toBe('--');
  });
});
