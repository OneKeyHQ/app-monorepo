/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useAutoRefreshTokenDetail } from './useAutoRefreshTokenDetail';

const mockTokenDetailActions = {
  setTokenDetail: jest.fn(),
  setTokenDetailWebsocket: jest.fn(),
  setPerpsInfo: jest.fn(),
  setTokenAddress: jest.fn(),
  setNetworkId: jest.fn(),
  setTokenDetailCurrencyId: jest.fn(),
  setIsNative: jest.fn(),
  fetchTokenDetail: jest.fn().mockResolvedValue(undefined),
};
const mockSetCurrentTokenLiveData = jest.fn();
let mockCurrencyInfo = { id: 'usd' };
let mockTokenDetailState = {
  tokenDetail: {
    address: '0xtoken-b',
    price: '2',
  },
  tokenAddress: '0xtoken-b',
  networkId: 'evm--2',
  isNative: false,
};
let mockCapturedRequest: (() => Promise<void>) | undefined;

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => mockCurrencyInfo,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (request: () => Promise<void>) => {
    mockCapturedRequest = request;
    return {
      result: undefined,
      isLoading: false,
      run: jest.fn(),
    };
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({ current: mockTokenDetailActions }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail',
  () => ({
    useTokenDetail: () => mockTokenDetailState,
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketCurrentTokenLiveDataAtom: () => [
    undefined,
    mockSetCurrentTokenLiveData,
  ],
}));

const tokenAParams = {
  tokenAddress: '0xtoken-a',
  networkId: 'evm--1',
  isNative: false,
};

describe('useAutoRefreshTokenDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrencyInfo = { id: 'usd' };
    mockTokenDetailState = {
      tokenDetail: {
        address: '0xtoken-b',
        price: '2',
      },
      tokenAddress: '0xtoken-b',
      networkId: 'evm--2',
      isNative: false,
    };
    mockCapturedRequest = undefined;
  });

  it('restores a retained route identity before fetching after focus returns', async () => {
    const { rerender } = renderHook(
      ({ enabled }) =>
        useAutoRefreshTokenDetail({
          ...tokenAParams,
          enabled,
        }),
      { initialProps: { enabled: false } },
    );

    expect(mockTokenDetailActions.setTokenAddress).not.toHaveBeenCalled();
    expect(mockTokenDetailActions.setTokenDetail).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(mockTokenDetailActions.setTokenDetail).toHaveBeenCalledWith(
      undefined,
    );
    expect(mockTokenDetailActions.setTokenDetailWebsocket).toHaveBeenCalledWith(
      undefined,
    );
    expect(mockTokenDetailActions.setPerpsInfo).toHaveBeenCalledWith(undefined);
    expect(mockTokenDetailActions.setTokenAddress).toHaveBeenCalledWith(
      tokenAParams.tokenAddress,
    );
    expect(mockTokenDetailActions.setNetworkId).toHaveBeenCalledWith(
      tokenAParams.networkId,
    );
    expect(
      mockTokenDetailActions.setTokenDetailCurrencyId,
    ).toHaveBeenCalledWith('usd');
    expect(mockTokenDetailActions.setIsNative).toHaveBeenCalledWith(false);

    await mockCapturedRequest?.();

    expect(mockTokenDetailActions.fetchTokenDetail).toHaveBeenCalledWith(
      tokenAParams.tokenAddress,
      tokenAParams.networkId,
      'usd',
    );
    expect(
      mockTokenDetailActions.setTokenAddress.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockTokenDetailActions.fetchTokenDetail.mock.invocationCallOrder[0],
    );
  });

  it('does not let an unfocused route write shared Market detail state', () => {
    const { rerender, unmount } = renderHook(
      ({ enabled }) =>
        useAutoRefreshTokenDetail({
          ...tokenAParams,
          enabled,
        }),
      { initialProps: { enabled: false } },
    );

    mockTokenDetailState = {
      tokenDetail: {
        address: '0xtoken-c',
        price: '3',
      },
      tokenAddress: '0xtoken-c',
      networkId: 'evm--3',
      isNative: false,
    };
    rerender({ enabled: false });
    unmount();

    expect(mockTokenDetailActions.setTokenDetail).not.toHaveBeenCalled();
    expect(mockTokenDetailActions.setTokenAddress).not.toHaveBeenCalled();
    expect(mockSetCurrentTokenLiveData).not.toHaveBeenCalled();
  });

  it('does not overwrite a pre-navigation token while route params are unchanged', () => {
    mockTokenDetailState = {
      tokenDetail: {
        address: tokenAParams.tokenAddress,
        price: '1',
      },
      tokenAddress: tokenAParams.tokenAddress,
      networkId: tokenAParams.networkId,
      isNative: false,
    };
    const { rerender } = renderHook(() =>
      useAutoRefreshTokenDetail({
        ...tokenAParams,
        enabled: true,
      }),
    );
    jest.clearAllMocks();

    mockTokenDetailState = {
      tokenDetail: {
        address: '0xtoken-b',
        price: '2',
      },
      tokenAddress: '0xtoken-b',
      networkId: 'evm--2',
      isNative: false,
    };
    rerender();

    expect(mockTokenDetailActions.setTokenDetail).not.toHaveBeenCalled();
    expect(mockTokenDetailActions.setTokenAddress).not.toHaveBeenCalled();
    expect(mockTokenDetailActions.setNetworkId).not.toHaveBeenCalled();
  });
});
