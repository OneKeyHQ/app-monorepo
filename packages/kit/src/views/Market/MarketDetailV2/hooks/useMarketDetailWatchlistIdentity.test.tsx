/** @jest-environment jsdom */

import { useRoute } from '@react-navigation/native';
import { renderHook } from '@testing-library/react';

import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { useMarketDetailWatchlistIdentity } from './useMarketDetailWatchlistIdentity';

jest.mock('@react-navigation/native', () => ({ useRoute: jest.fn() }));
let mockWatchlist: IMarketWatchListItemV2[] = [];
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: mockWatchlist, isMounted: true }],
}));
beforeEach(() => {
  mockWatchlist = [];
});

it.each([false, true])(
  'never uses an old NEAR contract favorite as the native favorite (native saved: %s)',
  (hasNative) => {
    const contract = {
      chainId: 'near--0',
      contractAddress: 'usdt.tether-token.near',
    };
    mockWatchlist = [
      contract,
      ...(hasNative ? [{ chainId: 'near--0', contractAddress: '' }] : []),
    ];
    jest.mocked(useRoute).mockReturnValue({
      key: 'detail',
      name: 'MarketDetailV2',
      params: { network: 'near', tokenAddress: '', isNative: true },
    });
    const { result } = renderHook(() => useMarketDetailWatchlistIdentity());
    expect(result.current.watchlistContractAddress).toBe('');
    const key = getMarketWatchlistKey({
      chainId: 'near--0',
      contractAddress: result.current.watchlistContractAddress ?? '',
    });
    expect(
      mockWatchlist.some((item) => getMarketWatchlistKey(item) === key),
    ).toBe(hasNative);
    expect(key).not.toBe(getMarketWatchlistKey(contract));
  },
);

it.each([
  { network: 'btc', chainId: 'btc--0', contractAddress: 'native' },
  {
    network: 'eth',
    chainId: 'evm--1',
    contractAddress: '0x0000000000000000000000000000000000000000',
  },
  { network: 'sui', chainId: 'sui--mainnet', contractAddress: '0x2::sui::SUI' },
])(
  'keeps the verified native alias for old $network favorites without isNative',
  ({ network, chainId, contractAddress }) => {
    mockWatchlist = [{ chainId, contractAddress }];
    jest.mocked(useRoute).mockReturnValue({
      key: 'detail',
      name: 'MarketDetailV2',
      params: { network, tokenAddress: '', isNative: true },
    });
    const { result } = renderHook(() => useMarketDetailWatchlistIdentity());
    expect(result.current.watchlistContractAddress).toBe(contractAddress);
  },
);

it.each([
  { chainId: 'evm--1', contractAddress: '0xusdt' },
  { chainId: 'near--0', contractAddress: 'native' },
  {
    chainId: 'near--0',
    contractAddress: '0x0000000000000000000000000000000000000000',
  },
  { chainId: 'sui--mainnet', contractAddress: '0x2::other::OTHER' },
])(
  'does not infer a native favorite from a contract alias on $chainId',
  ({ chainId, contractAddress }) => {
    mockWatchlist = [{ chainId, contractAddress }];
    jest.mocked(useRoute).mockReturnValue({
      key: 'detail',
      name: 'MarketDetailV2',
      params: { network: chainId, tokenAddress: '', isNative: true },
    });
    const { result } = renderHook(() => useMarketDetailWatchlistIdentity());
    expect(result.current.watchlistContractAddress).toBe('');
  },
);

it('uses the stored native favorite address when the list API returns another alias', () => {
  mockWatchlist = [{ chainId: 'evm--1', contractAddress: '', isNative: true }];
  jest.mocked(useRoute).mockReturnValue({
    key: 'detail',
    name: 'MarketDetailV2',
    params: {
      network: 'eth',
      tokenAddress: `0x${'e'.repeat(40)}`,
      isNative: true,
    },
  });
  const { result } = renderHook(() => useMarketDetailWatchlistIdentity());
  expect(
    getMarketWatchlistKey({
      chainId: 'evm--1',
      contractAddress: result.current.watchlistContractAddress ?? 'missing',
    }),
  ).toBe(getMarketWatchlistKey(mockWatchlist[0]));
});

it('does not match a different chain, contract token or listing as a native favorite', () => {
  const address = `0x${'e'.repeat(40)}`;
  mockWatchlist = [
    { chainId: 'evm--56', contractAddress: '', isNative: true },
    { chainId: 'evm--1', contractAddress: '0xwrapped', isNative: false },
    {
      chainId: 'evm--1',
      contractAddress: '',
      isNative: true,
      assetId: 'ethereum',
    },
    { chainId: 'evm--1', contractAddress: '', perpsCoin: 'ETH' },
  ];
  jest.mocked(useRoute).mockReturnValue({
    key: 'detail',
    name: 'MarketDetailV2',
    params: { network: 'eth', tokenAddress: address, isNative: true },
  });
  const { result } = renderHook(() => useMarketDetailWatchlistIdentity());
  expect(result.current.watchlistContractAddress).toBe(address);
});

it.each([
  { networkId: 'btc--0', tokenAddress: '' },
  { networkId: 'btc--0', tokenAddress: 'native' },
  {
    networkId: 'evm--1',
    tokenAddress: '0x0000000000000000000000000000000000000000',
  },
  { networkId: 'sui--mainnet', tokenAddress: '0x2::sui::SUI' },
  { networkId: 'evm--1', tokenAddress: '0xusdt' },
])(
  'keeps the saved favorite identity for star lookup and removal: %j',
  ({ networkId, tokenAddress }) => {
    jest.mocked(useRoute).mockReturnValue({
      key: 'detail',
      name: 'MarketDetailV2',
      params: { network: networkId, tokenAddress },
    });
    const { result } = renderHook(() => useMarketDetailWatchlistIdentity());
    const savedFavorite = { chainId: networkId, contractAddress: tokenAddress };

    expect(result.current.assetId).toBeUndefined();
    expect(result.current.watchlistContractAddress).toBe(tokenAddress);
    expect(
      getMarketWatchlistKey({
        ...result.current,
        chainId: networkId,
        contractAddress: result.current.watchlistContractAddress ?? '',
      }),
    ).toBe(getMarketWatchlistKey(savedFavorite));
  },
);
