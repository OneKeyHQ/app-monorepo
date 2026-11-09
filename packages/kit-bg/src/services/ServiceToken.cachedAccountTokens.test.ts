import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
  ITokenData,
} from '@onekeyhq/shared/types/token';

import { vaultFactory } from '../vaults/factory';

import ServiceToken from './ServiceToken';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  backgroundMethodForDev:
    () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
      d,
  checkDevOnlyPassword: jest.fn(),
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { MemoryPressureWarning: 'MemoryPressureWarning' },
  appEventBus: { on: jest.fn() },
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
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const scope = {
  accountId: 'account',
  networkId: 'evm--1',
  accountAddress: '0xaccount',
};

function token(
  key: string,
  overrides: Partial<IAccountToken> = {},
): IAccountToken {
  return {
    $key: key,
    address: `0x${key}`,
    name: key,
    symbol: key,
    decimals: 18,
    isNative: false,
    ...overrides,
  };
}

function group(data: IAccountToken[]): ITokenData {
  return {
    data,
    keys: data.map((item) => item.$key).join(','),
    map: Object.fromEntries(
      data.map((item) => [
        item.$key,
        {
          balance: '1',
          balanceParsed: '1',
          fiatValue: '1',
          price: 1,
        },
      ]),
    ),
  };
}

function response(key = 'wallet'): IFetchAccountTokensResp {
  return {
    tokens: group([token(key)]),
    smallBalanceTokens: group([]),
    riskTokens: group([]),
  };
}

function setup() {
  const api = {
    serviceAccount: {
      getAccountXpub: jest.fn().mockResolvedValue(undefined),
      getAccountAddressForApi: jest
        .fn()
        .mockResolvedValue(scope.accountAddress),
      buildAccountXpubOrAddress: jest
        .fn()
        .mockResolvedValue(scope.accountAddress),
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
    simpleDb: {
      localTokens: {
        reserveAccountTokenListWriteOrder: jest.fn().mockResolvedValue(1),
        updateAccountTokenList: jest.fn().mockResolvedValue(undefined),
        clearTokens: jest.fn().mockResolvedValue(undefined),
      },
    },
  };
  const service = new ServiceToken({ backgroundApi: api });
  const fetchTokenList = jest.fn(async () => ({ data: { data: response() } }));
  jest
    .mocked(vaultFactory.getVault)
    .mockResolvedValue({ fetchTokenList } as unknown as Awaited<
      ReturnType<typeof vaultFactory.getVault>
    >);
  const local = jest
    .spyOn(service, 'getAccountsLocalTokens')
    .mockResolvedValue([]);
  return { api, service, fetchTokenList, local };
}

describe('ServiceToken display token snapshots', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('keeps the normalized complete response before the 50-token persistence cap', async () => {
    const { service, api, fetchTokenList, local } = setup();
    const raw: IFetchAccountTokensResp = {
      tokens: group([
        token('native', { isNative: true }),
        token('dapp', { dappName: 'protocol' }),
      ]),
      smallBalanceTokens: group(
        Array.from({ length: 60 }, (_, index) => token(`dust-${index}`)),
      ),
      riskTokens: group([token('risk')]),
      allTokens: group([token('redundant')]),
    };
    fetchTokenList.mockResolvedValueOnce({ data: { data: raw } });
    const live = await service.fetchAccountTokens({
      ...scope,
      flag: 'home-token-list',
      withoutDappToken: true,
      saveToLocal: true,
    });
    const [cached] = await service.getCachedAccountTokens({
      accounts: [scope],
    });
    expect(
      api.simpleDb.localTokens.updateAccountTokenList,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenList: expect.any(Array),
        smallBalanceTokenList: expect.any(Array),
      }),
    );
    const saved =
      api.simpleDb.localTokens.updateAccountTokenList.mock.calls[0][0];
    expect(
      saved.tokenList.length +
        saved.smallBalanceTokenList.length +
        saved.riskyTokenList.length,
    ).toBe(50);
    expect(cached?.smallBalanceTokens.data).toHaveLength(60);
    expect(cached?.tokens.data.map((item) => item.$key)).toEqual(['native']);
    expect(cached?.tokens.currency).toBe('usd');
    expect(cached).toMatchObject({
      ...scope,
      source: 'home-token-list',
      coverage: 'partial',
      capturedAt: expect.any(Number),
    });
    expect(cached).not.toHaveProperty('allTokens');
    expect(local).not.toHaveBeenCalled();
    live.smallBalanceTokens.data[0].symbol = 'MUTATED';
    expect(
      (await service.getCachedAccountTokens({ accounts: [scope] }))[0]
        ?.smallBalanceTokens.data[0].symbol,
    ).toBe('dust-0');
    expect(JSON.parse(JSON.stringify(cached))).toEqual(cached);
  });

  it('batches only memory misses, keeps ordering, and isolates persisted group maps', async () => {
    const { service, local } = setup();
    await service.fetchAccountTokens({ ...scope, flag: 'dust-sweep' });
    const missing = { ...scope, accountId: 'persisted-account' };
    const absent = { ...scope, accountId: 'absent-account' };
    const wallet = token('persisted-wallet');
    const risk = token('persisted-risk');
    const values = group([wallet, risk]).map;
    local.mockResolvedValueOnce([
      {
        ...missing,
        tokenList: [wallet],
        smallBalanceTokenList: [],
        riskyTokenList: [risk],
        tokenListMap: values,
        tokenListValue: '2',
        currency: 'usd',
        hasCache: true,
      },
      null,
    ]);
    const result = await service.getCachedAccountTokens({
      accounts: [missing, scope, absent],
    });
    expect(local).toHaveBeenCalledWith({ accounts: [missing, absent] });
    expect(result.map((item) => item?.accountId ?? null)).toEqual([
      missing.accountId,
      scope.accountId,
      null,
    ]);
    expect(result[0]).toMatchObject({
      source: 'persisted',
      coverage: 'partial',
    });
    expect(result[0]?.capturedAt).toBeUndefined();
    expect(Object.keys(result[0]?.tokens.map ?? {})).toEqual([wallet.$key]);
    expect(result[0]?.smallBalanceTokens.map).toEqual({});
    expect(Object.keys(result[0]?.riskTokens.map ?? {})).toEqual([risk.$key]);
    if (!result[0]) throw new OneKeyLocalError('Missing cache fixture');
    result[0].tokens.data[0].symbol = 'MUTATED';
    expect(wallet.symbol).toBe('persisted-wallet');
  });

  it('keeps known-empty persisted results partial and missing results absent', async () => {
    const { service, local } = setup();
    local.mockResolvedValueOnce([
      {
        ...scope,
        tokenList: [],
        smallBalanceTokenList: [],
        riskyTokenList: [],
        tokenListMap: {},
        tokenListValue: '0',
        currency: 'usd',
        hasCache: true,
      },
    ]);
    expect(
      (await service.getCachedAccountTokens({ accounts: [scope] }))[0],
    ).toMatchObject({ coverage: 'partial', tokens: { data: [] } });
    local.mockResolvedValueOnce([
      {
        ...scope,
        tokenList: [],
        smallBalanceTokenList: [],
        riskyTokenList: [],
        tokenListMap: {},
        tokenListValue: '0',
        currency: 'usd',
        hasCache: false,
      },
    ]);
    expect(await service.getCachedAccountTokens({ accounts: [scope] })).toEqual(
      [null],
    );
  });

  it('keeps memory hits if optional persistence is unavailable', async () => {
    const { service, local } = setup();
    await service.fetchAccountTokens({ ...scope, flag: 'dust-sweep' });
    local.mockRejectedValueOnce(new Error('disk unavailable'));
    const result = await service.getCachedAccountTokens({
      accounts: [scope, { ...scope, accountId: 'missing' }],
    });
    expect(result[0]?.source).toBe('dust-sweep');
    expect(result[1]).toBeNull();
  });

  it('does not publish a canceled response, including cancellation during persistence', async () => {
    const { service, api } = setup();
    const write = deferred<void>();
    const writing = deferred<void>();
    api.simpleDb.localTokens.updateAccountTokenList.mockImplementationOnce(
      () => {
        writing.resolve();
        return write.promise;
      },
    );
    const load = service.fetchAccountTokens({
      ...scope,
      flag: 'home-token-list',
      saveToLocal: true,
    });
    await writing.promise;
    const rejected = (async () => {
      await expect(load).rejects.toMatchObject({ name: 'CanceledError' });
    })();
    await service.abortFetchAccountTokens({
      includedFlags: ['home-token-list'],
    });
    write.resolve();
    await rejected;
    expect(await service.getCachedAccountTokens({ accounts: [scope] })).toEqual(
      [null],
    );
  });

  it('reserves before preflight and prevents old requests restoring a manually invalidated snapshot', async () => {
    const { service, api, fetchTokenList } = setup();
    await service.fetchAccountTokens({ ...scope, flag: 'home-token-list' });
    const address = deferred<string>();
    api.serviceAccount.getAccountAddressForApi.mockReturnValueOnce(
      address.promise,
    );
    const old = service.fetchAccountTokens({
      ...scope,
      flag: 'home-token-list',
    });
    fetchTokenList.mockRejectedValueOnce(new Error('refresh failed'));
    const refresh = service.fetchAccountTokens({
      ...scope,
      flag: 'dust-sweep',
      isManualRefresh: true,
    });
    const rejected = (async () => {
      await expect(refresh).rejects.toThrow('refresh failed');
    })();
    expect(await service.getCachedAccountTokens({ accounts: [scope] })).toEqual(
      [null],
    );
    await rejected;
    address.resolve(scope.accountAddress);
    await old;
    expect(await service.getCachedAccountTokens({ accounts: [scope] })).toEqual(
      [null],
    );
    await service.fetchAccountTokens({ ...scope, flag: 'dust-sweep' });
    expect(
      (await service.getCachedAccountTokens({ accounts: [scope] }))[0]?.source,
    ).toBe('dust-sweep');
  });

  it('never changes live fetch behavior on cache hits or captures unrelated selector queries', async () => {
    const { service, fetchTokenList } = setup();
    await service.fetchAccountTokens({ ...scope, flag: 'token-selector' });
    expect(await service.getCachedAccountTokens({ accounts: [scope] })).toEqual(
      [null],
    );
    await service.fetchAccountTokens({ ...scope, flag: 'dust-sweep' });
    await service.fetchAccountTokens({ ...scope, flag: 'dust-sweep' });
    expect(fetchTokenList).toHaveBeenCalledTimes(3);
  });

  it('clears snapshots with persisted caches and critical memory pressure', async () => {
    const listener = jest.spyOn(appEventBus, 'on');
    const { service, api } = setup();
    await service.fetchAccountTokens({ ...scope, flag: 'dust-sweep' });
    await service.clearLocalTokens();
    expect(api.simpleDb.localTokens.clearTokens).toHaveBeenCalledTimes(1);
    expect(await service.getCachedAccountTokens({ accounts: [scope] })).toEqual(
      [null],
    );
    await service.fetchAccountTokens({ ...scope, flag: 'dust-sweep' });
    const callback = listener.mock.calls[0][1];
    callback({ level: 'critical' });
    expect(await service.getCachedAccountTokens({ accounts: [scope] })).toEqual(
      [null],
    );
  });
});
