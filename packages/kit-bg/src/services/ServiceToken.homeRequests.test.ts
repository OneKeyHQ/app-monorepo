import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getAdvertisedHomeTokenMainRuntimeId } from '@onekeyhq/shared/src/utils/homeTokenRequest';
import { getEmptyTokenData } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IHomeTokenRequest } from '@onekeyhq/shared/types/token';

import { vaultFactory } from '../vaults/factory';

import ServiceToken from './ServiceToken';
import ServiceTokenViewModel from './ServiceTokenViewModel';

import type { IIngestRoundParams } from './ServiceTokenViewModel';

const emitMock = jest.spyOn(appEventBus, 'emit');

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
  backgroundMethodForDev:
    () => (_t: unknown, _k: string, d: PropertyDescriptor) =>
      d,
  checkDevOnlyPassword: jest.fn(),
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    constructor(public backgroundApi: unknown) {
      this.backgroundApi = (
        backgroundApi as { backgroundApi: unknown }
      ).backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/shared/src/utils/homeTokenRequest', () => ({
  getAdvertisedHomeTokenMainRuntimeId: jest.fn(),
  isNativeHomeTokenRequestEnabled: () => true,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    MemoryPressureWarning: 'MemoryPressureWarning',
    TokenListStructureFrame: 'TokenListStructureFrame',
    TokenListValuationFrame: 'TokenListValuationFrame',
    TokenListRiskyFrame: 'TokenListRiskyFrame',
  },
  appEventBus: { on: jest.fn(), emit: jest.fn() },
}));
jest.mock('../states/jotai/atoms', () => ({
  settingsPersistAtom: {
    get: jest.fn(async () => ({ currencyInfo: { id: 'usd' } })),
  },
  currencyPersistAtom: { get: jest.fn(async () => ({ currencyMap: {} })) },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));
jest.mock('../vaults/settings', () => ({ getVaultSettings: jest.fn() }));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: jest.fn() } },
    token: {
      request: {
        fetchAccountTokenAccountAddressAndXpubBothEmpty: jest.fn(),
        fetchAccountTokensBlockedAllNetworkRequest: jest.fn(),
      },
    },
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function makeApi() {
  return {
    serviceAccount: {
      getAccountXpub: jest.fn().mockResolvedValue(undefined),
      getAccountAddressForApi: jest.fn().mockResolvedValue('fixture-address'),
      buildAccountXpubOrAddress: jest.fn().mockResolvedValue('fixture-address'),
    },
    serviceCustomToken: {
      getCustomTokens: jest.fn().mockResolvedValue([]),
      getHiddenTokens: jest.fn().mockResolvedValue([]),
    },
    serviceToken: {
      getUnblockedTokens: jest.fn().mockResolvedValue([]),
      getBlockedTokens: jest.fn().mockResolvedValue([]),
      getAllAggregateTokenInfo: jest
        .fn()
        .mockResolvedValue({ allAggregateTokenMap: {} }),
    },
    serviceNetwork: {
      getVaultSettings: jest.fn().mockResolvedValue({}),
      getNetworkSafe: jest.fn().mockResolvedValue(undefined),
    },
    serviceSetting: {
      syncWalletConfig: jest.fn().mockResolvedValue(undefined),
      syncWalletConfigIfNeeded: jest.fn().mockResolvedValue(undefined),
    },
    serviceTokenViewModel: {
      alignHomeTokenRequest: jest.fn(),
      retireHomeTokenRounds: jest.fn(),
      retainHomeTokenRound: jest.fn().mockReturnValue('fixture-ref'),
    },
    simpleDb: {
      customTokens: {
        getRawData: jest
          .fn()
          .mockResolvedValue({ customTokens: {}, hiddenTokens: {} }),
      },
      riskTokenManagement: {
        getRawData: jest
          .fn()
          .mockResolvedValue({ blockedTokens: {}, unblockedTokens: {} }),
      },
      aggregateToken: {
        getAggregateTokenConfigSnapshot: jest
          .fn()
          .mockResolvedValue({ aggregateTokenConfigMap: {} }),
      },
      localTokens: {
        getRawData: jest.fn().mockResolvedValue(null),
        reserveAccountTokenListWriteOrder: jest.fn(
          (() => {
            let order = 0;
            return () => {
              order += 1;
              return order;
            };
          })(),
        ),
        updateAccountTokenList: jest.fn().mockResolvedValue(undefined),
        updateAccountTokenListByCache: jest.fn().mockResolvedValue(undefined),
        getAccountTokenList: jest.fn().mockResolvedValue({
          tokenList: [],
          smallBalanceTokenList: [],
          riskyTokenList: [],
          tokenListMap: {},
          tokenListValue: '0',
          currency: 'usd',
          hasCache: true,
        }),
      },
    },
  };
}

describe('ServiceToken native Home request lifetime', () => {
  let runtime = 0;
  let api: ReturnType<typeof makeApi>;
  let service: ServiceToken;
  const fetchTokenListMock = jest.fn(
    async (_params: { requestApiParams: unknown }) => ({
      data: { data: getEmptyTokenData() },
    }),
  );
  const token = (generation: number): IHomeTokenRequest => ({
    mainRuntimeId: `main-${runtime}`,
    generation,
    ownerKey: 'home-owner',
  });
  const fetchParams = () => ({
    homeRequest: token(1),
    accountId: 'fixture-account',
    networkId: 'evm--1',
    flag: 'home-token-list',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    runtime += 1;
    jest
      .mocked(getAdvertisedHomeTokenMainRuntimeId)
      .mockReturnValue(`main-${runtime}`);
    api = makeApi();
    service = new ServiceToken({ backgroundApi: api });
    jest.mocked(vaultFactory.getVault).mockResolvedValue({
      fetchTokenList: fetchTokenListMock,
    } as unknown as Awaited<ReturnType<typeof vaultFactory.getVault>>);
  });

  it('drops a late begin before preflight and leaves non-Home requests usable', async () => {
    await service.invalidateHomeTokenRequests(token(2));
    await expect(
      service.fetchAccountTokens(fetchParams()),
    ).rejects.toMatchObject({ name: 'CanceledError' });
    expect(api.serviceAccount.getAccountAddressForApi).not.toHaveBeenCalled();
    await expect(
      service.fetchAccountTokens({
        accountId: 'selector',
        networkId: 'evm--1',
        flag: 'token-selector',
      }),
    ).resolves.toBeDefined();
  });

  it('shares one background config and aggregate derivation across 22 Home branches', async () => {
    service._currentNetworkId = getNetworkIdsMap().onekeyall;
    await service.prepareHomeTokenRequest(token(1));
    const results = await Promise.all(
      Array.from({ length: 22 }, (_, index) =>
        service.fetchAccountTokens({
          ...fetchParams(),
          accountId: `fixture-${index}`,
          networkId: `evm--${index + 1}`,
          isAllNetworks: true,
        }),
      ),
    );
    expect(results).toHaveLength(22);
    expect(api.simpleDb.customTokens.getRawData).toHaveBeenCalledTimes(1);
    expect(api.simpleDb.riskTokenManagement.getRawData).toHaveBeenCalledTimes(
      1,
    );
    expect(api.serviceToken.getAllAggregateTokenInfo).toHaveBeenCalledTimes(1);
    expect(
      api.serviceTokenViewModel.retainHomeTokenRound,
    ).toHaveBeenCalledTimes(22);
    expect(
      api.serviceTokenViewModel.alignHomeTokenRequest,
    ).toHaveBeenCalledWith(token(1));
    const first =
      api.serviceCustomToken.getCustomTokens.mock.calls[0][0]
        .customTokensRawData;
    for (const [params] of api.serviceCustomToken.getCustomTokens.mock.calls) {
      expect(params.customTokensRawData).toBe(first);
    }
    await service.prepareHomeTokenRequest(token(2));
    expect(api.simpleDb.customTokens.getRawData).toHaveBeenCalledTimes(2);
    expect(api.serviceToken.getAllAggregateTokenInfo).toHaveBeenCalledTimes(2);
  });

  it('retires a pending context and lets a successor generation retry a rejected read', async () => {
    const read = deferred<unknown>();
    api.simpleDb.customTokens.getRawData.mockReturnValueOnce(read.promise);
    const pending = service.prepareHomeTokenRequest(token(1));
    const rejected = (async () => {
      await expect(pending).rejects.toMatchObject({ name: 'CanceledError' });
    })();
    await service.invalidateHomeTokenRequests(token(2));
    read.resolve({});
    await rejected;
    await expect(
      service.prepareHomeTokenRequest(token(3)),
    ).resolves.toBeUndefined();
    expect(api.simpleDb.customTokens.getRawData).toHaveBeenCalledTimes(2);
    expect(api.serviceToken.getAllAggregateTokenInfo).toHaveBeenCalledTimes(1);
    expect(
      api.serviceTokenViewModel.retireHomeTokenRounds,
    ).toHaveBeenCalledWith(token(2));
  });

  it('does not reuse a Home context for non-Home consumers', async () => {
    await service.prepareHomeTokenRequest(token(1));
    await service.fetchAccountTokens({
      accountId: 'selector',
      networkId: 'evm--1',
      flag: 'token-selector',
    });
    expect(api.serviceToken.getAllAggregateTokenInfo).toHaveBeenCalledTimes(2);
    expect(api.simpleDb.customTokens.getRawData).toHaveBeenCalledTimes(1);
  });

  it('retries a failed config read on the next generation without retaining a poisoned owner', async () => {
    api.simpleDb.customTokens.getRawData.mockRejectedValueOnce(
      new OneKeyLocalError('fixture config failed'),
    );
    await expect(service.prepareHomeTokenRequest(token(1))).rejects.toThrow(
      'fixture config failed',
    );
    await expect(
      service.prepareHomeTokenRequest(token(2)),
    ).resolves.toBeUndefined();
    await service.prepareHomeTokenRequest(token(2));
    expect(api.simpleDb.customTokens.getRawData).toHaveBeenCalledTimes(2);
    expect(api.serviceToken.getAllAggregateTokenInfo).toHaveBeenCalledTimes(1);
  });

  it('retries a failed context load within the same generation', async () => {
    api.simpleDb.customTokens.getRawData.mockRejectedValueOnce(
      new OneKeyLocalError('fixture transient failure'),
    );
    await expect(service.prepareHomeTokenRequest(token(1))).rejects.toThrow(
      'fixture transient failure',
    );
    await expect(
      service.prepareHomeTokenRequest(token(1)),
    ).resolves.toBeUndefined();
    await service.prepareHomeTokenRequest(token(1));
    expect(api.simpleDb.customTokens.getRawData).toHaveBeenCalledTimes(2);
    expect(api.serviceToken.getAllAggregateTokenInfo).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight context load between concurrent callers', async () => {
    const rawData = deferred<{
      customTokens: Record<string, never>;
      hiddenTokens: Record<string, never>;
    }>();
    api.simpleDb.customTokens.getRawData.mockReturnValueOnce(rawData.promise);
    const first = service.prepareHomeTokenRequest(token(1));
    const second = service.prepareHomeTokenRequest(token(1));
    rawData.resolve({ customTokens: {}, hiddenTokens: {} });
    await Promise.all([first, second]);
    expect(api.simpleDb.customTokens.getRawData).toHaveBeenCalledTimes(1);
  });

  it('stops after pending address preflight and aborts only owned Home controllers', async () => {
    const address = deferred<string>();
    api.serviceAccount.getAccountAddressForApi.mockReturnValue(address.promise);
    const pending = service.fetchAccountTokens(fetchParams());
    const rejected = (async () => {
      await expect(pending).rejects.toMatchObject({ name: 'CanceledError' });
    })();
    const homeController = service._fetchAccountTokensControllers[0].controller;
    const selector = service.fetchAccountTokens({
      accountId: 'selector',
      networkId: 'evm--1',
      flag: 'token-selector',
    });
    const selectorController =
      service._fetchAccountTokensControllers[1].controller;
    await service.invalidateHomeTokenRequests(token(2));
    expect(homeController.signal.aborted).toBe(true);
    expect(selectorController.signal.aborted).toBe(false);
    address.resolve('fixture-address');
    await rejected;
    await expect(selector).resolves.toBeDefined();
    expect(vaultFactory.getVault).toHaveBeenCalledTimes(1);
  });

  it('rechecks after an awaited cache write before returning a large response', async () => {
    const write = deferred<void>();
    const started = deferred<void>();
    api.simpleDb.localTokens.updateAccountTokenList.mockImplementation(
      async () => {
        started.resolve();
        await write.promise;
      },
    );
    const pending = service.fetchAccountTokens({
      ...fetchParams(),
      saveToLocal: true,
    });
    const rejected = (async () => {
      await expect(pending).rejects.toMatchObject({ name: 'CanceledError' });
    })();
    await started.promise;
    await service.invalidateHomeTokenRequests(token(2));
    write.resolve();
    await rejected;
  });

  it('tags single-network writes with their request start order', async () => {
    const olderResponse = deferred<{
      data: { data: ReturnType<typeof getEmptyTokenData> };
    }>();
    fetchTokenListMock.mockImplementationOnce(() => olderResponse.promise);
    // A non-Home refresh is never retired, so its late response still reaches
    // storage after the Home request that started later.
    const older = service.fetchAccountTokens({
      ...fetchParams(),
      homeRequest: undefined,
      saveToLocal: true,
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(fetchTokenListMock).toHaveBeenCalledTimes(1);

    await service.fetchAccountTokens({
      ...fetchParams(),
      saveToLocal: true,
    });
    olderResponse.resolve({ data: { data: getEmptyTokenData() } });
    await older;

    const writes = api.simpleDb.localTokens.updateAccountTokenList.mock.calls;
    // Storage drops the second write because its order precedes the first.
    expect(
      writes.map(([params]) => (params as { writeOrder?: number }).writeOrder),
    ).toEqual([2, 1]);
  });

  it('persists completed Home snapshots even when their request is retired', async () => {
    jest.useFakeTimers();
    try {
      service._currentNetworkId = getNetworkIdsMap().onekeyall;
      await service.fetchAccountTokens({
        ...fetchParams(),
        isAllNetworks: true,
        saveToLocal: true,
      });
      await service.invalidateHomeTokenRequests(token(2));
      await jest.advanceTimersByTimeAsync(3000);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache,
      ).toHaveBeenCalledTimes(1);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache.mock.calls[0],
      ).toEqual([
        expect.objectContaining({
          tokenListValue: { 'evm--1_fixture-address': '0' },
        }),
      ]);
      await service.fetchAccountTokens({
        ...fetchParams(),
        homeRequest: token(3),
        isAllNetworks: true,
        saveToLocal: true,
      });
      await jest.advanceTimersByTimeAsync(3000);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache,
      ).toHaveBeenCalledTimes(2);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache.mock.calls[1],
      ).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('persists completed snapshots from both owners in one trailing batch', async () => {
    jest.useFakeTimers();
    try {
      service._currentNetworkId = getNetworkIdsMap().onekeyall;
      await service.fetchAccountTokens({
        ...fetchParams(),
        isAllNetworks: true,
        saveToLocal: true,
      });
      api.serviceAccount.getAccountAddressForApi.mockResolvedValue(
        'next-address',
      );
      await service.fetchAccountTokens({
        ...fetchParams(),
        accountId: 'next-account',
        homeRequest: { ...token(2), ownerKey: 'next-owner' },
        isAllNetworks: true,
        saveToLocal: true,
      });
      await jest.advanceTimersByTimeAsync(3000);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache,
      ).toHaveBeenCalledTimes(1);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache.mock.calls[0],
      ).toEqual([
        expect.objectContaining({
          tokenListValue: {
            'evm--1_fixture-address': '0',
            'evm--1_next-address': '0',
          },
        }),
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not let completion of a detached old flush clear a newer pending cache', async () => {
    jest.useFakeTimers();
    try {
      service._currentNetworkId = getNetworkIdsMap().onekeyall;
      const oldWrite = deferred<void>();
      api.simpleDb.localTokens.updateAccountTokenListByCache.mockReturnValueOnce(
        oldWrite.promise,
      );
      await service.fetchAccountTokens({
        ...fetchParams(),
        isAllNetworks: true,
        saveToLocal: true,
      });
      jest.advanceTimersByTime(3000);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache,
      ).toHaveBeenCalledTimes(1);
      await service.invalidateHomeTokenRequests(token(2));
      await service.fetchAccountTokens({
        ...fetchParams(),
        homeRequest: token(3),
        isAllNetworks: true,
        saveToLocal: true,
      });
      oldWrite.resolve();
      await jest.advanceTimersByTimeAsync(3000);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache,
      ).toHaveBeenCalledTimes(2);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache.mock.calls[1],
      ).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('observes trailing persistence failures and allows the next batch to flush', async () => {
    jest.useFakeTimers();
    const errorLog = jest.spyOn(defaultLogger.app.error, 'log');
    try {
      service._currentNetworkId = getNetworkIdsMap().onekeyall;
      api.simpleDb.localTokens.updateAccountTokenListByCache.mockRejectedValueOnce(
        new OneKeyLocalError('storage unavailable'),
      );
      await service.fetchAccountTokens({
        ...fetchParams(),
        isAllNetworks: true,
        saveToLocal: true,
      });
      await jest.advanceTimersByTimeAsync(3000);
      expect(errorLog).toHaveBeenCalledWith(
        'Home token cache persistence failed: storage unavailable',
      );
      await service.fetchAccountTokens({
        ...fetchParams(),
        homeRequest: token(2),
        isAllNetworks: true,
        saveToLocal: true,
      });
      await jest.advanceTimersByTimeAsync(3000);
      expect(
        api.simpleDb.localTokens.updateAccountTokenListByCache,
      ).toHaveBeenCalledTimes(2);
    } finally {
      errorLog.mockRestore();
      jest.useRealTimers();
    }
  });

  it('reads one cache snapshot, preserves ordered partial failures, and sends no Home token to the network', async () => {
    api.simpleDb.localTokens.getAccountTokenList.mockRejectedValueOnce(
      new OneKeyLocalError('fixture read failed'),
    );
    const result = await service.getAccountsLocalTokens({
      homeRequest: token(1),
      accounts: [
        { accountId: 'a', networkId: 'evm--1', accountAddress: 'fixture-a' },
        { accountId: 'b', networkId: 'evm--1', accountAddress: 'fixture-b' },
      ],
    });
    expect(api.simpleDb.localTokens.getRawData).toHaveBeenCalledTimes(1);
    expect(result[0]).toBeNull();
    expect(result[1]).toMatchObject({ accountId: 'b', hasCache: true });
    expect(
      api.simpleDb.localTokens.getAccountTokenList.mock.calls[0][0]
        .simpleDbLocalTokensRawData,
    ).toBe(
      api.simpleDb.localTokens.getAccountTokenList.mock.calls[1][0]
        .simpleDbLocalTokensRawData,
    );
    await service.fetchAccountTokens(fetchParams());
    expect(
      fetchTokenListMock.mock.calls[0][0].requestApiParams,
    ).not.toHaveProperty('homeRequest');
  });

  it('rejects a batch invalidated during reading instead of converting cancellation into null success', async () => {
    const read = deferred<null>();
    api.simpleDb.localTokens.getRawData.mockReturnValue(read.promise);
    const pending = service.getAccountsLocalTokens({
      homeRequest: token(1),
      accounts: [{ accountId: 'a', networkId: 'evm--1' }],
    });
    const rejected = (async () => {
      await expect(pending).rejects.toMatchObject({ name: 'CanceledError' });
    })();
    await service.invalidateHomeTokenRequests(token(2));
    read.resolve(null);
    await rejected;
    expect(api.simpleDb.localTokens.getAccountTokenList).not.toHaveBeenCalled();
  });

  it('rejects a batch invalidated during an account read after allSettled', async () => {
    const read = deferred<unknown>();
    const started = deferred<void>();
    api.simpleDb.localTokens.getAccountTokenList.mockImplementation(() => {
      started.resolve();
      return read.promise;
    });
    const pending = service.getAccountsLocalTokens({
      homeRequest: token(1),
      accounts: [
        { accountId: 'a', networkId: 'evm--1', accountAddress: 'fixture' },
      ],
    });
    const rejected = (async () => {
      await expect(pending).rejects.toMatchObject({ name: 'CanceledError' });
    })();
    await started.promise;
    await service.invalidateHomeTokenRequests(token(2));
    read.resolve({});
    await rejected;
  });

  it('drops stale or mismatched VM input before frame production and accepts the current owner', async () => {
    const vm = new ServiceTokenViewModel({ backgroundApi: api });
    const params: IIngestRoundParams = {
      homeRequest: token(1),
      ownerKey: 'home-owner',
      orderedTokens: [],
      smallBalanceTokens: [],
      tokenListMap: {},
      aggregateTokensMap: {},
      smallBalanceFiatValue: '0',
      storeData: {
        storeName: 'homeTokenList',
      } as IIngestRoundParams['storeData'],
      keepDefault: false,
      homeDefaultTokenMap: {},
      customTokens: [],
    };
    await service.getAccountsLocalTokens({
      homeRequest: token(1),
      accounts: [],
    });
    await expect(
      vm.ingestRound({ ...params, ownerKey: 'wrong-owner' }),
    ).rejects.toMatchObject({ name: 'CanceledError' });
    expect(emitMock).not.toHaveBeenCalled();
    await vm.ingestRound(params);
    expect(emitMock).toHaveBeenCalled();
    emitMock.mockClear();
    await service.invalidateHomeTokenRequests(token(2));
    await expect(vm.ingestRound(params)).rejects.toMatchObject({
      name: 'CanceledError',
    });
    expect(emitMock).not.toHaveBeenCalled();
  });
});
