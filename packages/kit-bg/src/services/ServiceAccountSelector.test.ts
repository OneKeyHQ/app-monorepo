import ServiceAccountSelector from './ServiceAccountSelector';

import type { IDBAccount } from '../dbs/local/types';

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
});
