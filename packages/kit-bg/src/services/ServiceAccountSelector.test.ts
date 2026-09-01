import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_IMPORTED,
} from '@onekeyhq/shared/src/consts/dbConsts';
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

function buildAllNetworksService({ accounts }: { accounts: IDBAccount[] }) {
  const allNetworkId = getNetworkIdsMap().onekeyall;
  const getAccountsInSameIndexedAccountId = jest.fn(async () => ({
    accounts,
    allDbAccounts: accounts,
  }));
  const service = new ServiceAccountSelector({
    backgroundApi: {
      serviceAccount: {
        getWallet: jest.fn(
          async () =>
            ({
              id: HD_WALLET_ID,
              name: 'HD Wallet',
              type: WALLET_TYPE_HD,
            }) as IDBWallet,
        ),
        getIndexedAccount: jest.fn(async () => ({
          id: HD_INDEXED_ACCOUNT_ID,
          name: 'Account #1',
          index: 0,
        })),
        getDbAccountIdFromIndexedAccountId: jest.fn(
          async () => allNetworksMockAccount.id,
        ),
        getNetworkAccount: jest.fn(async () => allNetworksMockAccount),
        getMockedAllNetworkAccount: jest.fn(async () => allNetworksMockAccount),
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

  return { service, selectedAccount, getAccountsInSameIndexedAccountId };
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
    const { service, selectedAccount, getAccountsInSameIndexedAccountId } =
      buildAllNetworksService({ accounts: [] });

    const result = await service.buildActiveAccountInfoFromSelectedAccount({
      selectedAccount,
    });

    expect(getAccountsInSameIndexedAccountId).toHaveBeenCalledWith({
      indexedAccountId: HD_INDEXED_ACCOUNT_ID,
    });
    expect(result.activeAccount.account).toBeUndefined();
    expect(result.activeAccount.canCreateAddress).toBe(true);
  });

  it('keeps the all-networks mock account when at least one chain address exists', async () => {
    const dbAccount = {
      id: `${HD_WALLET_ID}--60--0`,
      indexedAccountId: HD_INDEXED_ACCOUNT_ID,
      name: 'Account #1',
      impl: 'evm',
      address: '0x1234',
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
});
