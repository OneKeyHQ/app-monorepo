import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_IMPORTED,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import ServiceAccountSelector from './ServiceAccountSelector';

import type { IDBAccount, IDBWallet } from '../dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '../dbs/simple/entity/SimpleDbEntityAccountSelector';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('../states/jotai/atoms', () => ({
  settingsAtom: {
    get: jest.fn(async () => ({ swapToAnotherAccountSwitchOn: false })),
  },
}));

jest.mock('../vaults/settings', () => ({
  getVaultSettings: jest.fn(),
}));

// Defensive boundary: nothing in this suite reaches localDb today, but any
// future test touching the lazily imported accountSelectorPerpsWorth segment
// (or any other localDb-importing dependency) would otherwise execute
// localDbInstance's module-level `new LocalDbIndexed()` under
// jest-environment-node (no indexedDB), whose un-awaited `_openDb()` becomes
// a dangling rejection that hard-crashes the whole Jest worker after the
// last test passes.
jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });

  return {
    defaultLogger: noopLogger,
  };
});

const BTC_ACCOUNT_ID =
  'imported--0--xpub6CgTVumLgde7C8aBr9Zfbn6LeJN347raED9oW6ZCfbwEqeQodRGLUvrjK3ec3uNbGYxMcxRJ5Q5grxip4Bd5XWmnai12tkdTLkTepQiAdnR--P2TR';

const btcAccount = {
  id: BTC_ACCOUNT_ID,
  name: 'BTC private key',
  impl: 'btc',
  createAtNetwork: 'btc--0',
  networks: ['btc--0'],
} as IDBAccount;

const EVM_ACCOUNT_ID =
  'imported--60--0x9403a0ec47a062f82d2ac402394eecb61a030d57';

const evmDbAccount = {
  id: EVM_ACCOUNT_ID,
  name: 'EVM private key',
  impl: 'evm',
  createAtNetwork: 'evm--137',
  networks: ['evm--137'],
} as IDBAccount;

const evmNetworkAccount = {
  id: EVM_ACCOUNT_ID,
  name: 'EVM private key',
  impl: 'evm',
  address: '0x9403a0ec47a062f82d2ac402394eecb61a030d57',
} as INetworkAccount;

const HD_WALLET_ID = 'hd-1';
const HD_INDEXED_ACCOUNT_ID = `${HD_WALLET_ID}--0`;
const allNetworksMockAccount = {
  id: `${HD_WALLET_ID}--0000/0`,
  indexedAccountId: HD_INDEXED_ACCOUNT_ID,
  name: 'Account #1',
  impl: 'all',
  address: 'all-network-mock-address',
} as INetworkAccount;

function buildAllNetworksService({
  accounts,
  walletOverrides,
}: {
  accounts: IDBAccount[];
  walletOverrides?: Partial<IDBWallet>;
}) {
  const allNetworkId = getNetworkIdsMap().onekeyall;
  const getAccountsInSameIndexedAccountId = jest.fn(async () => ({
    accounts,
    allDbAccounts: accounts,
  }));
  const getDbAccountIdFromIndexedAccountId = jest.fn(
    async () => allNetworksMockAccount.id,
  );
  const getNetworkAccount = jest.fn(async () => allNetworksMockAccount);
  const getMockedAllNetworkAccount = jest.fn(
    async () => allNetworksMockAccount,
  );
  const service = new ServiceAccountSelector({
    backgroundApi: {
      serviceAccount: {
        getWallet: jest.fn(
          async () =>
            ({
              id: HD_WALLET_ID,
              name: 'HD Wallet',
              type: WALLET_TYPE_HD,
              ...walletOverrides,
            }) as IDBWallet,
        ),
        getIndexedAccount: jest.fn(async () => ({
          id: HD_INDEXED_ACCOUNT_ID,
          name: 'Account #1',
          index: 0,
        })),
        getDbAccountIdFromIndexedAccountId,
        getNetworkAccount,
        getMockedAllNetworkAccount,
        getAccountsInSameIndexedAccountId,
        isTempWalletRemoved: jest.fn(async () => false),
      },
      serviceNetwork: {
        getNetwork: jest.fn(async () => ({
          id: allNetworkId,
          name: 'All networks',
          isAllNetworks: true,
        })),
        getDeriveInfoOfNetwork: jest.fn(async () => ({
          label: 'Default',
          value: 'default',
        })),
        getDeriveInfoItemsOfNetwork: jest.fn(async () => []),
      },
    },
  });

  const selectedAccount: IAccountSelectorSelectedAccount = {
    walletId: HD_WALLET_ID,
    focusedWallet: HD_WALLET_ID,
    networkId: allNetworkId,
    indexedAccountId: HD_INDEXED_ACCOUNT_ID,
    deriveType: 'default',
    othersWalletAccountId: undefined,
  };

  return {
    service,
    selectedAccount,
    getAccountsInSameIndexedAccountId,
    getDbAccountIdFromIndexedAccountId,
    getNetworkAccount,
    getMockedAllNetworkAccount,
  };
}

function buildService({
  homeSelectedAccount,
}: {
  homeSelectedAccount: {
    walletId: string;
    focusedWallet: string;
    networkId: string;
    deriveType: 'default';
    indexedAccountId: undefined;
    othersWalletAccountId: string;
  };
}) {
  return new ServiceAccountSelector({
    backgroundApi: {
      simpleDb: {
        accountSelector: {
          getSelectedAccount: jest.fn(async () => homeSelectedAccount),
        },
      },
      serviceAccount: {
        getDBAccount: jest.fn(async ({ accountId }: { accountId: string }) =>
          accountId === BTC_ACCOUNT_ID ? btcAccount : undefined,
        ),
      },
    },
  });
}

describe('ServiceAccountSelector', () => {
  it('does not expose an all-networks mock account when the indexed account has no chain addresses', async () => {
    const {
      service,
      selectedAccount,
      getAccountsInSameIndexedAccountId,
      getDbAccountIdFromIndexedAccountId,
      getNetworkAccount,
      getMockedAllNetworkAccount,
    } = buildAllNetworksService({ accounts: [] });

    const result = await service.buildActiveAccountInfoFromSelectedAccount({
      selectedAccount,
    });

    expect(getAccountsInSameIndexedAccountId).toHaveBeenCalledWith({
      indexedAccountId: HD_INDEXED_ACCOUNT_ID,
    });
    expect(result.activeAccount.account).toBeUndefined();
    expect(result.activeAccount.canCreateAddress).toBe(true);
    expect(getDbAccountIdFromIndexedAccountId).not.toHaveBeenCalled();
    expect(getNetworkAccount).not.toHaveBeenCalled();
    expect(getMockedAllNetworkAccount).not.toHaveBeenCalled();
  });

  it('keeps the all-networks mock account when at least one chain address exists', async () => {
    const dbAccount = {
      id: `${HD_WALLET_ID}--60--0`,
      indexedAccountId: HD_INDEXED_ACCOUNT_ID,
      name: 'Account #1',
      impl: 'evm',
      address: '0x1234',
    } as IDBAccount;
    const {
      service,
      selectedAccount,
      getDbAccountIdFromIndexedAccountId,
      getNetworkAccount,
      getMockedAllNetworkAccount,
    } = buildAllNetworksService({ accounts: [dbAccount] });

    const result = await service.buildActiveAccountInfoFromSelectedAccount({
      selectedAccount,
    });

    expect(result.activeAccount.account).toBe(allNetworksMockAccount);
    expect(result.activeAccount.canCreateAddress).toBe(true);
    expect(getDbAccountIdFromIndexedAccountId).not.toHaveBeenCalled();
    expect(getNetworkAccount).not.toHaveBeenCalled();
    expect(getMockedAllNetworkAccount).toHaveBeenCalledTimes(1);
  });

  it('keeps the all-networks mock account for a Cosmos variant address', async () => {
    const cosmosNetworkId = getNetworkIdsMap().cosmoshub;
    const dbAccount = {
      id: `${HD_WALLET_ID}--118--0`,
      indexedAccountId: HD_INDEXED_ACCOUNT_ID,
      name: 'Account #1',
      impl: 'cosmos',
      address: '',
      addresses: {
        [cosmosNetworkId]: 'cosmos1variantaddress',
      },
    } as IDBAccount;
    const { service, selectedAccount } = buildAllNetworksService({
      accounts: [dbAccount],
    });

    const result = await service.buildActiveAccountInfoFromSelectedAccount({
      selectedAccount,
    });

    expect(result.activeAccount.account).toBe(allNetworksMockAccount);
    expect(result.activeAccount.canCreateAddress).toBe(true);
  });

  it('preserves the all-networks mock account for a deprecated wallet', async () => {
    const {
      service,
      selectedAccount,
      getAccountsInSameIndexedAccountId,
      getNetworkAccount,
      getMockedAllNetworkAccount,
    } = buildAllNetworksService({
      accounts: [],
      walletOverrides: { deprecated: true },
    });

    const result = await service.buildActiveAccountInfoFromSelectedAccount({
      selectedAccount,
    });

    expect(result.activeAccount.account).toBe(allNetworksMockAccount);
    expect(result.activeAccount.canCreateAddress).toBe(false);
    expect(getNetworkAccount).toHaveBeenCalledTimes(1);
    expect(getAccountsInSameIndexedAccountId).not.toHaveBeenCalled();
    expect(getMockedAllNetworkAccount).not.toHaveBeenCalled();
  });

  it('normalizes imported account network pairs when merging home data into swap map', async () => {
    const service = buildService({
      homeSelectedAccount: {
        walletId: 'imported',
        focusedWallet: 'imported',
        networkId: 'cfx--1029',
        deriveType: 'default',
        indexedAccountId: undefined,
        othersWalletAccountId: BTC_ACCOUNT_ID,
      },
    });

    const result = await service.mergeHomeDataToSwapMap({
      swapMap: {
        0: {
          walletId: 'imported',
          focusedWallet: 'imported',
          networkId: 'cfx--1029',
          deriveType: 'default',
          indexedAccountId: undefined,
          othersWalletAccountId: BTC_ACCOUNT_ID,
        },
      },
    });

    expect(result?.[0]).toMatchObject({
      walletId: 'imported',
      focusedWallet: 'imported',
      networkId: 'btc--0',
      deriveType: 'default',
      othersWalletAccountId: BTC_ACCOUNT_ID,
    });
  });

  it('keeps an imported account selected on all networks when derive type is absent', async () => {
    const allNetworkId = getNetworkIdsMap().onekeyall;
    const selectedAccount: IAccountSelectorSelectedAccount = {
      walletId: WALLET_TYPE_IMPORTED,
      focusedWallet: WALLET_TYPE_IMPORTED,
      networkId: allNetworkId,
      indexedAccountId: undefined,
      deriveType: undefined,
      othersWalletAccountId: EVM_ACCOUNT_ID,
    };
    const getNetworkAccount = jest.fn(
      async ({
        accountId,
      }: {
        accountId: string | undefined;
        networkId: string;
      }) => (accountId === EVM_ACCOUNT_ID ? evmNetworkAccount : undefined),
    );
    const service = new ServiceAccountSelector({
      backgroundApi: {
        serviceAccount: {
          getWallet: jest.fn(
            async ({ walletId }: { walletId: string }) =>
              ({ id: walletId, name: 'Private Key' }) as IDBWallet,
          ),
          getNetworkAccount,
          getDBAccount: jest.fn(async ({ accountId }: { accountId: string }) =>
            accountId === EVM_ACCOUNT_ID ? evmDbAccount : undefined,
          ),
          isTempWalletRemoved: jest.fn(async () => false),
        },
        serviceNetwork: {
          getNetwork: jest.fn(async ({ networkId }: { networkId: string }) => ({
            id: networkId,
          })),
          getDeriveInfoItemsOfNetwork: jest.fn(async () => []),
        },
      },
    });

    const result = await service.buildActiveAccountInfoFromSelectedAccount({
      selectedAccount,
    });

    expect(getNetworkAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: EVM_ACCOUNT_ID,
        networkId: allNetworkId,
      }),
    );
    expect(result.activeAccount.account?.id).toBe(EVM_ACCOUNT_ID);
    expect(result.selectedAccount).toMatchObject({
      walletId: WALLET_TYPE_IMPORTED,
      focusedWallet: WALLET_TYPE_IMPORTED,
      networkId: allNetworkId,
      othersWalletAccountId: EVM_ACCOUNT_ID,
    });
  });

  it('still resolves account and dbAccount when getIndexedAccount transiently fails', async () => {
    const indexedAccountId = 'hd-1--0';
    const hdDbAccountId = "hd-1--m/44'/60'/0'/0/0";
    const hdDbAccount = {
      id: hdDbAccountId,
      name: 'Account #1',
      impl: 'evm',
    } as IDBAccount;
    const hdNetworkAccount = {
      id: hdDbAccountId,
      name: 'Account #1',
      impl: 'evm',
      address: '0x9403a0ec47a062f82d2ac402394eecb61a030d57',
    } as INetworkAccount;
    const selectedAccount: IAccountSelectorSelectedAccount = {
      walletId: 'hd-1',
      focusedWallet: 'hd-1',
      networkId: 'evm--1',
      indexedAccountId,
      deriveType: 'default',
      othersWalletAccountId: undefined,
    };
    const getDbAccountIdFromIndexedAccountId = jest.fn(
      async () => hdDbAccountId,
    );
    const getNetworkAccount = jest.fn(async () => hdNetworkAccount);
    const service = new ServiceAccountSelector({
      backgroundApi: {
        serviceAccount: {
          getWallet: jest.fn(
            async ({ walletId }: { walletId: string }) =>
              ({ id: walletId, name: 'Wallet 1' }) as IDBWallet,
          ),
          // Transient DB failure (bg service worker recycled, native DB
          // busy): the raw indexedAccountId must keep the downstream
          // dbAccount/network account lookups alive.
          getIndexedAccount: jest.fn(async () => {
            throw new OneKeyLocalError('transient db failure');
          }),
          getDbAccountIdFromIndexedAccountId,
          getNetworkAccount,
          getDBAccount: jest.fn(async ({ accountId }: { accountId: string }) =>
            accountId === hdDbAccountId ? hdDbAccount : undefined,
          ),
          isTempWalletRemoved: jest.fn(async () => false),
        },
        serviceNetwork: {
          getNetwork: jest.fn(async ({ networkId }: { networkId: string }) => ({
            id: networkId,
          })),
          getDeriveInfoOfNetwork: jest.fn(async () => ({})),
          getDeriveInfoItemsOfNetwork: jest.fn(async () => []),
        },
      },
    });

    const result = await service.buildActiveAccountInfoFromSelectedAccount({
      selectedAccount,
      nonce: 1,
    });

    expect(getDbAccountIdFromIndexedAccountId).toHaveBeenCalledWith(
      expect.objectContaining({
        indexedAccountId,
        networkId: 'evm--1',
        deriveType: 'default',
      }),
    );
    expect(getNetworkAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        indexedAccountId,
        networkId: 'evm--1',
      }),
    );
    expect(result.activeAccount.account?.id).toBe(hdDbAccountId);
    expect(result.activeAccount.dbAccount?.id).toBe(hdDbAccountId);
    expect(result.perfTiming?.errorStages).toContain('indexedAccount');
  });
});
