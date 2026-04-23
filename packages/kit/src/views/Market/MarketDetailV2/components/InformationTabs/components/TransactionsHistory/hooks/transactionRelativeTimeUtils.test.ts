import { formatRelativeTimeAbbrAt } from './transactionRelativeTimeUtils';

describe('transactionRelativeTimeUtils', () => {
  it('formats second-based timestamps against a provided base time', () => {
    expect(formatRelativeTimeAbbrAt(1_710_000_000, 1_710_000_045)).toBe('45s');
  });

  it('formats millisecond timestamps against a provided base time', () => {
    expect(formatRelativeTimeAbbrAt(1_710_000_000_000, 1_710_000_125_000)).toBe(
      '2m',
    );
  });
});
