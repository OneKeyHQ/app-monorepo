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
const mockSetTokenDetailWebsocket = jest.fn();
let promiseFactory: (() => Promise<unknown>) | undefined;

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: 'usd' }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (factory: () => Promise<unknown>) => {
    promiseFactory = factory;
    return { result: undefined, isLoading: false };
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({
    current: {
      fetchAssetTokenDetail: mockFetchAssetTokenDetail,
      fetchTokenDetail: mockFetchTokenDetail,
      setIsNative: mockSetIsNative,
      setNetworkId: mockSetNetworkId,
      setPerpsInfo: mockSetPerpsInfo,
      setTokenAddress: mockSetTokenAddress,
      setTokenDetail: mockSetTokenDetail,
      setTokenDetailWebsocket: mockSetTokenDetailWebsocket,
    },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail',
  () => ({
    useTokenDetail: () => ({ tokenDetail: undefined, networkId: '' }),
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
});
