import {
  formatPortfolioTotal,
  roundPortfolioTotal,
} from './formatPortfolioTotal';

describe('formatPortfolioTotal', () => {
  it('keeps two decimal places for all finite totals', () => {
    expect(formatPortfolioTotal(4.58, '$', false)).toBe('$4.58');
    expect(formatPortfolioTotal(10, '$', false)).toBe('$10.00');
    expect(formatPortfolioTotal(13, '$', false)).toBe('$13.00');
    expect(formatPortfolioTotal(24.5, '$', false)).toBe('$24.50');
    expect(formatPortfolioTotal(1234.5, '$', false)).toBe('$1,234.50');
  });

  it('preserves hidden balances', () => {
    expect(formatPortfolioTotal(24.5, '$', true)).toBe('$****');
  });

  it('uses a two-decimal zero fallback for non-finite totals', () => {
    expect(formatPortfolioTotal(Number.NaN, '$', false)).toBe('$0.00');
    expect(formatPortfolioTotal(Number.POSITIVE_INFINITY, '$', false)).toBe(
      '$0.00',
    );
  });

  it('preserves the sign for negative totals', () => {
    expect(formatPortfolioTotal(-24.5, '$', false)).toBe('-$24.50');
  });

  it('exposes the same two-decimal value used by portfolio sync', () => {
    expect(roundPortfolioTotal(0.004).toFixed()).toBe('0');
    expect(roundPortfolioTotal(0.005).toFixed()).toBe('0.01');
  });
});
