import { formatNextDistributionLabel } from './useNextDistributionLabel';

const NEXT_PAYOUT = '2026-11-10T12:00:00.000Z';

describe('formatNextDistributionLabel', () => {
  it.each([
    ['en-US', 'Nov 10'],
    ['zh-CN', '11月10日'],
  ])('writes month and day the %s way', (locale, expected) => {
    expect(formatNextDistributionLabel(NEXT_PAYOUT, locale)).toBe(expected);
  });

  it('keeps a value that is not a date', () => {
    expect(formatNextDistributionLabel('soon', 'en-US')).toBe('soon');
  });
});
