import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import {
  filterTransferWallets,
  shouldUseCliTransportDecryptedCredentials,
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

describe('shouldUseCliTransportDecryptedCredentials', () => {
  it('keeps decrypted credentials only for single bot-wallet transfers targeting CLI', () => {
    expect(
      shouldUseCliTransportDecryptedCredentials({
        transferData: makeTransferData(),
        allowCliImportableCredentials: true,
      }),
    ).toBe(true);
  });

  it('keeps existing wrapped-credential contract for non-CLI or non-bot-wallet paths', () => {
    expect(
      shouldUseCliTransportDecryptedCredentials({
        transferData: makeTransferData(),
        allowCliImportableCredentials: false,
      }),
    ).toBe(false);

    expect(
      shouldUseCliTransportDecryptedCredentials({
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
