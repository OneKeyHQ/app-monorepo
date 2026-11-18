import axios from 'axios';

import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

function createService() {
  const client = axios.create();
  const get = jest.spyOn(client, 'get');
  const getAllNetworks = jest.fn().mockResolvedValue({
    networks: [
      { id: 'evm--1', name: 'Ethereum', symbol: 'ETH', backendIndex: true },
    ],
  });
  const service = new ServiceSwap({
    backgroundApi: {
      serviceNetwork: { getAllNetworks },
      serviceDeFi: {
        getDeFiEnabledNetworksMapState: jest
          .fn()
          .mockResolvedValue({ isReady: false }),
      },
    },
  });
  jest.spyOn(service, 'getClient').mockResolvedValue(client);
  return { service, get, getAllNetworks };
}

describe('ServiceSwap network configuration errors', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it.each([
    [
      'HTTP 403',
      () =>
        new OneKeyServerApiError({
          code: 403,
          message: 'Forbidden',
          autoToast: true,
        }),
    ],
    [
      'business error',
      () =>
        new OneKeyServerApiError({
          code: 123,
          message: 'Unavailable',
          autoToast: true,
        }),
    ],
    [
      'timeout',
      () => new axios.AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED'),
    ],
  ] as const)(
    'silences retry %s while preserving the original rejection',
    async (_label, createError) => {
      const { service, get } = createService();
      const error = createError();
      get.mockRejectedValue(error);

      await expect(
        service.fetchSwapNetworks({ autoHandleError: false }),
      ).rejects.toBe(error);
      expect(error).toMatchObject({ autoToast: false });
      // Keep normal interceptor validation: silent handling must not accept business errors.
      expect(get).toHaveBeenCalledWith('/swap/v1/networks', {
        params: { protocol: EProtocolOfExchange.ALL },
        timeout: 10_000,
      });
    },
  );

  it.each([undefined, true])(
    'keeps normal request errors visible with autoHandleError=%s',
    async (autoHandleError) => {
      const { service, get } = createService();
      const error = new axios.AxiosError(
        'timeout of 10000ms exceeded',
        'ECONNABORTED',
      );
      get.mockRejectedValue(error);

      await expect(service.fetchSwapNetworks({ autoHandleError })).rejects.toBe(
        error,
      );
      expect(error).toMatchObject({ autoToast: true });
    },
  );

  it('silences dependency failures after the HTTP response', async () => {
    const { service, get, getAllNetworks } = createService();
    get.mockResolvedValue({ data: { code: 0, data: [] } });
    const error = new Error('network metadata unavailable');
    getAllNetworks.mockRejectedValue(error);

    await expect(
      service.fetchSwapNetworks({ autoHandleError: false }),
    ).rejects.toBe(error);
    expect(error).toMatchObject({ autoToast: false });
  });

  it('preserves successful mapping and requested client-network refresh', async () => {
    const { service, get, getAllNetworks } = createService();
    get.mockResolvedValue({
      data: {
        code: 0,
        data: [{ networkId: 'evm--1', supportSingleSwap: true }],
      },
    });

    await expect(
      service.fetchSwapNetworks({
        autoHandleError: false,
        refreshClientNetworks: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        networkId: 'evm--1',
        name: 'Ethereum',
        supportSingleSwap: true,
      }),
    ]);
    expect(getAllNetworks).toHaveBeenCalledWith({ clearCache: true });
  });
});
