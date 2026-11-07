/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import {
  useAutoRefreshTokenDetail,
  useSyncMarketCurrentTokenLiveData,
} from './useAutoRefreshTokenDetail';

const mockFetchAssetTokenDetail = jest.fn();
const mockFetchTokenDetail = jest.fn();
const mockSetCurrentTokenLiveData = jest.fn();
const mockSetIsNative = jest.fn();
let mockStoreTokenAddress = '';
let mockStoreNetworkId = '';
let mockStoreTokenDetailIdentity: string | undefined;
const mockSetNetworkId = jest.fn((value: string) => {
  mockStoreNetworkId = value;
});
const mockSetPerpsInfo = jest.fn();
const mockSetTokenAddress = jest.fn((value: string) => {
  mockStoreTokenAddress = value;
});
const mockSetTokenDetail = jest.fn();
const mockSetTokenDetailLoading = jest.fn();
const mockSetTokenDetailWebsocket = jest.fn();
const mockSeedTokenDetailFromCache = jest.fn();
const mockTokenDetailActions = {
  fetchTokenDetail: mockFetchTokenDetail,
  setIsNative: mockSetIsNative,
  setNetworkId: mockSetNetworkId,
  setPerpsInfo: mockSetPerpsInfo,
  setTokenAddress: mockSetTokenAddress,
  setTokenDetail: mockSetTokenDetail,
  setTokenDetailLoading: mockSetTokenDetailLoading,
  setTokenDetailWebsocket: mockSetTokenDetailWebsocket,
  seedTokenDetailFromCache: mockSeedTokenDetailFromCache,
};
let promiseFactory: (() => Promise<unknown>) | undefined;
let promiseDeps: unknown[] | undefined;
let promiseOptions: Record<string, unknown> | undefined;
let promiseResult: unknown;
let mockCurrencyId = 'usd';
let mockLocale = 'en-US';
let mockTokenDetail: IMarketTokenDetail | undefined;
let mockNetworkId = '';
let mockIsFocused = true;
let mockIsInternetReachable = true;

jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise')
    .useDeferredPromise,
  useNetInfo: () => ({ isRawInternetReachable: mockIsInternetReachable }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockIsFocused,
  useRouteIsFocusedWhenEnabled: ({ enabled }: { enabled: boolean }) =>
    !enabled || mockIsFocused,
}));

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: mockCurrencyId }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => mockLocale,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(
    (
      factory: () => Promise<unknown>,
      deps: unknown[],
      options: Record<string, unknown>,
    ) => {
      promiseFactory = factory;
      promiseDeps = deps;
      promiseOptions = options;
      return {
        result: promiseResult,
        isLoading: false,
        run: async () => {
          await promiseFactory?.();
        },
      };
    },
  ),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useNetworkIdAtom: () => [mockStoreNetworkId],
  useTokenAddressAtom: () => [mockStoreTokenAddress],
  useTokenDetailLoadingAtom: () => [false],
  useTokenDetailIdentityAtom: () => [mockStoreTokenDetailIdentity],
  useTokenDetailActions: () => ({
    current: mockTokenDetailActions,
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
      tokenDetail: mockTokenDetail,
      networkId: mockNetworkId,
      isLoading: false,
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveMarketAssetRouteIdentity',
  () => ({
    resolveMarketAssetRouteIdentity: jest.fn().mockResolvedValue(undefined),
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
    promiseDeps = undefined;
    promiseOptions = undefined;
    promiseResult = undefined;
    mockCurrencyId = 'usd';
    mockLocale = 'en-US';
    mockTokenDetail = undefined;
    mockNetworkId = '';
    mockStoreTokenAddress = '';
    mockStoreNetworkId = '';
    mockStoreTokenDetailIdentity = undefined;
  });

  it('mirrors live prices in a leaf and clears the mirror when its token disappears', () => {
    mockNetworkId = 'evm--1';
    mockTokenDetail = {
      address: '0xabc',
      networkId: mockNetworkId,
      name: 'Token',
      symbol: 'TEST',
      decimals: 18,
      logoUrl: '',
      price: '1',
      buy24hCount: '2',
      sell24hCount: '3',
    };
    const { rerender, unmount } = renderHook(() =>
      useSyncMarketCurrentTokenLiveData(),
    );
    expect(mockSetCurrentTokenLiveData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        networkId: 'evm--1',
        address: '0xabc',
        price: 1,
        walletInfo: { buy: 2, sell: 3 },
      }),
    );
    mockSetCurrentTokenLiveData.mockClear();
    mockTokenDetail = { ...mockTokenDetail, price: '2' };
    rerender();
    expect(mockSetCurrentTokenLiveData).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentTokenLiveData).toHaveBeenLastCalledWith(
      expect.objectContaining({ price: 2 }),
    );
    mockTokenDetail = undefined;
    rerender();
    expect(mockSetCurrentTokenLiveData).toHaveBeenLastCalledWith(undefined);
    mockSetCurrentTokenLiveData.mockClear();
    unmount();
    expect(mockSetCurrentTokenLiveData).toHaveBeenCalledWith(undefined);
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

    await act(async () => {
      await promiseFactory?.();
    });

    expect(mockFetchAssetTokenDetail).toHaveBeenCalledWith({
      assetId: 'doge',
      variantId: 'doge-doge--0-1',
      tokenAddress: '',
      networkId: 'doge--0',
      isCurrentRequest: expect.any(Function),
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

    await act(async () => {
      await promiseFactory?.();
    });

    // The response is currency-converted and localized, so both scope the
    // cached copy a revisit starts from.
    const swrKey = 'marketTokenDetail:v1:evm--1:0xabc:usd:en-us';
    expect(mockSeedTokenDetailFromCache).toHaveBeenCalledWith({
      tokenAddress: '0xabc',
      networkId: 'evm--1',
      swrKey,
    });
    expect(mockFetchTokenDetail).toHaveBeenCalledWith('0xabc', 'evm--1', {
      swrKey,
    });
    expect(mockFetchAssetTokenDetail).not.toHaveBeenCalled();
  });

  it('clears identity-bound detail state when the requested token changes', () => {
    const { rerender } = renderHook(
      ({ tokenAddress }) =>
        useAutoRefreshTokenDetail({
          tokenAddress,
          networkId: 'evm--1',
          isNative: false,
        }),
      { initialProps: { tokenAddress: '0xabc' } },
    );

    rerender({ tokenAddress: '0xdef' });

    expect(mockSetTokenDetail).toHaveBeenCalledWith(undefined);
    expect(mockSetTokenDetailWebsocket).toHaveBeenCalledWith(undefined);
    expect(mockSetPerpsInfo).toHaveBeenCalledWith(undefined);
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

    await act(async () => {
      await promiseFactory?.();
    });

    expect(mockFetchAssetTokenDetail).toHaveBeenCalledWith({
      assetId: 'doge',
      variantId: undefined,
      tokenAddress: '',
      networkId: 'doge--0',
      isCurrentRequest: expect.any(Function),
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

    await act(async () => {
      await expect(promiseFactory?.()).resolves.toEqual({
        requestKey: 'asset:doge::doge--0:',
        assetDetail,
      });
    });
    await act(async () => {
      await expect(promiseFactory?.()).resolves.toEqual({
        requestKey: 'asset:doge::doge--0:',
        assetDetail,
      });
    });
  });

  it('shows the Asset error when reselecting a cached asset fails after its detail was cleared', async () => {
    const assetDetail = {
      asset: { assetId: 'doge' },
      selectedVariant: {
        variantId: 'doge-evm--1-0xabc',
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        isNative: false,
      },
    };
    mockFetchAssetTokenDetail.mockResolvedValueOnce(assetDetail);
    const { result, rerender } = renderHook(
      ({ assetId }: { assetId: string }) =>
        useAutoRefreshTokenDetail({
          tokenAddress: '',
          networkId: '',
          isNative: false,
          marketTokenId: assetId,
          marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
        }),
      { initialProps: { assetId: 'doge' } },
    );
    await act(async () => {
      await promiseFactory?.();
    });
    expect(result.current.hasAssetError).toBe(false);
    // The asset action wrote the resolved identity and detail into the store.
    mockStoreTokenAddress = '0xabc';
    mockStoreNetworkId = 'evm--1';
    mockStoreTokenDetailIdentity = 'evm--1|0xabc';

    // Switch to another asset while its request stays pending: the switch
    // clears the shared detail and no new identity has been written yet.
    mockFetchAssetTokenDetail.mockReturnValueOnce(new Promise(() => {}));
    rerender({ assetId: 'btc' });
    act(() => {
      void promiseFactory?.();
    });
    mockStoreTokenAddress = '';
    mockStoreNetworkId = '';
    mockStoreTokenDetailIdentity = undefined;

    // Selecting the cached asset again clears its detail too; its request fails.
    mockFetchAssetTokenDetail.mockRejectedValueOnce(new Error('offline'));
    rerender({ assetId: 'doge' });
    await act(async () => {
      await promiseFactory?.().catch(() => undefined);
    });

    // The overview cache cannot restore the header/quote detail, so surface
    // the retry state instead of silently keeping an empty detail.
    expect(result.current.hasAssetError).toBe(true);
    expect(result.current.marketAssetDetail).toBeUndefined();
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

    await act(async () => {
      await expect(fetchBtc?.()).resolves.toEqual({
        requestKey: 'asset:btc::btc--0:',
        assetDetail: btcAssetDetail,
      });
    });

    resolveDogeRequest?.(dogeAssetDetail);
    await act(async () => {
      await expect(pendingDogeResult).resolves.toBeUndefined();
    });

    await act(async () => {
      await expect(fetchBtc?.()).resolves.toEqual({
        requestKey: 'asset:btc::btc--0:',
        assetDetail: btcAssetDetail,
      });
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

  it('drops an in-flight Asset result when market fetching becomes skipped', async () => {
    const assetDetail = { asset: { assetId: 'doge' } };
    let resolveRequest: ((value: typeof assetDetail) => void) | undefined;
    mockFetchAssetTokenDetail.mockReturnValueOnce(
      new Promise<typeof assetDetail>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { rerender } = renderHook(
      ({ skipMarketDataFetch }: { skipMarketDataFetch: boolean }) =>
        useAutoRefreshTokenDetail({
          tokenAddress: '',
          networkId: 'doge--0',
          isNative: true,
          marketTokenId: 'doge',
          marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
          skipMarketDataFetch,
        }),
      { initialProps: { skipMarketDataFetch: false } },
    );
    const pendingResult = promiseFactory?.();

    rerender({ skipMarketDataFetch: true });
    resolveRequest?.(assetDetail);

    await act(async () => {
      await expect(pendingResult).resolves.toBeUndefined();
    });
    expect(mockSetTokenDetailLoading).toHaveBeenCalledWith(false);
  });

  it('keeps the resolved Asset identity when only the display currency changes', async () => {
    const assetDetail = {
      asset: { assetId: 'doge' },
      selectedVariant: {
        variantId: 'doge-evm--1-0xabc',
        networkId: 'evm--1',
        tokenAddress: '0xabc',
        isNative: false,
      },
    };
    promiseResult = { requestKey: 'asset:doge:::', assetDetail };

    const { result, rerender } = renderHook(
      ({ currencyId }: { currencyId: string }) => {
        mockCurrencyId = currencyId;
        return useAutoRefreshTokenDetail({
          tokenAddress: '',
          networkId: '',
          isNative: false,
          marketTokenId: 'doge',
          marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
        });
      },
      { initialProps: { currencyId: 'usd' } },
    );

    // The detail action writes the resolved variant into the atoms.
    mockStoreTokenAddress = '0xabc';
    mockStoreNetworkId = 'evm--1';
    mockStoreTokenDetailIdentity = 'evm--1|0xabc';
    mockFetchAssetTokenDetail.mockResolvedValue(assetDetail);
    await act(async () => {
      await promiseFactory?.();
    });

    expect(result.current.resolvedMarketAssetIdentity).toMatchObject({
      marketTokenId: 'doge',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);

    mockSetTokenDetail.mockClear();
    rerender({ currencyId: 'cny' });

    // The display currency only refreshes data; it must not invalidate the
    // identity the route already resolved or clear the shared detail.
    expect(promiseDeps).toEqual(expect.arrayContaining(['cny']));
    expect(mockSetTokenDetail).not.toHaveBeenCalledWith(undefined);
    expect(result.current.resolvedMarketAssetIdentity).toMatchObject({
      marketTokenId: 'doge',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);

    // A failed refresh after the currency switch must keep the previous content
    // instead of collapsing the page into the Asset error state.
    mockFetchAssetTokenDetail.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await promiseFactory?.().catch(() => undefined);
    });
    expect(result.current.hasAssetError).toBe(false);
    expect(result.current.resolvedMarketAssetIdentity).toMatchObject({
      marketTokenId: 'doge',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);
  });

  it('refreshes localized Asset content when the locale changes', async () => {
    promiseResult = {
      requestKey: 'asset:doge:::',
      assetDetail: {
        asset: { assetId: 'doge' },
        selectedVariant: {
          variantId: 'doge-evm--1-0xabc',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          isNative: false,
        },
      },
    };
    mockStoreTokenAddress = '0xabc';
    mockStoreNetworkId = 'evm--1';
    mockFetchAssetTokenDetail.mockResolvedValue({ asset: { assetId: 'doge' } });

    const { result, rerender } = renderHook(
      ({ locale }: { locale: string }) => {
        mockLocale = locale;
        return useAutoRefreshTokenDetail({
          tokenAddress: '',
          networkId: '',
          isNative: false,
          marketTokenId: 'doge',
          marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
        });
      },
      { initialProps: { locale: 'en-US' } },
    );
    await act(async () => {
      await promiseFactory?.();
    });
    expect(mockFetchAssetTokenDetail).toHaveBeenCalledTimes(1);

    // Localized fields come back with the response, so a locale change has to
    // re-run the request without dropping the resolved identity.
    await act(async () => {
      rerender({ locale: 'ja-JP' });
    });
    expect(mockFetchAssetTokenDetail).toHaveBeenCalledTimes(2);
    expect(result.current.resolvedMarketAssetIdentity).toBeDefined();
  });
});

describe('initial detail layout readiness', () => {
  const input = { networkId: 'evm--1', tokenAddress: '0xabc', isNative: false };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchTokenDetail.mockReset();
    promiseResult = undefined;
    mockCurrencyId = 'usd';
  });

  it('waits before the first request and stays ready during another request', async () => {
    const { result } = renderHook(() => useAutoRefreshTokenDetail(input));
    expect(result.current.isInitialTokenDetailPending).toBe(true);
    await act(async () => {
      await promiseFactory?.();
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);
    let finish: () => void = () => undefined;
    mockFetchTokenDetail.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const refresh = promiseFactory?.();
    expect(result.current.isInitialTokenDetailPending).toBe(false);
    await act(async () => {
      finish();
      await refresh;
    });
  });

  it('ignores completion from a previous token', async () => {
    let finish: () => void = () => undefined;
    mockFetchTokenDetail.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      (props) => useAutoRefreshTokenDetail(props),
      { initialProps: input },
    );
    const oldRequest = promiseFactory?.();
    rerender({ ...input, tokenAddress: '0xdef' });
    await act(async () => {
      finish();
      await oldRequest;
    });
    expect(result.current.isInitialTokenDetailPending).toBe(true);
    await act(async () => {
      await promiseFactory?.();
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);
  });

  it('waits again when returning to a previously settled token', async () => {
    const { result, rerender } = renderHook(
      (props) => useAutoRefreshTokenDetail(props),
      { initialProps: input },
    );
    await act(async () => {
      await promiseFactory?.();
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);
    rerender({ ...input, tokenAddress: '0xdef' });
    rerender(input);
    expect(result.current.isInitialTokenDetailPending).toBe(true);
    await act(async () => {
      await promiseFactory?.();
    });
    rerender(input);
    expect(result.current.isInitialTokenDetailPending).toBe(false);
  });

  it('waits for a fresh request when another page cleared the retained detail', async () => {
    const { result, rerender } = renderHook(
      (props: typeof input & { active?: boolean }) =>
        useAutoRefreshTokenDetail(props),
      { initialProps: { ...input, active: true } },
    );
    await act(async () => {
      await promiseFactory?.();
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);
    mockStoreTokenDetailIdentity = 'evm--1|0xabc';

    // The route loses focus; another detail page then takes over the shared
    // store and the returning route only has its address/network restored.
    rerender({ ...input, active: false });
    mockStoreTokenDetailIdentity = undefined;
    rerender({ ...input, active: true });

    // The restored identity alone must not hide the missing detail.
    expect(result.current.isInitialTokenDetailPending).toBe(true);
    await act(async () => {
      await promiseFactory?.();
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);
  });

  it('releases the initial loading boundary after failure', async () => {
    mockFetchTokenDetail.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useAutoRefreshTokenDetail(input));
    await act(async () => {
      await promiseFactory?.().catch(() => undefined);
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);
  });

  it('does not wait on a route that deliberately skips market requests', () => {
    const { result } = renderHook(() =>
      useAutoRefreshTokenDetail({ ...input, skipMarketDataFetch: true }),
    );
    expect(result.current.isInitialTokenDetailPending).toBe(false);
  });

  it('pauses a retained Desktop/Web route and waits for a fresh request on refocus', async () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useAutoRefreshTokenDetail({
          ...input,
          active,
          resumeOnEffectReconnect: true,
        }),
      { initialProps: { active: true } },
    );

    await act(async () => {
      await promiseFactory?.();
    });
    expect(result.current.isInitialTokenDetailPending).toBe(false);
    expect(mockFetchTokenDetail).toHaveBeenCalledTimes(1);
    expect(promiseOptions?.resumeOnEffectReconnect).toBe(true);
    mockStoreTokenDetailIdentity = 'evm--1|0xabc';

    mockSetTokenDetailLoading.mockClear();
    rerender({ active: false });
    expect(result.current.isInitialTokenDetailPending).toBe(false);
    expect(promiseOptions?.pollingInterval).toBe(6000);
    await act(async () => {
      await promiseFactory?.();
    });
    expect(mockFetchTokenDetail).toHaveBeenCalledTimes(1);
    expect(mockSetTokenDetailLoading).not.toHaveBeenCalled();

    rerender({ active: true });
    // Refocusing the same retained route must not flash the initial spinner.
    expect(result.current.isInitialTokenDetailPending).toBe(false);
    expect(promiseOptions?.pollingInterval).toBe(6000);
    await act(async () => {
      await promiseFactory?.();
    });
    expect(mockFetchTokenDetail).toHaveBeenCalledTimes(2);
    expect(result.current.isInitialTokenDetailPending).toBe(false);
  });
});

describe('detail metadata refresh scheduling', () => {
  const input = {
    tokenAddress: '0xabc',
    networkId: 'evm--1',
    isNative: false,
  };
  const mockUsePromiseResult = jest.mocked(usePromiseResult);
  const capturePromiseResult = mockUsePromiseResult.getMockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCurrencyId = 'usd';
    mockIsFocused = true;
    mockIsInternetReachable = true;
    mockFetchTokenDetail.mockResolvedValue(undefined);
    mockFetchAssetTokenDetail.mockResolvedValue({ asset: { assetId: 'doge' } });
    mockUsePromiseResult.mockImplementation(
      jest.requireActual<
        typeof import('@onekeyhq/kit/src/hooks/usePromiseResult')
      >('@onekeyhq/kit/src/hooks/usePromiseResult').usePromiseResult,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    if (capturePromiseResult) {
      mockUsePromiseResult.mockImplementation(capturePromiseResult);
    }
  });

  it.each([
    { name: 'token', props: input },
    {
      name: 'asset',
      props: {
        tokenAddress: '',
        networkId: 'doge--0',
        isNative: true,
        marketTokenId: 'doge',
        marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
      },
    },
  ])(
    'refreshes $name metadata across time and reconnect',
    async ({ name, props }) => {
      const fetchDetail =
        name === 'token' ? mockFetchTokenDetail : mockFetchAssetTokenDetail;
      const { result, rerender } = renderHook(() =>
        useAutoRefreshTokenDetail(props),
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(fetchDetail).toHaveBeenCalledTimes(1);
      expect(result.current.isInitialTokenDetailPending).toBe(false);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(6000);
      });
      expect(fetchDetail).toHaveBeenCalledTimes(2);

      mockIsFocused = false;
      mockIsInternetReachable = false;
      rerender();
      mockIsFocused = true;
      mockIsInternetReachable = true;
      rerender();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(fetchDetail).toHaveBeenCalledTimes(3);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(6000);
      });
      expect(fetchDetail).toHaveBeenCalledTimes(4);
    },
  );

  it('immediately fetches each new token or display currency', async () => {
    const { rerender } = renderHook(
      (props) => useAutoRefreshTokenDetail(props),
      { initialProps: input },
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockFetchTokenDetail).toHaveBeenCalledTimes(1);

    rerender({ ...input, tokenAddress: '0xdef' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetchTokenDetail).toHaveBeenCalledTimes(2);
    expect(mockFetchTokenDetail).toHaveBeenLastCalledWith(
      '0xdef',
      'evm--1',
      expect.any(Object),
    );

    mockCurrencyId = 'eur';
    rerender({ ...input, tokenAddress: '0xdef' });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockFetchTokenDetail).toHaveBeenCalledTimes(3);
  });
});
