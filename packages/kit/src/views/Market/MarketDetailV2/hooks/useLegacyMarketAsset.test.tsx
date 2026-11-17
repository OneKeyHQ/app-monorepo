/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { useLegacyMarketAsset } from './useLegacyMarketAsset';

let mockWatchlist: IMarketWatchListItemV2[] = [];
let mockIsFocused = true;
let mockIsOnline = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused,
}));
jest.mock('@onekeyhq/components', () => ({
  useNetInfo: () => ({ isRawInternetReachable: mockIsOnline }),
}));
const mockSearch = jest.fn<Promise<unknown>, [string, unknown?]>();
const mockDetail = jest.fn<Promise<unknown>, [{ assetId: string }]>();
const mockList = jest.fn<Promise<unknown>, [{ type: string }]>();
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: mockWatchlist, isMounted: true }],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      searchV2Token: (...args: Parameters<typeof mockSearch>) =>
        mockSearch(...args),
      fetchMarketAssetList: (...args: Parameters<typeof mockList>) =>
        mockList(...args),
      fetchMarketAssetDetail: (...args: Parameters<typeof mockDetail>) =>
        mockDetail(...args),
    },
    serviceMarketV2: {
      fetchMarketBasicConfig: async () => ({
        code: 0,
        data: { assetCategories: [] },
      }),
    },
  },
}));

const coins = [
  { networkId: 'btc--0', symbol: 'BTC', assetId: 'bitcoin', address: '' },
  {
    networkId: 'evm--1',
    symbol: 'ETH',
    assetId: 'ethereum',
    address: 'native',
  },
  { networkId: 'sol--101', symbol: 'SOL', assetId: 'solana', address: '' },
  {
    networkId: 'tron--0x2b6653dc',
    symbol: 'TRX',
    assetId: 'tron',
    address: '',
  },
  {
    networkId: 'sui--mainnet',
    symbol: 'SUI',
    assetId: 'sui',
    address: '0x2::sui::SUI',
  },
];
function assetDetail(coin: (typeof coins)[number], isNative = true) {
  return {
    asset: {
      assetId: coin.assetId,
      symbol: coin.symbol,
      name: coin.symbol,
      logoUrl: '',
    },
    selectedVariant: {
      networkId: coin.networkId,
      tokenAddress: coin.address,
      isNative,
      variantId: `${coin.assetId}-selected`,
    },
    variants: [],
    market: {
      price: '1',
      priceChange24hPercent: '0',
      marketCap: '1',
      volume24h: '1',
    },
  };
}
const legacyEth = {
  active: true,
  networkId: 'evm--1',
  tokenAddress: '',
  isNative: true,
  isStockRoute: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWatchlist = [];
  mockIsFocused = true;
  mockIsOnline = true;
  mockSearch.mockImplementation(async (query: string) =>
    coins
      .filter((coin) => coin.symbol === query)
      .map((coin) => ({
        network: coin.networkId,
        address: coin.address,
        isNative: true,
        assetId: coin.assetId,
      })),
  );
  mockList.mockResolvedValue({ list: coins, total: coins.length });
  mockDetail.mockImplementation(async ({ assetId }: { assetId: string }) => {
    const coin = coins.find((item) => item.assetId === assetId);
    if (!coin) throw new OneKeyLocalError('Unknown asset');
    return assetDetail(coin);
  });
});

it.each(coins)(
  'resolves an old $symbol favorite using the verified asset variant',
  async (coin) => {
    const { result } = renderHook(() =>
      useLegacyMarketAsset({
        ...legacyEth,
        networkId: coin.networkId,
        tokenAddress: 'native',
      }),
    );
    expect(result.current.isResolving).toBe(true);

    await waitFor(() =>
      expect(result.current.assetParams).toEqual({
        network: coin.networkId,
        tokenAddress: coin.address,
        isNative: true,
        marketTokenId: coin.assetId,
        marketVariantId: `${coin.assetId}-selected`,
        marketTokenCategory: 'top_coins',
      }),
    );
    expect(result.current.isResolving).toBe(false);
  },
);

it('matches a contract favorite to its own chain instead of the default asset variant', async () => {
  const usdt = {
    networkId: 'evm--1',
    symbol: 'USDT',
    assetId: 'tether',
    address: '0xusdt',
  };
  mockWatchlist = [{ chainId: usdt.networkId, contractAddress: usdt.address }];
  mockSearch.mockResolvedValue([
    {
      network: usdt.networkId,
      address: usdt.address,
      assetId: usdt.assetId,
      isNative: false,
    },
  ]);
  mockList.mockResolvedValue({ list: [usdt], total: 1 });
  const detail = assetDetail(usdt, false);
  mockDetail.mockResolvedValue({
    ...detail,
    selectedVariant: { ...detail.selectedVariant, networkId: 'evm--56' },
    variants: [detail.selectedVariant],
  });
  const { result, rerender } = renderHook(() =>
    useLegacyMarketAsset({
      ...legacyEth,
      tokenAddress: usdt.address,
      isNative: false,
    }),
  );

  await waitFor(() =>
    expect(result.current.assetParams).toMatchObject({
      network: usdt.networkId,
      tokenAddress: usdt.address,
      marketTokenId: usdt.assetId,
      marketVariantId: detail.selectedVariant.variantId,
    }),
  );
  mockWatchlist = [];
  rerender();
  expect(result.current.assetParams?.marketTokenId).toBe('tether');
});

it('checks only matching symbols when contract search has no asset ID, then verifies the address', async () => {
  const usdt = {
    networkId: 'evm--1',
    symbol: 'USDT',
    assetId: 'tether',
    address: '0xusdt',
  };
  mockWatchlist = [{ chainId: usdt.networkId, contractAddress: usdt.address }];
  mockSearch.mockResolvedValue([
    { network: usdt.networkId, address: usdt.address, isNative: false },
  ]);
  mockList.mockResolvedValue({
    list: [
      ...Array.from({ length: 98 }, (_, index) => ({
        assetId: `other-${index}`,
        symbol: 'OTHER',
      })),
      { assetId: 'fake-usdt', symbol: 'USDT' },
      usdt,
    ],
    total: 100,
  });
  mockDetail.mockImplementation(async ({ assetId }: { assetId: string }) =>
    assetDetail(
      {
        ...usdt,
        assetId,
        address: assetId === 'tether' ? usdt.address : '0xfake',
      },
      false,
    ),
  );
  const { result } = renderHook(() =>
    useLegacyMarketAsset({
      ...legacyEth,
      tokenAddress: usdt.address,
      isNative: false,
      symbol: usdt.symbol,
    }),
  );
  await waitFor(() =>
    expect(result.current.assetParams).toMatchObject({
      network: usdt.networkId,
      tokenAddress: usdt.address,
      marketTokenId: 'tether',
    }),
  );
  expect(mockDetail).toHaveBeenCalledTimes(2);
  expect(
    mockDetail.mock.calls.map(([request]) => request.assetId).toSorted(),
  ).toEqual(['fake-usdt', 'tether']);
});

it('does not repeat a successful lookup on focus or network recovery', async () => {
  const { result, rerender } = renderHook(() =>
    useLegacyMarketAsset(legacyEth),
  );
  await waitFor(() =>
    expect(result.current.assetParams?.marketTokenId).toBe('ethereum'),
  );
  const params = result.current.assetParams;
  mockDetail.mockClear();
  mockIsFocused = false;
  mockIsOnline = false;
  rerender();
  mockIsFocused = true;
  mockIsOnline = true;
  rerender();
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.assetParams).toBe(params);
  expect(mockDetail).not.toHaveBeenCalled();
});

it.each([
  { isStockRoute: true },
  { networkId: 'evm--11155111' },
  { marketTokenCategory: 'top_coins', marketTokenId: 'ethereum' },
  { tokenAddress: '0xordinary', isNative: false },
  { active: false },
])(
  'preserves other entries without starting a lookup: %j',
  async (overrides) => {
    const { result } = renderHook(() =>
      useLegacyMarketAsset({ ...legacyEth, ...overrides }),
    );
    expect(result.current).toEqual({
      assetParams: undefined,
      isResolving: false,
    });
    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockDetail).not.toHaveBeenCalled();
  },
);

it('does not apply a late asset result to another token', async () => {
  let finish: ((value: ReturnType<typeof assetDetail>) => void) | undefined;
  const eth = assetDetail(coins[1]);
  mockDetail.mockImplementation(({ assetId }: { assetId: string }) =>
    assetId === 'ethereum'
      ? new Promise<ReturnType<typeof assetDetail>>((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(assetDetail(coins[2])),
  );
  const { result, rerender } = renderHook(
    ({ networkId }) => useLegacyMarketAsset({ ...legacyEth, networkId }),
    { initialProps: { networkId: legacyEth.networkId } },
  );
  await waitFor(() => expect(finish).toBeDefined());
  rerender({ networkId: coins[2].networkId });
  expect(result.current.assetParams).toBeUndefined();
  await waitFor(() =>
    expect(result.current.assetParams?.marketTokenId).toBe('solana'),
  );
  await act(async () => finish?.(eth));
  expect(result.current.assetParams?.marketTokenId).toBe('solana');
});

it('falls back after a failed legacy ID lookup and retries on refocus', async () => {
  mockDetail.mockRejectedValueOnce(new Error('offline'));
  const { result, rerender } = renderHook(
    ({ active }) =>
      useLegacyMarketAsset({ ...legacyEth, active, marketTokenId: 'ethereum' }),
    { initialProps: { active: true } },
  );
  await waitFor(() => expect(result.current.isResolving).toBe(false));
  expect(result.current.assetParams).toBeUndefined();
  rerender({ active: false });
  rerender({ active: true });
  await waitFor(() =>
    expect(result.current.assetParams?.marketTokenId).toBe('ethereum'),
  );
});

it('retries a failed native lookup on real focus changes while active stays true', async () => {
  mockDetail.mockRejectedValueOnce(new Error('offline'));
  const { result, rerender } = renderHook(() =>
    useLegacyMarketAsset({ ...legacyEth, marketTokenId: 'ethereum' }),
  );
  await waitFor(() => expect(result.current.isResolving).toBe(false));
  expect(result.current.assetParams).toBeUndefined();
  mockIsFocused = false;
  rerender();
  mockIsFocused = true;
  rerender();
  await waitFor(() =>
    expect(result.current.assetParams?.marketTokenId).toBe('ethereum'),
  );
});

it('retries a failed lookup when the network reconnects without navigating away', async () => {
  mockDetail.mockRejectedValueOnce(new Error('offline'));
  const { result, rerender } = renderHook(() =>
    useLegacyMarketAsset({ ...legacyEth, marketTokenId: 'ethereum' }),
  );
  await waitFor(() => expect(result.current.isResolving).toBe(false));
  mockIsOnline = false;
  rerender();
  mockIsOnline = true;
  rerender();
  await waitFor(() =>
    expect(result.current.assetParams?.marketTokenId).toBe('ethereum'),
  );
});
