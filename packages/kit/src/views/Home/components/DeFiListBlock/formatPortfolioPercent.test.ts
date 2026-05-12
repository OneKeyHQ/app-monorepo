import { formatPortfolioPercent } from './formatPortfolioPercent';

describe('formatPortfolioPercent', () => {
  it('returns 0.0% for a true zero', () => {
    expect(formatPortfolioPercent(0)).toBe('0.0%');
    expect(formatPortfolioPercent(0, 0)).toBe('0.0%');
    expect(formatPortfolioPercent(0, '0')).toBe('0.0%');
  });

  it('returns <0.1% when percent rounds to 0 but netWorth is positive', () => {
    expect(formatPortfolioPercent(0, 0.01)).toBe('<0.1%');
    expect(formatPortfolioPercent(0, 100)).toBe('<0.1%');
    expect(formatPortfolioPercent(0, '12.34')).toBe('<0.1%');
  });

  it('returns one-decimal percent for normal values', () => {
    expect(formatPortfolioPercent(31.8)).toBe('31.8%');
    expect(formatPortfolioPercent(0.1)).toBe('0.1%');
    expect(formatPortfolioPercent(100)).toBe('100.0%');
  });

  it('returns 0.0% for non-finite values', () => {
    expect(formatPortfolioPercent(Number.NaN)).toBe('0.0%');
    expect(formatPortfolioPercent(Number.POSITIVE_INFINITY)).toBe('0.0%');
    expect(formatPortfolioPercent(Number.NEGATIVE_INFINITY)).toBe('0.0%');
  });

  it('does not emit <0.1% when netWorth is absent', () => {
    expect(formatPortfolioPercent(0)).toBe('0.0%');
    expect(formatPortfolioPercent(0, undefined)).toBe('0.0%');
  });
});
