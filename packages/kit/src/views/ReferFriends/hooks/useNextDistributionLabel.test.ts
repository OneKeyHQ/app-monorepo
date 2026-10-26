import { formatNextDistributionLabel } from './useNextDistributionLabel';

const NEXT_PAYOUT = '2026-11-10T12:00:00.000Z';

describe('formatNextDistributionLabel', () => {
  it.each([
    ['en-US', '11/10'],
    ['zh-CN', '11/10'],
    ['fr-FR', '10/11'],
    ['zh-HK', '10/11'],
    ['de', '10.11'],
    ['bn', '10/11'],
  ])('writes month and day the %s way', (locale, expected) => {
    expect(formatNextDistributionLabel(NEXT_PAYOUT, locale)).toBe(expected);
  });

  it('keeps a value that is not a date', () => {
    expect(formatNextDistributionLabel('soon', 'en-US')).toBe('soon');
  });
});
