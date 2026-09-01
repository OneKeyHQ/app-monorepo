import {
  findTopCoinsEarnAsset,
  getTopCoinsAssetIdCandidates,
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

describe('getTopCoinsAssetIdCandidates', () => {
  it('prefers the route Asset id and keeps the symbol as a legacy fallback', () => {
    expect(
      getTopCoinsAssetIdCandidates({
        marketTokenId: 'ethereum',
        symbol: 'ETH',
      }),
    ).toEqual(['ethereum', 'eth']);
  });

  it('deduplicates a current Asset id from the normalized symbol', () => {
    expect(
      getTopCoinsAssetIdCandidates({
        marketTokenId: 'eth',
        symbol: 'ETH',
      }),
    ).toEqual(['eth']);
  });
});

describe('findTopCoinsEarnAsset', () => {
  it('uses wrapped ETH recommendations for an ETH detail page', () => {
    const weth = { symbol: 'WETH' } as never;
    expect(findTopCoinsEarnAsset({ assets: [weth], symbol: 'ETH' })).toBe(weth);
  });
});
