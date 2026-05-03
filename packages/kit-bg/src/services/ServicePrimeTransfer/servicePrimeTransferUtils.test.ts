import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import {
  filterTransferWallets,
  getCliBotWalletTransferWalletId,
  shouldUseCliBotWalletEncryptedCredential,
} from './servicePrimeTransferUtils';

import type { IDBWallet } from '../../dbs/local/types';

function createWallet({
  id,
  isKeyless = false,
}: {
  id: string;
  isKeyless?: boolean;
}) {
  return {
    id,
    isKeyless,
  } as IDBWallet;
}

describe('filterTransferWallets', () => {
  it('filters out keyless wallets from default transfer payloads', () => {
    const wallets = filterTransferWallets({
      wallets: [
        createWallet({ id: 'hd-1' }),
        createWallet({ id: 'keyless-1', isKeyless: true }),
        createWallet({ id: 'hd-bot--parent-1--0' }),
      ],
    });

    expect(wallets.map((wallet) => wallet.id)).toEqual([
      'hd-1',
      'hd-bot--parent-1--0',
    ]);
  });

  it('keeps only the requested wallet ids for scoped transfers', () => {
    const wallets = filterTransferWallets({
      wallets: [
        createWallet({ id: 'hd-1' }),
        createWallet({ id: 'hd-bot--parent-1--0' }),
        createWallet({ id: 'hd-bot--parent-1--1' }),
      ],
      walletIds: ['hd-bot--parent-1--1'],
    });

    expect(wallets.map((wallet) => wallet.id)).toEqual(['hd-bot--parent-1--1']);
  });
});

function makeTransferData(
  overrides?: Partial<IPrimeTransferData>,
): IPrimeTransferData {
  return {
    privateData: {
      credentials: {},
      importedAccounts: {},
      watchingAccounts: {},
      wallets: {
        'hd-bot--parent-1--0': {
          id: 'hd-bot--parent-1--0',
        } as never,
      },
    },
    publicData: undefined,
    isEmptyData: false,
    isWatchingOnly: false,
    appVersion: '1.0.0',
    ...overrides,
  };
}

describe('shouldUseCliBotWalletEncryptedCredential', () => {
  it('uses the encrypted CLI credential payload only for single bot-wallet transfers targeting CLI', () => {
    expect(
      shouldUseCliBotWalletEncryptedCredential({
        transferData: makeTransferData(),
        allowCliImportableCredentials: true,
      }),
    ).toBe(true);
  });

  it('keeps existing wrapped-credential contract for non-CLI or non-bot-wallet paths', () => {
    expect(
      shouldUseCliBotWalletEncryptedCredential({
        transferData: makeTransferData(),
        allowCliImportableCredentials: false,
      }),
    ).toBe(false);

    expect(
      shouldUseCliBotWalletEncryptedCredential({
        transferData: makeTransferData({
          privateData: {
            credentials: {},
            importedAccounts: {
              'imported--1': {} as never,
            },
            watchingAccounts: {},
            wallets: {
              'hd-bot--parent-1--0': {
                id: 'hd-bot--parent-1--0',
              } as never,
            },
          },
        }),
        allowCliImportableCredentials: true,
      }),
    ).toBe(false);
  });
});

describe('getCliBotWalletTransferWalletId', () => {
  it('returns the single bot-wallet id from a scoped transfer payload', () => {
    expect(
      getCliBotWalletTransferWalletId({
        transferData: makeTransferData(),
      }),
    ).toBe('hd-bot--parent-1--0');
  });

  it('rejects non-bot or multi-wallet payloads', () => {
    expect(
      getCliBotWalletTransferWalletId({
        transferData: makeTransferData({
          privateData: {
            credentials: {},
            importedAccounts: {},
            watchingAccounts: {},
            wallets: {
              'hd-1': {
                id: 'hd-1',
              } as never,
            },
          },
        }),
      }),
    ).toBeUndefined();

    expect(
      getCliBotWalletTransferWalletId({
        transferData: makeTransferData({
          privateData: {
            credentials: {},
            importedAccounts: {},
            watchingAccounts: {},
            wallets: {
              'hd-bot--parent-1--0': {
                id: 'hd-bot--parent-1--0',
              } as never,
              'hd-bot--parent-1--1': {
                id: 'hd-bot--parent-1--1',
              } as never,
            },
          },
        }),
      }),
    ).toBeUndefined();
  });
});
