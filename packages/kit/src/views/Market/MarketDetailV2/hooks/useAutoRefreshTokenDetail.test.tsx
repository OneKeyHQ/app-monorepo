/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';

import { useAutoRefreshTokenDetail } from './useAutoRefreshTokenDetail';

const mockFetchAssetTokenDetail = jest.fn();
const mockFetchTokenDetail = jest.fn();
const mockSetCurrentTokenLiveData = jest.fn();
const mockSetIsNative = jest.fn();
const mockSetNetworkId = jest.fn();
const mockSetPerpsInfo = jest.fn();
const mockSetTokenAddress = jest.fn();
const mockSetTokenDetail = jest.fn();
const mockSetTokenDetailLoading = jest.fn();
const mockSetTokenDetailWebsocket = jest.fn();
let promiseFactory: (() => Promise<unknown>) | undefined;
let promiseOptions: Record<string, unknown> | undefined;
let promiseResult: unknown;
let mockCurrencyId = 'usd';

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: mockCurrencyId }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    factory: () => Promise<unknown>,
    _deps: unknown[],
    options: Record<string, unknown>,
  ) => {
    promiseFactory = factory;
    promiseOptions = options;
    return { result: promiseResult, isLoading: false };
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({
    current: {
      fetchTokenDetail: mockFetchTokenDetail,
      setIsNative: mockSetIsNative,
      setNetworkId: mockSetNetworkId,
      setPerpsInfo: mockSetPerpsInfo,
      setTokenAddress: mockSetTokenAddress,
      setTokenDetail: mockSetTokenDetail,
      setTokenDetailLoading: mockSetTokenDetailLoading,
      setTokenDetailWebsocket: mockSetTokenDetailWebsocket,
    },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketAssetDetail',
  () => ({
    useMarketAssetTokenDetailAction: () => mockFetchAssetTokenDetail,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail',
  () => ({
    useTokenDetail: () => ({
      tokenDetail: undefined,
      networkId: '',
      isLoading: false,
    }),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketCurrentTokenLiveDataAtom: () => [
    undefined,
    mockSetCurrentTokenLiveData,
  ],
}));

describe('useAutoRefreshTokenDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    promiseFactory = undefined;
    promiseOptions = undefined;
    promiseResult = undefined;
    mockCurrencyId = 'usd';
  });

  it('uses the asset detail owner for Top Coins routes', async () => {
    mockFetchAssetTokenDetail.mockResolvedValue({ asset: { assetId: 'doge' } });

    renderHook(() =>
      useAutoRefreshTokenDetail({
        tokenAddress: '',
        networkId: 'doge--0',
        isNative: true,
        marketTokenId: 'doge',
        marketVariantId: 'doge-doge--0-1',
        marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
      }),
    );

    await promiseFactory?.();

    expect(mockFetchAssetTokenDetail).toHaveBeenCalledWith({
      assetId: 'doge',
      variantId: 'doge-doge--0-1',
      tokenAddress: '',
      networkId: 'doge--0',
    });
    expect(mockFetchTokenDetail).not.toHaveBeenCalled();
    expect(promiseOptions).toMatchObject({
      undefinedResultIfError: true,
    });
    expect(promiseOptions).not.toHaveProperty('watchLoading');
  });

  it('keeps ordinary market tokens on the token detail owner', async () => {
    renderHook(() =>
      useAutoRefreshTokenDetail({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        isNative: false,
      }),
    );

    await promiseFactory?.();

    expect(mockFetchTokenDetail).toHaveBeenCalledWith('0xabc', 'evm--1');
    expect(mockFetchAssetTokenDetail).not.toHaveBeenCalled();
  });

  it('does not forward the display currency to the USD Asset detail owner', async () => {
    mockCurrencyId = 'cny';
    mockFetchAssetTokenDetail.mockResolvedValue({ asset: { assetId: 'doge' } });

    renderHook(() =>
      useAutoRefreshTokenDetail({
        tokenAddress: '',
        networkId: 'doge--0',
        isNative: true,
        marketTokenId: 'doge',
        marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
      }),
    );

    await promiseFactory?.();

    expect(mockFetchAssetTokenDetail).toHaveBeenCalledWith({
      assetId: 'doge',
      variantId: undefined,
      tokenAddress: '',
      networkId: 'doge--0',
    });
  });

  it('does not expose an asset result from a previous route', () => {
    promiseResult = {
      requestKey: 'asset:btc::btc--0:',
      assetDetail: { asset: { assetId: 'btc' } },
    };

    const { result } = renderHook(() =>
      useAutoRefreshTokenDetail({
        tokenAddress: '',
        networkId: 'doge--0',
        isNative: true,
        marketTokenId: 'doge',
        marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
      }),
    );

    expect(result.current.marketAssetDetail).toBeUndefined();
  });

  it('keeps the last successful Asset overview when a polling tick fails', async () => {
    const assetDetail = { asset: { assetId: 'doge' } };
    mockFetchAssetTokenDetail
      .mockResolvedValueOnce(assetDetail)
      .mockRejectedValueOnce(new Error('poll failed'));

    renderHook(() =>
      useAutoRefreshTokenDetail({
        tokenAddress: '',
        networkId: 'doge--0',
        isNative: true,
        marketTokenId: 'doge',
        marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
      }),
    );

    await expect(promiseFactory?.()).resolves.toEqual({
      requestKey: 'asset:doge::doge--0:',
      assetDetail,
    });
    await expect(promiseFactory?.()).resolves.toEqual({
      requestKey: 'asset:doge::doge--0:',
      assetDetail,
    });
  });

  it('does not let a stale Asset response replace the current overview cache', async () => {
    const dogeAssetDetail = { asset: { assetId: 'doge' } };
    const btcAssetDetail = { asset: { assetId: 'btc' } };
    let resolveDogeRequest:
      | ((assetDetail: typeof dogeAssetDetail) => void)
      | undefined;
    const dogeRequest = new Promise<typeof dogeAssetDetail>((resolve) => {
      resolveDogeRequest = resolve;
    });
    mockFetchAssetTokenDetail
      .mockReturnValueOnce(dogeRequest)
      .mockResolvedValueOnce(btcAssetDetail)
      .mockRejectedValueOnce(new Error('btc poll failed'));

    const { rerender } = renderHook(
      ({ assetId, networkId }: { assetId: string; networkId: string }) =>
        useAutoRefreshTokenDetail({
          tokenAddress: '',
          networkId,
          isNative: true,
          marketTokenId: assetId,
          marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
        }),
      {
        initialProps: {
          assetId: 'doge',
          networkId: 'doge--0',
        },
      },
    );
    const fetchDoge = promiseFactory;
    const pendingDogeResult = fetchDoge?.();

    rerender({ assetId: 'btc', networkId: 'btc--0' });
    const fetchBtc = promiseFactory;

    await expect(fetchBtc?.()).resolves.toEqual({
      requestKey: 'asset:btc::btc--0:',
      assetDetail: btcAssetDetail,
    });

    resolveDogeRequest?.(dogeAssetDetail);
    await expect(pendingDogeResult).resolves.toBeUndefined();

    await expect(fetchBtc?.()).resolves.toEqual({
      requestKey: 'asset:btc::btc--0:',
      assetDetail: btcAssetDetail,
    });
  });

  it('clears loading when market fetching is skipped', () => {
    renderHook(() =>
      useAutoRefreshTokenDetail({
        tokenAddress: '',
        networkId: 'doge--0',
        isNative: true,
        marketTokenId: 'doge',
        marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
        skipMarketDataFetch: true,
      }),
    );

    expect(mockSetTokenDetailLoading).toHaveBeenCalledWith(false);
  });
});
