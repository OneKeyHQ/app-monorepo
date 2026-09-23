import {
  copyRecommendListingIds,
  mapRecommendTokensToWatchlistItems,
} from './mapRecommendTokensToWatchlistItems';

const btc = {
  chainId: 'btc--0',
  contractAddress: '',
  isNative: false,
  symbol: 'BTC',
};

const aaveToken = {
  chainId: 'evm--1',
  contractAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
  isNative: false,
  symbol: 'AAVE',
  name: 'Aave Token',
};

it('keeps a chain token when the recommend row has no assetId', () => {
  expect(mapRecommendTokensToWatchlistItems([btc, aaveToken])).toEqual([
    {
      chainId: btc.chainId,
      contractAddress: btc.contractAddress,
      isNative: false,
    },
    {
      chainId: aaveToken.chainId,
      contractAddress: aaveToken.contractAddress,
      isNative: false,
    },
  ]);
});

it('uses only the assetId on that recommend row', () => {
  expect(
    mapRecommendTokensToWatchlistItems([
      { ...btc, assetId: 'bitcoin' },
      { ...aaveToken, assetId: '  ' },
    ]),
  ).toEqual([
    { chainId: '', contractAddress: '', assetId: 'bitcoin' },
    {
      chainId: aaveToken.chainId,
      contractAddress: aaveToken.contractAddress,
      isNative: false,
    },
  ]);
});

it('persists an explicit stockId without a chain identity', () => {
  expect(
    mapRecommendTokensToWatchlistItems([
      {
        chainId: 'evm--1',
        contractAddress: '0xstock',
        isNative: false,
        symbol: 'AAPL',
        stockId: 'AAPL',
      },
    ]),
  ).toEqual([{ chainId: '', contractAddress: '', stockId: 'AAPL' }]);
});

it('keeps stockId when home recommend cards copy listing ids', () => {
  const recommendToken = {
    chainId: 'evm--1',
    contractAddress: '0xstock',
    isNative: false,
    symbol: 'AAPL',
    stockId: 'AAPL',
  };
  const homeDisplayToken = {
    chainId: recommendToken.chainId,
    contractAddress: recommendToken.contractAddress,
    isNative: recommendToken.isNative,
    symbol: recommendToken.symbol,
    ...copyRecommendListingIds(recommendToken),
  };
  expect(mapRecommendTokensToWatchlistItems([homeDisplayToken])).toEqual([
    { chainId: '', contractAddress: '', stockId: 'AAPL' },
  ]);
});

it('prefers an explicit stockId over the nested stock payload', () => {
  expect(
    copyRecommendListingIds({
      assetId: 'aave-token',
      stockId: 'AAPL',
      stock: { stockId: 'OTHER' },
    }),
  ).toEqual({ assetId: 'aave-token', stockId: 'AAPL' });
});

it('prefers stockId so the favorite opens stock detail', () => {
  expect(
    mapRecommendTokensToWatchlistItems([
      {
        ...aaveToken,
        assetId: 'aave',
        stockId: 'AAPL',
      },
    ]),
  ).toEqual([{ chainId: '', contractAddress: '', stockId: 'AAPL' }]);
});

it('returns an empty list when nothing is selected', () => {
  expect(mapRecommendTokensToWatchlistItems([])).toEqual([]);
});
