import { getMinLiquidity } from './utils';

describe('getMinLiquidity', () => {
  test('defaults to the Market seed-compatible liquidity threshold', () => {
    expect(getMinLiquidity()).toBe(5000);
  });

  test('uses the backend liquidity threshold when it is provided', () => {
    const basicConfig = {
      minLiquidity: 10_000,
    } as Parameters<typeof getMinLiquidity>[0];

    expect(getMinLiquidity(basicConfig)).toBe(10_000);
  });
});
