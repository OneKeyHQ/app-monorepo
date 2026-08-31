import {
  findTopCoinsEarnAsset,
  findTopCoinsMarketTokenCandidate,
} from './useTopCoinsDetail';

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

describe('findTopCoinsMarketTokenCandidate', () => {
  const candidates = [
    {
      coingeckoId: 'ethereum-classic',
      name: 'Ethereum Classic',
      symbol: 'eth',
    },
    {
      coingeckoId: 'ethereum',
      name: 'Ethereum',
      symbol: 'ETH',
    },
  ] as never;

  it('prefers an exact name and symbol match', () => {
    expect(
      findTopCoinsMarketTokenCandidate({
        candidates,
        name: 'Ethereum',
        symbol: 'ETH',
      })?.coingeckoId,
    ).toBe('ethereum');
  });

  it('falls back to a symbol match when the names differ', () => {
    expect(
      findTopCoinsMarketTokenCandidate({
        candidates,
        name: 'Ether',
        symbol: 'ETH',
      })?.coingeckoId,
    ).toBe('ethereum-classic');
  });
});

describe('findTopCoinsEarnAsset', () => {
  it('uses wrapped ETH recommendations for an ETH detail page', () => {
    const weth = { symbol: 'WETH' } as never;
    expect(findTopCoinsEarnAsset({ assets: [weth], symbol: 'ETH' })).toBe(weth);
  });
});
