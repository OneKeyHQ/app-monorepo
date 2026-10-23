import axios from 'axios';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

  it('shares six search slots across keywords, releases failures and leaves preloads independent', async () => {
    let active = 0;
    let peak = 0;
    let started = 0;
    let preloadStarted = false;
    const releases: (() => void)[] = [];
    const client = axios.create({
      adapter: async (config) => {
        const params = config.params as IFetchTokenListParams;
        if (params.keywords) {
          started += 1;
          const firstRequest = started === 1;
          active += 1;
          peak = Math.max(peak, active);
          try {
            await new Promise<void>((resolve) => releases.push(resolve));
            if (firstRequest) throw new OneKeyLocalError('one chain failed');
          } finally {
            active -= 1;
          }
        } else {
          preloadStarted = true;
        }
        return {
          data: { data: [bnbUsdt] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      },
    });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    const search = (keywords: string) =>
      service.fetchSwapTokens({
        networkId: 'onekeyall--0',
        searchNetworks: Array.from({ length: 8 }, (_, index) => ({
          networkId: `evm--${index + 1}`,
        })),
        keywords,
        onlySwapTokens: true,
        currency: 'usd',
        isTokenListPrefetch: true,
        throwOnError: true,
      });
    const flushPending = async () => {
      for (let index = 0; index < 40; index += 1) await Promise.resolve();
    };
    const first = search('first');
    const second = search('second');
    await flushPending();
    expect(started).toBe(6);
    expect(active).toBe(6);
    await service.fetchSwapTokens({
      networkId: 'evm--1',
      currency: 'usd',
      isTokenListPrefetch: true,
      throwOnError: true,
    });
    expect(preloadStarted).toBe(true);
    for (let batch = 0; batch < 4; batch += 1) {
      releases.splice(0).forEach((release) => release());
      await flushPending();
    }
    await expect(Promise.all([first, second])).resolves.toEqual([
      [bnbUsdt],
      [bnbUsdt],
    ]);
    expect(started).toBe(18);
    expect(peak).toBe(6);
    expect(active).toBe(0);
  });

  it('keeps normal chain requests and prefetches independent', async () => {
    const requestedNetworks: (string | undefined)[] = [];
    const client = axios.create({
      adapter: async (config) => {
        requestedNetworks.push(
          (config.params as IFetchTokenListParams).networkId,
        );
        return {
          data: { data: [] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      },
    });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    await Promise.all([
      service.fetchSwapTokens({
        networkId: 'evm--1',
        currency: 'usd',
        throwOnError: true,
      }),
      service.fetchSwapTokens({
        networkId: 'evm--56',
        currency: 'usd',
        isTokenListPrefetch: true,
        throwOnError: true,
      }),
      service.fetchSwapTokens({
        networkId: 'evm--137',
        currency: 'usd',
        throwOnError: true,
      }),
    ]);
    expect(requestedNetworks.toSorted()).toEqual([
      'evm--1',
      'evm--137',
      'evm--56',
    ]);
  });

  it('lets a shared preparing search finish when a newer search starts', async () => {
    const requestedKeywords: (string | undefined)[] = [];
    const client = axios.create({
      adapter: async (config) => {
        const params = config.params as IFetchTokenListParams;
        requestedKeywords.push(params.keywords);
        return {
          data: { data: [] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      },
    });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
      },
    });
    let resolveFirst: ((value: typeof client) => void) | undefined;
    const preparation = new Promise<typeof client>((resolve) => {
      resolveFirst = resolve;
    });
    const getClient = jest
      .spyOn(service, 'getClient')
      .mockReturnValueOnce(preparation)
      .mockResolvedValue(client);
    const first = service.fetchSwapTokens({
      networkId: 'evm--1',
      keywords: 'old',
      currency: 'usd',
      throwOnError: true,
    });
    // Allow the first call to enter asynchronous client preparation.
    for (
      let index = 0;
      index < 20 && getClient.mock.calls.length === 0;
      index += 1
    )
      await Promise.resolve();
    expect(getClient).toHaveBeenCalledTimes(1);
    await service.fetchSwapTokens({
      networkId: 'evm--1',
      keywords: 'new',
      currency: 'usd',
      throwOnError: true,
    });
    resolveFirst?.(client);
    await expect(first).resolves.toEqual([]);
    expect(requestedKeywords).toEqual(['new', 'old']);
  });

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
      expect(get).toHaveBeenCalledTimes(2);
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

  it.each(['merge', 'partial', 'empty', 'all-failed'])(
    'fans out all-network search and handles %s responses',
    async (responseCase) => {
      const requested: { endpoint?: string; params: IFetchTokenListParams }[] =
        [];
      const failure = new Error('network search unavailable');
      const showToast = jest.fn();
      const client = axios.create({
        adapter: async (config) => {
          const requestParams = config.params as IFetchTokenListParams;
          requested.push({ endpoint: config.url, params: requestParams });
          if (
            responseCase === 'all-failed' ||
            (responseCase === 'partial' && requestParams.networkId === 'evm--1')
          ) {
            throw failure;
          }
          return {
            data: {
              data:
                responseCase === 'empty'
                  ? []
                  : [
                      requestParams.networkId === 'evm--1'
                        ? otherNetworkToken
                        : bnbUsdt,
                    ],
            },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          };
        },
      });
      const service = new ServiceSwap({
        backgroundApi: {
          serviceAccountProfile: {
            _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
          },
          serviceApp: { showToast },
        },
      });
      jest.spyOn(service, 'getClient').mockResolvedValue(client);
      const request = service.fetchSwapTokens({
        networkId: 'onekeyall--0',
        contractSearchNetworkId: 'evm--56',
        searchNetworks: [
          { networkId: 'evm--1' },
          { networkId: 'evm--56', lpToken: false },
          { networkId: 'evm--1' },
        ],
        keywords: 'usdt',
        onlySwapTokens: true,
        accountAddress: 'another-chain-address',
        accountNetworkId: 'btc--0',
        currency: 'usd',
        throwOnError: true,
      });
      if (responseCase === 'all-failed') {
        await expect(request).rejects.toBe(failure);
        expect(showToast).toHaveBeenCalledTimes(1);
      } else {
        let expectedTokens = [bnbUsdt, otherNetworkToken];
        if (responseCase === 'empty') {
          expectedTokens = [];
        } else if (responseCase === 'partial') {
          expectedTokens = [bnbUsdt];
        }
        await expect(request).resolves.toEqual(expectedTokens);
        expect(showToast).not.toHaveBeenCalled();
      }
      expect(
        requested.map(({ endpoint, params: requestParams }) => [
          endpoint,
          requestParams.networkId,
        ]),
      ).toEqual([
        ['/swap/v1/tokens', 'evm--56'],
        ['/swap/v1/tokens', 'evm--1'],
        ['/swap/v1/swap-tokens', 'onekeyall--0'],
      ]);
      expect(
        requested.every(
          ({ params: requestParams }) =>
            requestParams.accountAddress === undefined &&
            requestParams.accountNetworkId === undefined &&
            requestParams.accountXpub === undefined,
        ),
      ).toBe(true);
    },
  );

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
