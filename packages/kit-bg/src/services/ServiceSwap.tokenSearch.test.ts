import axios from 'axios';

import { ESwapFetchCancelCause } from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchTokenListParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

describe('ServiceSwap token search', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  const bnbUsdt: ISwapToken = {
    networkId: 'evm--56',
    contractAddress: '0x55d398326f99059ff775485246999027b3197955',
    decimals: 18,
    symbol: 'USDT',
  };
  const otherNetworkToken: ISwapToken = {
    ...bnbUsdt,
    networkId: 'evm--1',
  };

  it.each([
    { allNetworkTokens: [] },
    { allNetworkTokens: [bnbUsdt, otherNetworkToken] },
  ])(
    'preserves the selected-chain contract result alongside all-network results %j',
    async ({ allNetworkTokens }) => {
      const get = jest.fn(
        (_endpoint: string, { params }: { params: IFetchTokenListParams }) =>
          Promise.resolve({
            data: {
              data:
                params.networkId === 'evm--56' ? [bnbUsdt] : allNetworkTokens,
            },
          }),
      );
      const service = new ServiceSwap({
        backgroundApi: {
          serviceAccountProfile: {
            _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
          },
        },
      });
      jest.spyOn(service, 'getClient').mockResolvedValue({ get } as never);

      await expect(
        service.fetchSwapTokens({
          networkId: 'onekeyall--0',
          contractSearchNetworkId: 'evm--56',
          keywords: bnbUsdt.contractAddress,
          onlySwapTokens: true,
          currency: 'usd',
          throwOnError: true,
        }),
      ).resolves.toEqual(
        allNetworkTokens.length ? [bnbUsdt, otherNetworkToken] : [bnbUsdt],
      );
      expect(get).toHaveBeenCalledTimes(3);
      expect(get).toHaveBeenCalledWith(
        '/swap/v1/tokens',
        expect.objectContaining({
          params: expect.objectContaining({
            networkId: 'evm--56',
            accountAddress: undefined,
            accountNetworkId: undefined,
          }),
        }),
      );
    },
  );

  it('keeps cross-network discovery when the selected-chain lookup fails', async () => {
    const get = jest.fn(
      (_endpoint: string, { params }: { params: IFetchTokenListParams }) =>
        params.networkId === 'evm--56'
          ? Promise.reject(new Error('selected chain unavailable'))
          : Promise.resolve({ data: { data: [otherNetworkToken] } }),
    );
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue({ get } as never);

    await expect(
      service.fetchSwapTokens({
        networkId: 'onekeyall--0',
        contractSearchNetworkId: 'evm--56',
        keywords: bnbUsdt.contractAddress,
        onlySwapTokens: true,
        currency: 'usd',
        throwOnError: true,
      }),
    ).resolves.toEqual([otherNetworkToken]);
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
