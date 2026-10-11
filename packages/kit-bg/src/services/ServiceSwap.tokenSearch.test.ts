import axios from 'axios';

import { ESwapFetchCancelCause } from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

describe('ServiceSwap token search', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it.each(['/swap/v1/tokens', '/swap/v1/swap-tokens'])(
    'keeps nonempty search results when %s fails',
    async (failedEndpoint) => {
      const primaryToken: ISwapToken = {
        networkId: 'evm--1',
        contractAddress: '0xprimary',
        decimals: 6,
        symbol: 'PRIMARY',
      };
      const showToast = jest.fn();
      const get = jest.fn((endpoint: string) => {
        if (endpoint === failedEndpoint) {
          return Promise.reject(new Error('search endpoint unavailable'));
        }
        return Promise.resolve({ data: { data: [primaryToken] } });
      });
      const service = new ServiceSwap({
        backgroundApi: {
          serviceAccountProfile: {
            _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
          },
          serviceApp: { showToast },
        },
      });
      jest.spyOn(service, 'getClient').mockResolvedValue({ get } as never);

      await expect(
        service.fetchSwapTokens({
          networkId: 'evm--1',
          keywords: 'primary',
          onlySwapTokens: true,
          currency: 'usd',
          throwOnError: true,
        }),
      ).resolves.toEqual([primaryToken]);
      expect(get).toHaveBeenCalledTimes(2);
      expect(showToast).not.toHaveBeenCalled();
    },
  );

  it.each(['/swap/v1/tokens', '/swap/v1/swap-tokens'])(
    'rejects incomplete empty search results when %s fails',
    async (failedEndpoint) => {
      const error = new Error('search endpoint unavailable');
      const showToast = jest.fn();
      const get = jest.fn((endpoint: string) =>
        endpoint === failedEndpoint
          ? Promise.reject(error)
          : Promise.resolve({ data: { data: [] } }),
      );
      const service = new ServiceSwap({
        backgroundApi: {
          serviceAccountProfile: {
            _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
          },
          serviceApp: { showToast },
        },
      });
      jest.spyOn(service, 'getClient').mockResolvedValue({ get } as never);

      await expect(
        service.fetchSwapTokens({
          networkId: 'evm--1',
          keywords: 'primary',
          onlySwapTokens: true,
          currency: 'usd',
          throwOnError: true,
        }),
      ).rejects.toBe(error);
      expect(get).toHaveBeenCalledTimes(2);
      expect(showToast).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts empty search results when both endpoints succeed', async () => {
    const showToast = jest.fn();
    const get = jest.fn().mockResolvedValue({ data: { data: [] } });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
        serviceApp: { showToast },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue({ get } as never);

    await expect(
      service.fetchSwapTokens({
        networkId: 'evm--1',
        keywords: 'missing',
        onlySwapTokens: true,
        currency: 'usd',
        throwOnError: true,
      }),
    ).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(showToast).not.toHaveBeenCalled();
  });

  it.each(['/swap/v1/tokens', '/swap/v1/swap-tokens'])(
    'rejects canceled searches even with nonempty results when %s cancels',
    async (canceledEndpoint) => {
      const token: ISwapToken = {
        networkId: 'evm--1',
        contractAddress: '0xprimary',
        decimals: 6,
        symbol: 'PRIMARY',
      };
      const showToast = jest.fn();
      const get = jest.fn((endpoint: string) =>
        endpoint === canceledEndpoint
          ? Promise.reject(new axios.CanceledError('search canceled'))
          : Promise.resolve({ data: { data: [token] } }),
      );
      const service = new ServiceSwap({
        backgroundApi: {
          serviceAccountProfile: {
            _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
          },
          serviceApp: { showToast },
        },
      });
      jest.spyOn(service, 'getClient').mockResolvedValue({ get } as never);

      await expect(
        service.fetchSwapTokens({
          networkId: 'evm--1',
          keywords: 'primary',
          onlySwapTokens: true,
          currency: 'usd',
          throwOnError: true,
        }),
      ).rejects.toMatchObject({
        cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
      });
      expect(showToast).not.toHaveBeenCalled();
    },
  );

  it('rejects token-list failures for strict refresh callers', async () => {
    const error = new Error('token list unavailable');
    const showToast = jest.fn();
    const get = jest.fn().mockRejectedValue(error);
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
        serviceApp: { showToast },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue({ get } as never);

    await expect(
      service.fetchSwapTokens({
        networkId: 'evm--1',
        currency: 'usd',
        throwOnError: true,
      }),
    ).rejects.toBe(error);
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});
