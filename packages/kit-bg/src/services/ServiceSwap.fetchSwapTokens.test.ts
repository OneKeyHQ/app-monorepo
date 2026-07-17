import axios, { type AxiosInstance } from 'axios';

import {
  ESwapFetchCancelCause,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

describe('ServiceSwap.fetchSwapTokens', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  const showToast = jest.fn();
  const getWalletTypeHeader = jest.fn().mockResolvedValue({});

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService(get: jest.Mock) {
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: getWalletTypeHeader,
        },
        serviceApp: { showToast },
      },
    });
    jest
      .spyOn(service, 'getClient')
      .mockResolvedValue({ get } as unknown as AxiosInstance);
    return service;
  }

  const requestParams = {
    currency: 'usd',
    isAllNetworkFetchAccountTokens: true,
    networkId: 'evm--1',
  } as const;

  it('keeps the default toast-and-empty-list behavior on request errors', async () => {
    const requestError = {
      message: 'Network unavailable',
      requestId: 'request-1',
    };
    const service = createService(jest.fn().mockRejectedValue(requestError));

    await expect(service.fetchSwapTokens(requestParams)).resolves.toEqual([]);
    expect(showToast).toHaveBeenCalledWith({
      method: 'error',
      title: requestError.message,
      message: requestError.requestId,
    });
  });

  it('rejects non-cancellation request errors in strict mode', async () => {
    const requestError = {
      message: 'Network unavailable',
      requestId: 'request-2',
    };
    const service = createService(jest.fn().mockRejectedValue(requestError));

    await expect(
      service.fetchSwapTokens({ ...requestParams, throwOnError: true }),
    ).rejects.toBe(requestError);
    expect(showToast).toHaveBeenCalledWith({
      method: 'error',
      title: requestError.message,
      message: requestError.requestId,
    });
  });

  it('keeps successful token responses unchanged in strict mode', async () => {
    const token: ISwapToken = {
      contractAddress: '0xtoken',
      decimals: 18,
      isNative: false,
      networkId: 'evm--1',
      price: '2',
      symbol: 'TOKEN',
    };
    const service = createService(
      jest.fn().mockResolvedValue({ data: { data: [token] } }),
    );

    await expect(
      service.fetchSwapTokens({ ...requestParams, throwOnError: true }),
    ).resolves.toEqual([{ ...token, currency: 'usd' }]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('keeps a legitimate empty response successful in strict mode', async () => {
    const service = createService(
      jest.fn().mockResolvedValue({ data: { data: [] } }),
    );

    await expect(
      service.fetchSwapTokens({ ...requestParams, throwOnError: true }),
    ).resolves.toEqual([]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('keeps cancellation behavior unchanged in strict mode', async () => {
    const service = createService(
      jest.fn().mockRejectedValue(new axios.CanceledError('cancelled')),
    );

    await expect(
      service.fetchSwapTokens({ ...requestParams, throwOnError: true }),
    ).rejects.toMatchObject({
      message: 'swap fetch token cancel',
      cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
    });
    expect(showToast).not.toHaveBeenCalled();
  });
});
