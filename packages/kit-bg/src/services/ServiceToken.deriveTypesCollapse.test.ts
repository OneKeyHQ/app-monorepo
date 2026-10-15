import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import ServiceToken from './ServiceToken';

import type { IAccountTokenListCache } from '../dbs/simple/entity/SimpleDbEntityLocalTokens';

/*
yarn jest packages/kit-bg/src/services/ServiceToken.deriveTypesCollapse.test.ts
*/

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
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), emit: jest.fn() },
}));
jest.mock('../states/jotai/atoms', () => ({
  settingsPersistAtom: { get: jest.fn() },
  currencyPersistAtom: { get: jest.fn() },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));
jest.mock('../vaults/settings', () => ({ getVaultSettings: jest.fn() }));

const BTC = getNetworkIdsMap().btc;
const INDEXED_ACCOUNT_ID = 'hd-1--0';
const DERIVE_TYPES = ['BIP86', 'default', 'BIP84', 'BIP44'];
const NOT_COLLAPSED = { collapsed: false };

// Per key: whether the complete response held any amount.
type ILocalRecords = Record<string, boolean>;

function keyOf(deriveType: string) {
  return `${BTC}_xpub-${deriveType}`.toLowerCase();
}

function networkAccountOf(deriveType: string) {
  return {
    deriveType,
    deriveInfo: { label: deriveType },
    account: {
      id: `account-${deriveType}`,
      address: `address-${deriveType}`,
      // Nested SegWit keeps the xpub its balances are stored under in
      // `xpubSegwit`.
      ...(deriveType === 'default'
        ? { xpub: 'xpub-raw', xpubSegwit: `xpub-${deriveType}` }
        : { xpub: `xpub-${deriveType}` }),
    },
  };
}

function collapsedOn(deriveType: string) {
  return {
    collapsed: true,
    defaultNetworkAccount: networkAccountOf(deriveType),
  };
}

function buildCache(
  records: ILocalRecords,
  writeOrder?: number,
): IAccountTokenListCache {
  const keys = Object.keys(records);
  return {
    tokenList: Object.fromEntries(keys.map((key) => [key, []])),
    smallBalanceTokenList: {},
    riskyTokenList: {},
    tokenListValue: {},
    // Capped lists: never consulted for assets.
    tokenListMap: Object.fromEntries(keys.map((key) => [key, {}])),
    tokenListCurrency: {},
    tokenListHasAssets: records,
    ...(writeOrder === undefined
      ? undefined
      : {
          tokenListWriteOrder: Object.fromEntries(
            keys.map((key) => [key, writeOrder]),
          ),
        }),
  };
}

type IPendingCaches = {
  homeLocalAccountTokensCache?: IAccountTokenListCache;
  homeLocalAccountTokensFlushing?: Set<IAccountTokenListCache>;
  localAccountTokensCache?: IAccountTokenListCache;
};

function emptyRecords(deriveTypes: string[] = DERIVE_TYPES): ILocalRecords {
  return Object.fromEntries(
    deriveTypes.map((deriveType) => [keyOf(deriveType), false]),
  );
}

function makeService({
  defaultDeriveType = 'BIP86',
  missingAccountDeriveTypes = [],
  storedRecords = emptyRecords(),
  storedSource = buildCache(storedRecords),
  pendingRecords,
  pendingCaches,
  staleKeys = [],
}: {
  defaultDeriveType?: string;
  missingAccountDeriveTypes?: string[];
  storedRecords?: ILocalRecords;
  storedSource?: Partial<IAccountTokenListCache>;
  // Responses still waiting for the debounced write.
  pendingRecords?: ILocalRecords;
  pendingCaches?: IPendingCaches;
  // Pending entries older than what storage already committed.
  staleKeys?: string[];
} = {}) {
  const api = {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: jest.fn(async () => defaultDeriveType),
    },
    serviceAccount: {
      getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes: jest.fn(
        async () => ({
          networkAccounts: DERIVE_TYPES.map((deriveType) => ({
            ...networkAccountOf(deriveType),
            ...(missingAccountDeriveTypes.includes(deriveType)
              ? { account: undefined }
              : undefined),
          })),
        }),
      ),
    },
    simpleDb: {
      localTokens: {
        getRawData: jest.fn(async () => storedSource),
        // Async like every entity method behind the lazy service proxy.
        isStaleAccountTokenListCacheEntry: jest.fn(
          async ({ key }: { key: string }) => staleKeys.includes(key),
        ),
      },
    },
  };
  const service = new ServiceToken({ backgroundApi: api } as never);
  if (pendingRecords) {
    (
      service as unknown as {
        homeLocalAccountTokensCache: IAccountTokenListCache;
      }
    ).homeLocalAccountTokensCache = buildCache(pendingRecords);
  }
  if (pendingCaches) {
    Object.assign(service as unknown as IPendingCaches, pendingCaches);
  }
  const getState = (networkId: string = BTC) =>
    service.getDeriveTypesCollapseState({
      networkId,
      indexedAccountId: INDEXED_ACCOUNT_ID,
    });
  return { api, service, getState };
}

describe('ServiceToken.getDeriveTypesCollapseState', () => {
  it('collapses when no other type holds assets', async () => {
    const { getState } = makeService({
      storedRecords: {
        ...emptyRecords(),
        [keyOf('BIP86')]: true,
      },
    });
    await expect(getState()).resolves.toEqual(collapsedOn('BIP86'));
  });

  it('keeps every type when another type holds assets', async () => {
    const { getState } = makeService({
      storedRecords: {
        ...emptyRecords(),
        [keyOf('default')]: true,
      },
    });
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
  });

  it('reads the Nested SegWit record under its segwit xpub', async () => {
    const { getState } = makeService({
      defaultDeriveType: 'default',
      storedRecords: {
        ...emptyRecords(),
        [keyOf('default')]: true,
      },
    });
    await expect(getState()).resolves.toEqual(collapsedOn('default'));
  });

  it('treats a type that was never read as unknown, not empty', async () => {
    const { getState } = makeService({
      storedRecords: emptyRecords(['BIP86', 'default', 'BIP84']),
    });
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
  });

  it('uses a response still waiting to be persisted', async () => {
    const { getState } = makeService({
      storedRecords: {},
      pendingRecords: emptyRecords(),
    });
    await expect(getState()).resolves.toEqual(collapsedOn('BIP86'));
  });

  it('prefers a pending response over what storage holds', async () => {
    const { getState } = makeService({
      pendingRecords: { [keyOf('BIP44')]: true },
    });
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
  });

  it('reads every Home batch while it is being written to storage', async () => {
    const { getState } = makeService({
      pendingCaches: {
        // An older write still running when a newer batch started its own.
        homeLocalAccountTokensFlushing: new Set([
          buildCache({ [keyOf('BIP44')]: true }, 1),
          buildCache({ [keyOf('BIP84')]: false }, 2),
        ]),
      },
    });
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
  });

  it('ignores a pending response that storage has already superseded', async () => {
    const { getState } = makeService({
      storedRecords: {
        ...emptyRecords(),
        [keyOf('BIP44')]: true,
      },
      pendingRecords: { [keyOf('BIP44')]: false },
      staleKeys: [keyOf('BIP44')],
    });
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
  });

  it('reads storage after dropping a pending response a newer write superseded', async () => {
    let stored = buildCache(emptyRecords());
    const { api, getState } = makeService({
      pendingRecords: { [keyOf('BIP44')]: true },
    });
    api.simpleDb.localTokens.getRawData.mockImplementation(async () => stored);
    // A newer write with assets commits while the pending entry is checked.
    api.simpleDb.localTokens.isStaleAccountTokenListCacheEntry.mockImplementation(
      async ({ key }) => {
        stored = buildCache({ ...emptyRecords(), [keyOf('BIP44')]: true });
        return key === keyOf('BIP44');
      },
    );
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
  });

  it('prefers the newest of several pending responses', async () => {
    const { getState } = makeService({
      pendingCaches: {
        homeLocalAccountTokensCache: buildCache({ [keyOf('BIP44')]: false }, 1),
        localAccountTokensCache: buildCache({ [keyOf('BIP44')]: true }, 2),
      },
    });
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
  });

  it('treats a record saved without the has-assets flag as unknown', async () => {
    const { getState } = makeService({
      // Saved by an earlier version: lists and balances, no flag.
      storedSource: { ...buildCache(emptyRecords()), tokenListHasAssets: {} },
    });
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
  });

  it('skips reading balances when a type has no account yet', async () => {
    const { api, getState } = makeService({
      missingAccountDeriveTypes: ['BIP44'],
    });
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
    expect(api.simpleDb.localTokens.getRawData).not.toHaveBeenCalled();
  });

  it('never collapses an account without an indexed account id', async () => {
    const { api, service } = makeService();
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: undefined,
      }),
    ).resolves.toEqual(NOT_COLLAPSED);
    expect(
      api.serviceNetwork.getGlobalDeriveTypeOfNetwork,
    ).not.toHaveBeenCalled();
  });

  it('never collapses on networks outside the supported list', async () => {
    const { api, getState } = makeService();
    await expect(getState(getNetworkIdsMap().ltc)).resolves.toEqual(
      NOT_COLLAPSED,
    );
    expect(
      api.serviceNetwork.getGlobalDeriveTypeOfNetwork,
    ).not.toHaveBeenCalled();
  });

  it('falls back to not collapsed when a lookup fails', async () => {
    const { api, getState } = makeService();
    api.simpleDb.localTokens.getRawData.mockRejectedValueOnce(
      new Error('read failed'),
    );
    await expect(getState()).resolves.toEqual(NOT_COLLAPSED);
  });
});

describe('ServiceToken.getDefaultDeriveTypeAccountId', () => {
  const resolve = (
    service: ServiceToken,
    networkId: string,
    accountId: string,
  ) =>
    service.getDefaultDeriveTypeAccountId({
      networkId,
      indexedAccountId: INDEXED_ACCOUNT_ID,
      accountId,
    });

  it('uses the default type account while collapsed', async () => {
    const { service } = makeService();
    await expect(resolve(service, BTC, 'account-BIP44')).resolves.toBe(
      'account-BIP86',
    );
  });

  it('uses the default type account when another type holds assets too', async () => {
    const { service } = makeService({
      storedRecords: {
        ...emptyRecords(),
        [keyOf('BIP44')]: true,
      },
    });
    await expect(resolve(service, BTC, 'account-BIP44')).resolves.toBe(
      'account-BIP86',
    );
  });

  it('follows a default type the user switched to', async () => {
    const { service } = makeService({ defaultDeriveType: 'BIP84' });
    await expect(resolve(service, BTC, 'account-BIP44')).resolves.toBe(
      'account-BIP84',
    );
  });

  it('keeps the given account when the default type has no account', async () => {
    const { service } = makeService({ missingAccountDeriveTypes: ['BIP86'] });
    await expect(resolve(service, BTC, 'account-BIP44')).resolves.toBe(
      'account-BIP44',
    );
  });

  it('keeps an account that is not an address type of this indexed account', async () => {
    const { service } = makeService();
    await expect(resolve(service, BTC, 'imported-account')).resolves.toBe(
      'imported-account',
    );
    await expect(resolve(service, BTC, 'hd-2--account-BIP44')).resolves.toBe(
      'hd-2--account-BIP44',
    );
  });

  it('keeps the given account on other networks and without an indexed account', async () => {
    const { service } = makeService();
    await expect(
      resolve(service, getNetworkIdsMap().ltc, 'account-ltc'),
    ).resolves.toBe('account-ltc');
    await expect(
      service.getDefaultDeriveTypeAccountId({
        networkId: BTC,
        indexedAccountId: undefined,
        accountId: 'imported-account',
      }),
    ).resolves.toBe('imported-account');
  });
});
