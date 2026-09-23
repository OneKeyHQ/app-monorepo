import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  copyRecommendListingIds,
  mapRecommendTokensToWatchlistItems,
  matchRecommendTokenAssetId,
  pickResolvedRecommendItems,
} from './mapRecommendTokensToWatchlistItems';

const mockAssetList = jest.fn();
const mockAssetDetail = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetList: (...args: unknown[]): unknown =>
        mockAssetList(...args),
      fetchMarketAssetDetail: (...args: unknown[]): unknown =>
        mockAssetDetail(...args),
    },
  },
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
  mockAssetDetail.mockResolvedValue({
    selectedVariant: {
      networkId: 'btc--0',
      tokenAddress: '',
      isNative: true,
    },
    variants: [],
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
  expect(mockAssetDetail).toHaveBeenCalledWith({
    assetId: 'btc',
    currency: 'usd',
    autoHandleError: false,
  });
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

it('keeps stockId when home recommend cards copy listing ids', async () => {
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
  await expect(
    mapRecommendTokensToWatchlistItems([homeDisplayToken]),
  ).resolves.toEqual([{ chainId: '', contractAddress: '', stockId: 'AAPL' }]);
  expect(mockAssetList).not.toHaveBeenCalled();
});

it('prefers an explicit stockId over the nested stock payload', () => {
  expect(
    copyRecommendListingIds({
      assetId: 'aster',
      stockId: 'AAPL',
      stock: { stockId: 'OTHER' },
    }),
  ).toEqual({ assetId: 'aster', stockId: 'AAPL' });
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

it('keeps resolved listings when another asset detail fails', async () => {
  mockAssetList.mockResolvedValue({
    list: [
      { assetId: 'btc', symbol: 'BTC' },
      { assetId: 'eth', symbol: 'ETH' },
    ],
  });
  mockAssetDetail.mockImplementation(
    async ({ assetId }: { assetId: string }) => {
      if (assetId === 'eth') {
        throw new OneKeyLocalError('offline');
      }
      return {
        selectedVariant: {
          networkId: 'btc--0',
          tokenAddress: '',
          isNative: true,
        },
        variants: [],
      };
    },
  );
  await expect(
    mapRecommendTokensToWatchlistItems([
      btc,
      {
        chainId: 'evm--1',
        contractAddress: '',
        isNative: false,
        symbol: 'ETH',
      },
    ]),
  ).resolves.toEqual([
    { chainId: '', contractAddress: '', assetId: 'btc' },
    {
      chainId: 'evm--1',
      contractAddress: '',
      isNative: false,
    },
  ]);
});

it('maps a recommend token through a non-default asset variant', async () => {
  mockAssetList.mockResolvedValue({
    list: [{ assetId: 'aster', symbol: 'ASTER' }],
  });
  mockAssetDetail.mockResolvedValue({
    selectedVariant: {
      networkId: 'evm--1',
      tokenAddress: '0xdefault',
      isNative: false,
    },
    variants: [
      {
        networkId: aster.chainId,
        tokenAddress: aster.contractAddress,
        isNative: false,
      },
    ],
  });
  await expect(mapRecommendTokensToWatchlistItems([aster])).resolves.toEqual([
    { chainId: '', contractAddress: '', assetId: 'aster' },
  ]);
});

it('skips the top-coin scan when selected tokens have no symbols', async () => {
  await expect(
    mapRecommendTokensToWatchlistItems([
      {
        chainId: 'btc--0',
        contractAddress: '',
        isNative: false,
      },
    ]),
  ).resolves.toEqual([
    {
      chainId: 'btc--0',
      contractAddress: '',
      isNative: false,
    },
  ]);
  expect(mockAssetList).not.toHaveBeenCalled();
  expect(mockAssetDetail).not.toHaveBeenCalled();
});

it('reuses one in-flight top-coin resolution for the same tokens', async () => {
  let resolveList: (value: {
    list: Array<{ assetId: string; symbol: string }>;
  }) => void = () => undefined;
  mockAssetList.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveList = resolve;
      }),
  );
  mockAssetDetail.mockResolvedValue({
    selectedVariant: {
      networkId: 'btc--0',
      tokenAddress: '',
      isNative: true,
    },
    variants: [],
  });

  const first = mapRecommendTokensToWatchlistItems([btc]);
  const second = mapRecommendTokensToWatchlistItems([btc]);
  resolveList({ list: [{ assetId: 'btc', symbol: 'BTC' }] });

  await expect(Promise.all([first, second])).resolves.toEqual([
    [{ chainId: '', contractAddress: '', assetId: 'btc' }],
    [{ chainId: '', contractAddress: '', assetId: 'btc' }],
  ]);
  expect(mockAssetList).toHaveBeenCalledTimes(1);
});

it('picks already resolved listings for the selected subset', () => {
  const resolvedItems = [
    { chainId: '', contractAddress: '', assetId: 'btc' },
    {
      chainId: aster.chainId,
      contractAddress: aster.contractAddress,
      isNative: false,
    },
  ];

  expect(
    pickResolvedRecommendItems({
      tokens: [aster],
      sourceTokens: [btc, aster],
      resolvedItems,
    }),
  ).toEqual([resolvedItems[1]]);
  expect(
    pickResolvedRecommendItems({
      tokens: [btc],
      sourceTokens: [btc],
      resolvedItems: undefined,
    }),
  ).toBeUndefined();
});

it('only resolves top coins whose symbol matches the selection', async () => {
  mockAssetList.mockResolvedValue({
    list: [
      { assetId: 'btc', symbol: 'BTC' },
      { assetId: 'sol', symbol: 'SOL' },
    ],
  });
  mockAssetDetail.mockResolvedValue({
    selectedVariant: {
      networkId: 'btc--0',
      tokenAddress: '',
      isNative: true,
    },
    variants: [],
  });
  await mapRecommendTokensToWatchlistItems([btc]);
  expect(mockAssetDetail).toHaveBeenCalledTimes(1);
  expect(mockAssetDetail).toHaveBeenCalledWith({
    assetId: 'btc',
    currency: 'usd',
    autoHandleError: false,
  });
});
