import { findTopCoinsEarnAsset } from './useTopCoinsDetail';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

jest.mock('./useMarketDetailDisplayData', () => ({
  useMarketDetailDisplayData: jest.fn(),
}));

describe('findTopCoinsEarnAsset', () => {
  it('uses wrapped ETH recommendations for an ETH detail page', () => {
    const weth = { symbol: 'WETH' } as never;
    expect(findTopCoinsEarnAsset({ assets: [weth], symbol: 'ETH' })).toBe(weth);
  });
});
