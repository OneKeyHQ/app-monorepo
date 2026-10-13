import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

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

type ILocalRecords = Record<string, Record<string, ITokenFiat>>;

function fiat(balance: string): ITokenFiat {
  return { balance, balanceParsed: balance, fiatValue: '0', price: 0 };
}

function keyOf(deriveType: string) {
  return `${BTC}_xpub-${deriveType}`.toLowerCase();
}

function buildCache(records: ILocalRecords): IAccountTokenListCache {
  const keys = Object.keys(records);
  return {
    tokenList: Object.fromEntries(keys.map((key) => [key, []])),
    smallBalanceTokenList: {},
    riskyTokenList: {},
    tokenListValue: {},
    tokenListMap: records,
    tokenListCurrency: {},
  };
}

function emptyRecords(deriveTypes: string[] = DERIVE_TYPES): ILocalRecords {
  return Object.fromEntries(
    deriveTypes.map((deriveType) => [keyOf(deriveType), {}]),
  );
}

function makeService({
  defaultDeriveType = 'BIP86',
  missingAccountDeriveTypes = [],
  storedRecords = emptyRecords(),
}: {
  defaultDeriveType?: string;
  missingAccountDeriveTypes?: string[];
  storedRecords?: ILocalRecords;
} = {}) {
  const api = {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: jest.fn(async () => defaultDeriveType),
    },
    serviceAccount: {
      getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes: jest.fn(
        async () => ({
          networkAccounts: DERIVE_TYPES.map((deriveType) => ({
            deriveType,
            account: missingAccountDeriveTypes.includes(deriveType)
              ? undefined
              : { id: `account-${deriveType}` },
          })),
        }),
      ),
      getAccountXpub: jest.fn(async ({ accountId }: { accountId: string }) =>
        accountId.replace('account-', 'xpub-'),
      ),
      getAccountAddressForApi: jest.fn(async () => ''),
    },
    simpleDb: {
      localTokens: {
        getRawData: jest.fn(async () => buildCache(storedRecords)),
      },
    },
  };
  const service = new ServiceToken({ backgroundApi: api } as never);
  return { api, service };
}

describe('ServiceToken.getDeriveTypesCollapseState', () => {
  it('collapses when no other type holds assets', async () => {
    const { service } = makeService({
      storedRecords: {
        ...emptyRecords(),
        [keyOf('BIP86')]: { native: fiat('12500') },
      },
    });
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: INDEXED_ACCOUNT_ID,
      }),
    ).resolves.toEqual({ collapsed: true, defaultDeriveType: 'BIP86' });
  });

  it('keeps every type when another type holds assets', async () => {
    const { service } = makeService({
      storedRecords: {
        ...emptyRecords(),
        [keyOf('default')]: { native: fiat('3100') },
      },
    });
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: INDEXED_ACCOUNT_ID,
      }),
    ).resolves.toEqual({ collapsed: false, defaultDeriveType: 'BIP86' });
  });

  it('reads the Nested SegWit record under its own key', async () => {
    const { service } = makeService({
      defaultDeriveType: 'default',
      storedRecords: {
        ...emptyRecords(),
        [keyOf('default')]: { native: fiat('3100') },
      },
    });
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: INDEXED_ACCOUNT_ID,
      }),
    ).resolves.toEqual({ collapsed: true, defaultDeriveType: 'default' });
  });

  it('treats a type that was never read as unknown, not empty', async () => {
    const { service } = makeService({
      storedRecords: emptyRecords(['BIP86', 'default', 'BIP84']),
    });
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: INDEXED_ACCOUNT_ID,
      }),
    ).resolves.toEqual({ collapsed: false, defaultDeriveType: 'BIP86' });
  });

  it('uses a response still waiting to be persisted', async () => {
    const { service } = makeService({ storedRecords: {} });
    (
      service as unknown as {
        homeLocalAccountTokensCache: IAccountTokenListCache;
      }
    ).homeLocalAccountTokensCache = buildCache(emptyRecords());
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: INDEXED_ACCOUNT_ID,
      }),
    ).resolves.toEqual({ collapsed: true, defaultDeriveType: 'BIP86' });
  });

  it('prefers a pending response over what storage holds', async () => {
    const { service } = makeService();
    (
      service as unknown as {
        homeLocalAccountTokensCache: IAccountTokenListCache;
      }
    ).homeLocalAccountTokensCache = buildCache({
      [keyOf('BIP44')]: { native: fiat('546') },
    });
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: INDEXED_ACCOUNT_ID,
      }),
    ).resolves.toEqual({ collapsed: false, defaultDeriveType: 'BIP86' });
  });

  it('skips reading balances when a type has no account yet', async () => {
    const { api, service } = makeService({
      missingAccountDeriveTypes: ['BIP44'],
    });
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: INDEXED_ACCOUNT_ID,
      }),
    ).resolves.toEqual({ collapsed: false, defaultDeriveType: 'BIP86' });
    expect(api.simpleDb.localTokens.getRawData).not.toHaveBeenCalled();
  });

  it('never collapses an account without an indexed account id', async () => {
    const { api, service } = makeService();
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: undefined,
      }),
    ).resolves.toEqual({ collapsed: false, defaultDeriveType: undefined });
    expect(
      api.serviceNetwork.getGlobalDeriveTypeOfNetwork,
    ).not.toHaveBeenCalled();
  });

  it('never collapses on networks outside the supported list', async () => {
    const { api, service } = makeService();
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: getNetworkIdsMap().ltc,
        indexedAccountId: INDEXED_ACCOUNT_ID,
      }),
    ).resolves.toEqual({ collapsed: false, defaultDeriveType: undefined });
    expect(
      api.serviceNetwork.getGlobalDeriveTypeOfNetwork,
    ).not.toHaveBeenCalled();
  });

  it('falls back to not collapsed when a lookup fails', async () => {
    const { api, service } = makeService();
    api.serviceAccount.getAccountXpub.mockRejectedValueOnce(
      new Error('lookup failed'),
    );
    await expect(
      service.getDeriveTypesCollapseState({
        networkId: BTC,
        indexedAccountId: INDEXED_ACCOUNT_ID,
      }),
    ).resolves.toEqual({ collapsed: false, defaultDeriveType: 'BIP86' });
  });
});
