import { getAnalyticsTier } from './tier';

describe('getAnalyticsTier', () => {
  it.each([
    ['low', 1],
    ['medium', 2],
    ['high', 3],
    ['unknown', 2],
  ] as const)('maps %s CPU tier to analytics tier %i', (tier, value) => {
    expect(getAnalyticsTier(tier)).toBe(value);
  });
});
