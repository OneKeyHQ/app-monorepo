/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

import { useTokenDetailActions } from './actions';
import {
  ProviderJotaiContextMarketV2,
  tokenDetailAtom,
  tokenDetailLoadingAtom,
  tokenDetailPreviewAtom,
} from './atoms';
import { useMarketAssetTokenDetailAction } from './marketAssetDetail';

const mockFetchMarketAssetDetail: jest.MockedFunction<
  (params: {
    assetId: string;
    variantId?: string;
    currency?: string;
  }) => Promise<IMarketAssetDetailData>
> = jest.fn();
const mockFetchMarketTokenDetailByTokenAddress: jest.MockedFunction<
  (tokenAddress: string, networkId: string) => Promise<unknown>
> = jest.fn();
const mockFetchTokenInfoOnly: jest.MockedFunction<
  (params: {
    networkId: string;
    tokenAddress: string;
  }) => Promise<{ info?: { decimals?: number } } | undefined>
> = jest.fn();
const mockLogError = jest.fn();

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: (...args: unknown[]) => {
          mockLogError(...args);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetDetail: (
        ...args: Parameters<typeof mockFetchMarketAssetDetail>
      ) => mockFetchMarketAssetDetail(...args),
    },
    serviceMarketV2: {
      fetchMarketTokenDetailByTokenAddress: (
        ...args: Parameters<typeof mockFetchMarketTokenDetailByTokenAddress>
      ) => mockFetchMarketTokenDetailByTokenAddress(...args),
      getMarketWatchListV2: jest.fn(async () => ({ data: [] })),
    },
    serviceToken: {
      fetchTokenInfoOnly: (
        ...args: Parameters<typeof mockFetchTokenInfoOnly>
      ) => mockFetchTokenInfoOnly(...args),
    },
  },
}));

const dogeAssetDetail: IMarketAssetDetailData = {
  asset: {
    assetId: 'doge',
    name: 'Dogecoin',
    symbol: 'DOGE',
    logoUrl: 'https://example.com/doge.png',
  },
  variants: [],
  selectedVariant: {
    variantId: 'doge-doge--0-1',
    networkId: 'doge--0',
    tokenAddress: '',
    networkName: 'Dogecoin',
    networkSymbol: 'DOGE',
    networkLogoUrl: 'https://example.com/doge-network.png',
    isNative: true,
    isDefault: true,
  },
  market: {
    price: '0.25',
    priceChange24h: '0.01',
    priceChange24hPercent: '4.2',
    marketCap: '36000000000',
    marketCapRank: 8,
    volume24h: '1200000000',
    circulatingSupply: '145000000000',
    fdv: '36000000000',
    totalSupply: '145000000000',
    maxSupply: '',
  },
  performance: {
    priceChange7dPercent: '5',
    price7dAgo: '0.23',
    priceChange30dPercent: '6',
    price30dAgo: '0.22',
    priceChange3mPercent: '7',
    price3mAgo: '0.21',
    priceChange1yPercent: '8',
    price1yAgo: '0.2',
    allTimeHighChangePercent: '-60',
    allTimeHighPrice: '0.73',
  },
};

function createWrapper() {
  const store = createStore();

  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextMarketV2 store={store}>
        {children}
      </ProviderJotaiContextMarketV2>
    );
  }

  return { store, Wrapper };
}

describe('marketV2 asset token detail actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_788_332_400_000);
    mockFetchMarketAssetDetail.mockResolvedValue(dogeAssetDetail);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads DOGE through the asset detail API without calling token detail', async () => {
    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(
      () => {
        const actions = useTokenDetailActions().current;
        const fetchAssetTokenDetail = useMarketAssetTokenDetailAction();
        return { ...actions, fetchAssetTokenDetail };
      },
      {
        wrapper: Wrapper,
      },
    );

    act(() => {
      result.current.prepareTokenDetailPreview({
        address: '',
        networkId: 'doge--0',
        isNative: true,
        name: 'Dogecoin',
        symbol: 'DOGE',
        decimals: 8,
        selectedAt: 1_788_332_399_000,
      });
    });

    await act(async () => {
      await result.current.fetchAssetTokenDetail({
        assetId: 'doge',
        variantId: 'doge-doge--0-1',
        tokenAddress: '',
        networkId: 'doge--0',
      });
    });

    expect(mockFetchMarketAssetDetail.mock.calls).toEqual([
      [
        {
          assetId: 'doge',
          variantId: 'doge-doge--0-1',
          currency: 'usd',
        },
      ],
    ]);
    expect(mockFetchMarketTokenDetailByTokenAddress).not.toHaveBeenCalled();
    expect(mockFetchTokenInfoOnly).not.toHaveBeenCalled();
    expect(store.get(tokenDetailPreviewAtom())).toBeUndefined();
    expect(store.get(tokenDetailAtom())).toMatchObject({
      address: '',
      networkId: 'doge--0',
      isNative: true,
      name: 'Dogecoin',
      symbol: 'DOGE',
      decimals: 8,
      price: '0.25',
      lastUpdated: 1_788_332_400_000,
    });
  });

  it('uses local network decimals for a preview-less native asset', async () => {
    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(
      () => {
        const actions = useTokenDetailActions().current;
        const fetchAssetTokenDetail = useMarketAssetTokenDetailAction();
        return { ...actions, fetchAssetTokenDetail };
      },
      {
        wrapper: Wrapper,
      },
    );
    mockFetchTokenInfoOnly.mockResolvedValue(undefined);

    act(() => {
      result.current.setTokenAddress('');
      result.current.setNetworkId('doge--0');
    });

    await act(async () => {
      await result.current.fetchAssetTokenDetail({
        assetId: 'doge',
        variantId: 'doge-doge--0-1',
        tokenAddress: '',
        networkId: 'doge--0',
      });
      await result.current.fetchAssetTokenDetail({
        assetId: 'doge',
        variantId: 'doge-doge--0-1',
        tokenAddress: '',
        networkId: 'doge--0',
      });
    });

    expect(mockFetchTokenInfoOnly).not.toHaveBeenCalled();
    expect(store.get(tokenDetailAtom())).toMatchObject({
      address: '',
      decimals: 8,
      networkId: 'doge--0',
      decimalsResolved: true,
      price: '0.25',
    });
    expect(store.get(tokenDetailPreviewAtom())).toBeUndefined();
    expect(store.get(tokenDetailLoadingAtom())).toBe(false);
  });

  it('preserves the matching preview when the initial Asset API request fails', async () => {
    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(
      () => {
        const actions = useTokenDetailActions().current;
        const fetchAssetTokenDetail = useMarketAssetTokenDetailAction();
        return { ...actions, fetchAssetTokenDetail };
      },
      {
        wrapper: Wrapper,
      },
    );
    mockFetchMarketAssetDetail.mockRejectedValue(
      new Error('Asset API unavailable'),
    );

    act(() => {
      result.current.prepareTokenDetailPreview({
        address: '',
        networkId: 'doge--0',
        isNative: true,
        name: 'Dogecoin',
        symbol: 'DOGE',
        decimals: 8,
        selectedAt: 1_788_332_399_000,
      });
    });

    await act(async () => {
      await expect(
        result.current.fetchAssetTokenDetail({
          assetId: 'doge',
          variantId: 'doge-doge--0-1',
          tokenAddress: '',
          networkId: 'doge--0',
        }),
      ).rejects.toThrow('Asset API unavailable');
    });

    expect(store.get(tokenDetailPreviewAtom())).toMatchObject({
      networkId: 'doge--0',
      symbol: 'DOGE',
    });
    expect(store.get(tokenDetailAtom())).toBeUndefined();
    expect(store.get(tokenDetailLoadingAtom())).toBe(false);
  });

  it('preserves the last successful asset detail when polling fails', async () => {
    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(
      () => {
        const actions = useTokenDetailActions().current;
        const fetchAssetTokenDetail = useMarketAssetTokenDetailAction();
        return { ...actions, fetchAssetTokenDetail };
      },
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.setTokenAddress('');
      result.current.setNetworkId('doge--0');
    });
    await act(async () => {
      await result.current.fetchAssetTokenDetail({
        assetId: 'doge',
        variantId: 'doge-doge--0-1',
        tokenAddress: '',
        networkId: 'doge--0',
      });
    });
    const loadedDetail = store.get(tokenDetailAtom());
    mockFetchMarketAssetDetail.mockRejectedValueOnce(new Error('poll failed'));

    await act(async () => {
      await expect(
        result.current.fetchAssetTokenDetail({
          assetId: 'doge',
          variantId: 'doge-doge--0-1',
          tokenAddress: '',
          networkId: 'doge--0',
        }),
      ).rejects.toThrow('poll failed');
    });

    expect(store.get(tokenDetailAtom())).toBe(loadedDetail);
    expect(store.get(tokenDetailLoadingAtom())).toBe(false);
  });

  it('drops an Asset response after the same token identity changes owner', async () => {
    const assetDetailDeferred = createDeferred<IMarketAssetDetailData>();
    mockFetchMarketAssetDetail.mockReturnValueOnce(assetDetailDeferred.promise);
    mockFetchMarketTokenDetailByTokenAddress.mockResolvedValueOnce({
      data: {
        token: {
          address: '',
          decimals: 8,
          logoUrl: '',
          name: 'Dogecoin token detail',
          price: '0.4',
          symbol: 'DOGE',
        },
      },
    });
    const { store, Wrapper } = createWrapper();
    const { result } = renderHook(
      () => {
        const actions = useTokenDetailActions().current;
        const fetchAssetTokenDetail = useMarketAssetTokenDetailAction();
        return { ...actions, fetchAssetTokenDetail };
      },
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.setTokenAddress('');
      result.current.setNetworkId('doge--0');
    });
    let assetRequest: Promise<IMarketAssetDetailData> | undefined;
    await act(async () => {
      assetRequest = result.current.fetchAssetTokenDetail({
        assetId: 'doge',
        variantId: 'doge-doge--0-1',
        tokenAddress: '',
        networkId: 'doge--0',
      });
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.fetchTokenDetail('', 'doge--0');
    });
    await act(async () => {
      assetDetailDeferred.resolve(dogeAssetDetail);
      await expect(assetRequest).rejects.toThrow(
        'Stale market asset detail request',
      );
    });

    expect(store.get(tokenDetailAtom())).toMatchObject({
      name: 'Dogecoin token detail',
      price: '0.4',
    });
    expect(store.get(tokenDetailLoadingAtom())).toBe(false);
  });

  it('does not reuse a fresh chart price from another network', async () => {
    const { store, Wrapper } = createWrapper();
    mockFetchMarketTokenDetailByTokenAddress.mockResolvedValueOnce({
      data: {
        token: {
          address: '',
          decimals: 8,
          name: 'Dogecoin',
          price: '0.3',
          symbol: 'DOGE',
        },
      },
    });
    const { result } = renderHook(() => useTokenDetailActions().current, {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.setTokenDetail({
        address: '',
        chartPriceUpdatedAt: 1_788_332_400_000,
        decimals: 8,
        logoUrl: '',
        name: 'Bitcoin',
        networkId: 'btc--0',
        price: '70_000',
        symbol: 'BTC',
      });
      result.current.setTokenAddress('');
      result.current.setNetworkId('doge--0');
    });
    await act(async () => {
      await result.current.fetchTokenDetail('', 'doge--0');
    });

    expect(store.get(tokenDetailAtom())).toMatchObject({
      networkId: 'doge--0',
      price: '0.3',
      symbol: 'DOGE',
    });
  });
});
