import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { createTimeRangeOption } from './createTimeRangeOption';

function detail(priceChange1hPercent?: string) {
  return { priceChange1hPercent } as unknown as IMarketTokenDetail;
}

function option(priceChange1hPercent?: string) {
  return createTimeRangeOption(
    detail(priceChange1hPercent),
    'priceChange1hPercent',
    '1h',
    '1h',
  );
}

describe('createTimeRangeOption', () => {
  it('signs and separates the way the other percentages do', () => {
    expect(option('1.05')?.percentageChange).toBe('+1.05%');
    expect(option('-6.72')?.percentageChange).toBe('-6.72%');
    expect(option('1234.5')?.percentageChange).toBe('+1,234.50%');
  });

  it('shares the 99,999% ceiling instead of clamping at 999.99%', () => {
    expect(option('162649.12')?.percentageChange).toBe('>+99,999%');
    expect(option('-162649.12')?.percentageChange).toBe('>-99,999%');
  });

  it('reads a value that rounds away as flat, with no sign', () => {
    const rounded = option('0.001');
    expect(rounded?.percentageChange).toBe('0.00%');
    expect(rounded?.isZero).toBe(true);
    expect(rounded?.isPositive).toBe(false);
  });

  it('treats an unparseable payload as flat', () => {
    expect(option('--')?.percentageChange).toBe('0.00%');
  });

  it('returns nothing without a value to show', () => {
    expect(option(undefined)).toBeNull();
  });
});
