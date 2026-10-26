import axios from 'axios';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ESwapFetchCancelCause } from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchTokenListParams,
  IFetchTokensParams,
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

  const createEmptyTokenClient = () =>
    axios.create({
      adapter: async (config) => ({
        data: { data: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }),
    });

  it.each<{
    name: string;
    foregroundParams: Partial<IFetchTokensParams>;
  }>([
    {
      name: 'keyword search',
      foregroundParams: {
        keywords: 'TOKEN',
        onlySwapTokens: true,
        isTokenListPrefetch: true,
        tokenListPriority: 'background',
      },
    },
    {
      name: 'visible list with silent failures',
      foregroundParams: {
        isTokenListPrefetch: true,
        tokenListPriority: 'foreground',
      },
    },
    {
      name: 'legacy foreground list',
      foregroundParams: {},
    },
  ])(
    'starts $name in the next available slot ahead of a queued wallet sweep',
    async ({ foregroundParams }) => {
      let active = 0;
      let peak = 0;
      const started: { networkId?: string; leakedPriority: boolean }[] = [];
      const releases: (() => void)[] = [];
      const client = axios.create({
        adapter: async (config) => {
          const params = config.params as IFetchTokenListParams;
          started.push({
            networkId: params.networkId,
            leakedPriority: Object.hasOwn(params, 'tokenListPriority'),
          });
          active += 1;
          peak = Math.max(peak, active);
          try {
            await new Promise<void>((resolve) => releases.push(resolve));
            return {
              data: { data: [] },
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            };
          } finally {
            active -= 1;
          }
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
      const sweep = Array.from({ length: 35 }, (_, index) =>
        service.fetchSwapTokens({
          networkId: `evm--${index + 1}`,
          currency: 'usd',
          isTokenListPrefetch: true,
          isAllNetworkFetchAccountTokens: true,
          throwOnError: true,
        }),
      );
      const flushPending = async () => {
        for (let index = 0; index < 80; index += 1) await Promise.resolve();
      };
      await flushPending();
      expect(started).toHaveLength(6);
      expect(active).toBe(6);
      const foreground = service.fetchSwapTokens({
        ...foregroundParams,
        networkId: 'evm--999',
        currency: 'usd',
        throwOnError: true,
      });
      await flushPending();
      expect(started).toHaveLength(6);
      releases.shift()?.();
      await flushPending();
      expect(started).toHaveLength(7);
      expect(started[6].networkId).toBe('evm--999');
      expect(active).toBe(6);
      for (let batch = 0; batch < 8; batch += 1) {
        releases.splice(0).forEach((release) => release());
        await flushPending();
      }
      await expect(Promise.all([...sweep, foreground])).resolves.toHaveLength(
        36,
      );
      expect(peak).toBe(6);
      expect(active).toBe(0);
      expect(started.some(({ leakedPriority }) => leakedPriority)).toBe(false);
      expect(service['foregroundTokenListQueue']).toHaveLength(0);
      expect(service['backgroundTokenListQueue']).toHaveLength(0);
    },
  );

  it('cancels only the abandoned search and skips its queued chains without exceeding six HTTP calls', async () => {
    let active = 0;
    let peak = 0;
    const startedKeywords: (string | undefined)[] = [];
    const releases: (() => void)[] = [];
    const showToast = jest.fn();
    const client = axios.create({
      adapter: async (config) => {
        const params = config.params as IFetchTokenListParams;
        startedKeywords.push(params.keywords);
        active += 1;
        peak = Math.max(peak, active);
        try {
          await new Promise<void>((resolve, reject) => {
            const abort = () => {
              config.signal?.removeEventListener?.('abort', abort);
              reject(new axios.CanceledError('search aborted'));
            };
            config.signal?.addEventListener?.('abort', abort);
            releases.push(() => {
              config.signal?.removeEventListener?.('abort', abort);
              resolve();
            });
          });
          return {
            data: { data: [bnbUsdt] },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          };
        } finally {
          active -= 1;
        }
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
    const search = (keywords: string) =>
      service.fetchSwapTokens({
        networkId: 'onekeyall--0',
        searchNetworks: Array.from({ length: 8 }, (_, index) => ({
          networkId: `evm--${index + 1}`,
        })),
        keywords,
        searchRequestId: `${keywords}-request`,
        onlySwapTokens: true,
        currency: 'usd',
        throwOnError: true,
      });
    const flushPending = async () => {
      for (let index = 0; index < 80; index += 1) await Promise.resolve();
    };
    const abandoned = search('abandoned').catch((error: unknown) => error);
    await flushPending();
    expect(startedKeywords).toEqual(Array(6).fill('abandoned'));
    const retained = search('retained');
    const preload = service.fetchSwapTokens({
      networkId: 'evm--1',
      currency: 'usd',
      isTokenListPrefetch: true,
      throwOnError: true,
    });
    const next = search('next');
    await flushPending();
    expect(active).toBe(6);
    await service.cancelSwapTokenSearch({ requestId: 'abandoned-request' });
    await flushPending();
    expect(
      startedKeywords.filter((value) => value === 'abandoned'),
    ).toHaveLength(6);
    expect(startedKeywords).toContain('retained');
    for (let batch = 0; batch < 5; batch += 1) {
      releases.splice(0).forEach((release) => release());
      await flushPending();
    }
    await expect(abandoned).resolves.toMatchObject({
      cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
    });
    await expect(Promise.all([retained, preload, next])).resolves.toEqual([
      [bnbUsdt],
      [bnbUsdt],
      [bnbUsdt],
    ]);
    expect(
      startedKeywords.filter((value) => value === 'abandoned'),
    ).toHaveLength(6);
    expect(
      startedKeywords.filter((value) => value === 'retained'),
    ).toHaveLength(9);
    expect(startedKeywords.filter((value) => value === 'next')).toHaveLength(9);
    expect(startedKeywords.filter((value) => value === undefined)).toHaveLength(
      1,
    );
    expect(peak).toBe(6);
    expect(active).toBe(0);
    expect(showToast).not.toHaveBeenCalled();
    expect(service['tokenSearchControllers'].size).toBe(0);
  });

  it('registers cancellation before asynchronous request preparation', async () => {
    const client = createEmptyTokenClient();
    const get = jest.spyOn(client, 'get');
    const showToast = jest.fn();
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
        serviceApp: { showToast },
      },
    });
    let finishPreparation: (() => void) | undefined;
    const preparation = new Promise<void>((resolve) => {
      finishPreparation = resolve;
    });
    const getClient = jest
      .spyOn(service, 'getClient')
      .mockImplementation(async () => {
        await preparation;
        return client;
      });
    const canceled = service
      .fetchSwapTokens({
        networkId: 'evm--1',
        keywords: 'old',
        searchRequestId: 'preparing-search',
        currency: 'usd',
        throwOnError: true,
      })
      .catch((error: unknown) => error);
    for (
      let index = 0;
      index < 20 && !getClient.mock.calls.length;
      index += 1
    ) {
      await Promise.resolve();
    }
    expect(getClient).toHaveBeenCalledTimes(1);
    await service.cancelSwapTokenSearch({ requestId: 'preparing-search' });
    finishPreparation?.();
    await expect(canceled).resolves.toMatchObject({
      cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
    });
    expect(get).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(service['tokenSearchControllers'].size).toBe(0);
  });

  it('honors cancellation arriving before fetch without canceling default lists', async () => {
    const client = createEmptyTokenClient();
    const get = jest.spyOn(client, 'get');
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
      },
    });
    const getClient = jest
      .spyOn(service, 'getClient')
      .mockResolvedValue(client);
    await service.cancelSwapTokenSearch({ requestId: 'early-search' });
    await expect(
      service.fetchSwapTokens({
        networkId: 'evm--1',
        keywords: 'old',
        searchRequestId: 'early-search',
        currency: 'usd',
        throwOnError: true,
      }),
    ).rejects.toMatchObject({
      cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
    });
    expect(getClient).not.toHaveBeenCalled();
    await expect(
      service.fetchSwapTokens({
        networkId: 'evm--1',
        searchRequestId: 'early-search',
        currency: 'usd',
        isTokenListPrefetch: true,
        throwOnError: true,
      }),
    ).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(service['tokenSearchControllers'].size).toBe(0);
  });

  it('rejects the whole canceled round after a nonempty response even when the transport ignores abort', async () => {
    let finishRemaining: (() => void) | undefined;
    const remaining = new Promise<void>((resolve) => {
      finishRemaining = resolve;
    });
    const signals: (Pick<AbortSignal, 'aborted'> | undefined)[] = [];
    const client = axios.create({
      adapter: async (config) => {
        signals.push(config.signal);
        const primary = config.url === '/swap/v1/tokens';
        if (!primary) await remaining;
        return {
          data: { data: primary ? [bnbUsdt] : [] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      },
    });
    const get = jest.spyOn(client, 'get');
    const showToast = jest.fn();
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
        serviceApp: { showToast },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    const canceled = service
      .fetchSwapTokens({
        networkId: 'evm--1',
        keywords: 'token',
        searchRequestId: 'partial-search',
        onlySwapTokens: true,
        currency: 'usd',
        throwOnError: true,
      })
      .catch((error: unknown) => error);
    for (let index = 0; index < 40; index += 1) await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(2);
    await service.cancelSwapTokenSearch({ requestId: 'partial-search' });
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
    finishRemaining?.();
    await expect(canceled).resolves.toMatchObject({
      cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
    });
    expect(showToast).not.toHaveBeenCalled();
    expect(service['tokenSearchControllers'].size).toBe(0);
  });

  it('bounds early cancellation records by count and age', async () => {
    const client = createEmptyTokenClient();
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      for (let index = 0; index < 257; index += 1) {
        await service.cancelSwapTokenSearch({ requestId: `early-${index}` });
      }
      expect(service['canceledTokenSearchRequests'].size).toBe(256);
      const search = (requestId: string) =>
        service.fetchSwapTokens({
          networkId: 'evm--1',
          keywords: 'token',
          searchRequestId: requestId,
          currency: 'usd',
          throwOnError: true,
        });
      await expect(search('early-0')).resolves.toEqual([]);
      await expect(search('early-256')).rejects.toMatchObject({
        cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
      });
      now.mockReturnValue(1000 + 5 * 60 * 1000);
      await expect(search('early-256')).resolves.toEqual([]);
      expect(service['canceledTokenSearchRequests'].size).toBe(0);
      expect(service['tokenSearchControllers'].size).toBe(0);
    } finally {
      now.mockRestore();
    }
  });

  it('shares six request slots across search rounds and preloads and releases failures', async () => {
    let active = 0;
    let peak = 0;
    let started = 0;
    let preloadStarted = false;
    const releases: (() => void)[] = [];
    const client = axios.create({
      adapter: async (config) => {
        const params = config.params as IFetchTokenListParams;
        started += 1;
        const firstRequest = started === 1;
        if (!params.keywords) preloadStarted = true;
        active += 1;
        peak = Math.max(peak, active);
        try {
          await new Promise<void>((resolve) => releases.push(resolve));
          if (firstRequest) throw new OneKeyLocalError('one chain failed');
        } finally {
          active -= 1;
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
    const preload = service.fetchSwapTokens({
      networkId: 'evm--1',
      currency: 'usd',
      isTokenListPrefetch: true,
      throwOnError: true,
    });
    await flushPending();
    expect(preloadStarted).toBe(false);
    expect(active).toBe(6);
    for (let batch = 0; batch < 4; batch += 1) {
      releases.splice(0).forEach((release) => release());
      await flushPending();
    }
    await expect(Promise.all([first, second, preload])).resolves.toEqual([
      [bnbUsdt],
      [bnbUsdt],
      [bnbUsdt],
    ]);
    expect(preloadStarted).toBe(true);
    expect(started).toBe(19);
    expect(peak).toBe(6);
    expect(active).toBe(0);
  });

  it('bounds simultaneous default lists and preloads with one six-request pool', async () => {
    let active = 0;
    let peak = 0;
    let started = 0;
    const releases: (() => void)[] = [];
    const client = axios.create({
      adapter: async (config) => {
        started += 1;
        active += 1;
        peak = Math.max(peak, active);
        try {
          await new Promise<void>((resolve) => releases.push(resolve));
          return {
            data: { data: [] },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          };
        } finally {
          active -= 1;
        }
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
    const requests = Array.from({ length: 14 }, (_, index) =>
      service.fetchSwapTokens({
        networkId: `evm--${index + 1}`,
        currency: index % 2 ? 'usd' : 'cny',
        isTokenListPrefetch: index % 2 === 0,
        throwOnError: true,
      }),
    );
    const flushPending = async () => {
      for (let index = 0; index < 40; index += 1) await Promise.resolve();
    };
    await flushPending();
    expect(started).toBe(6);
    for (let batch = 0; batch < 3; batch += 1) {
      releases.splice(0).forEach((release) => release());
      await flushPending();
    }
    await expect(Promise.all(requests)).resolves.toHaveLength(14);
    expect(started).toBe(14);
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
