import {
  mapRecommendTokensToWatchlistItems,
  matchRecommendTokenAssetId,
} from './mapRecommendTokensToWatchlistItems';

const mockAssetList = jest.fn();
const mockResolveIdentity = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetList: (...args: unknown[]): unknown =>
        mockAssetList(...args),
    },
  },
}));

jest.mock('./marketListingWatchlistIdentity', () => ({
  resolveMarketListingWatchlistIdentity: (...args: unknown[]): unknown =>
    mockResolveIdentity(...args),
}));

const btc = {
  chainId: 'btc--0',
  contractAddress: '',
  isNative: false,
  symbol: 'BTC',
};

const aster = {
  chainId: 'evm--56',
  contractAddress: '0x000Ae314E2A2172a039B26378814C252734f556A',
  isNative: false,
  symbol: 'ASTER',
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('uses an explicit assetId before comparing token identities', () => {
  expect(
    matchRecommendTokenAssetId({
      token: { ...btc, assetId: 'btc' },
      listings: [{ assetId: 'other', chainId: 'btc--0', contractAddress: '' }],
    }),
  ).toBe('btc');
});

it('maps a native recommend token to the matching top-coin listing', () => {
  expect(
    matchRecommendTokenAssetId({
      token: btc,
      listings: [{ assetId: 'btc', chainId: 'btc--0', contractAddress: '' }],
    }),
  ).toBe('btc');
});

it('maps an EVM recommend token regardless of address case', () => {
  expect(
    matchRecommendTokenAssetId({
      token: aster,
      listings: [
        {
          assetId: 'aster',
          chainId: 'evm--56',
          contractAddress: '0x000ae314e2a2172a039b26378814c252734f556a',
        },
      ],
    }),
  ).toBe('aster');
});

it('keeps unmatched recommend tokens as dex identities', async () => {
  mockAssetList.mockResolvedValue({
    list: [{ assetId: 'btc', symbol: 'BTC' }],
  });
  mockResolveIdentity.mockResolvedValue({
    chainId: 'btc--0',
    contractAddress: '',
  });
  await expect(
    mapRecommendTokensToWatchlistItems([btc, aster]),
  ).resolves.toEqual([
    { chainId: '', contractAddress: '', assetId: 'btc' },
    {
      chainId: aster.chainId,
      contractAddress: aster.contractAddress,
      isNative: false,
    },
  ]);
  expect(mockResolveIdentity).toHaveBeenCalledWith('asset', 'btc');
});

it('persists explicit listing identities without fetching top coins', async () => {
  await expect(
    mapRecommendTokensToWatchlistItems([
      { ...btc, assetId: 'btc' },
      { ...aster, assetId: 'aster' },
      {
        chainId: 'evm--1',
        contractAddress: '0xstock',
        isNative: false,
        symbol: 'AAPL',
        stockId: 'AAPL',
      },
    ]),
  ).resolves.toEqual([
    { chainId: '', contractAddress: '', assetId: 'btc' },
    { chainId: '', contractAddress: '', assetId: 'aster' },
    { chainId: '', contractAddress: '', stockId: 'AAPL' },
  ]);
  expect(mockAssetList).not.toHaveBeenCalled();
});

it('prefers stockId so the favorite opens stock detail', async () => {
  await expect(
    mapRecommendTokensToWatchlistItems([
      {
        ...aster,
        assetId: 'aster',
        stockId: 'AAPL',
      },
    ]),
  ).resolves.toEqual([{ chainId: '', contractAddress: '', stockId: 'AAPL' }]);
});

it('falls back to dex identities when the top-coin list cannot load', async () => {
  mockAssetList.mockRejectedValue(new Error('offline'));
  await expect(mapRecommendTokensToWatchlistItems([btc])).resolves.toEqual([
    {
      chainId: btc.chainId,
      contractAddress: btc.contractAddress,
      isNative: false,
    },
  ]);
});

it('returns an empty list when nothing is selected', async () => {
  await expect(mapRecommendTokensToWatchlistItems([])).resolves.toEqual([]);
});

it('only resolves top coins whose symbol matches the selection', async () => {
  mockAssetList.mockResolvedValue({
    list: [
      { assetId: 'btc', symbol: 'BTC' },
      { assetId: 'sol', symbol: 'SOL' },
    ],
  });
  mockResolveIdentity.mockResolvedValue({
    chainId: 'btc--0',
    contractAddress: '',
  });
  await mapRecommendTokensToWatchlistItems([btc]);
  expect(mockResolveIdentity).toHaveBeenCalledTimes(1);
  expect(mockResolveIdentity).toHaveBeenCalledWith('asset', 'btc');
});
