import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import {
  collectAndPruneUnavailableTransferCredentials,
  filterTransferWallets,
  getCliBotWalletTransferWalletId,
  normalizePrimeTransferCredential,
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
  it('filters out keyless and bot wallets from default transfer payloads', () => {
    const wallets = filterTransferWallets({
      wallets: [
        createWallet({ id: 'hd-1' }),
        createWallet({ id: 'keyless-1', isKeyless: true }),
        createWallet({ id: 'hd-bot--parent-1--0' }),
      ],
    });

    expect(wallets.map((wallet) => wallet.id)).toEqual(['hd-1']);
  });

  it('keeps requested bot wallet ids for scoped transfers (e.g. CLI export)', () => {
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

describe('normalizePrimeTransferCredential', () => {
  it('accepts portable transfer credential shapes', () => {
    expect(normalizePrimeTransferCredential('|RP|portable-payload')).toBe(
      '|RP|portable-payload',
    );
    expect(
      normalizePrimeTransferCredential({
        credential: '|PK|portable-payload',
      }),
    ).toBe('|PK|portable-payload');
    expect(normalizePrimeTransferCredential(undefined)).toBe(undefined);
  });

  it('filters non-portable credentials before transfer decrypt/export', () => {
    expect(
      normalizePrimeTransferCredential('|LSE1|{"keyRef":"indexeddb:key"}'),
    ).toBeUndefined();
    expect(
      normalizePrimeTransferCredential({
        credential: '|LSE1|{"keyRef":"keychain:key"}',
      }),
    ).toBeUndefined();
    expect(
      normalizePrimeTransferCredential(
        '|HLP|{"privateKey":"plain","userAddress":"0x1"}',
      ),
    ).toBeUndefined();
    expect(
      normalizePrimeTransferCredential('|UNKNOWN|payload'),
    ).toBeUndefined();
  });
});

describe('collectAndPruneUnavailableTransferCredentials', () => {
  function makePrivateData() {
    return {
      wallets: {
        'hd-1': { id: 'hd-1', name: 'Main Wallet' } as never,
        'hd-2': { id: 'hd-2', name: 'Keep Wallet' } as never,
      },
      importedAccounts: {
        'imported--60--pub': {
          id: 'imported--60--pub',
          name: 'My Import',
        } as never,
        'imported--607--ton': {
          id: 'imported--607--ton',
          name: 'My TON',
        } as never,
      },
    };
  }

  it('returns [] and prunes nothing when no credentials are unavailable', () => {
    const privateData = makePrivateData();
    expect(
      collectAndPruneUnavailableTransferCredentials({
        privateData,
        unavailableCredentialIds: [],
      }),
    ).toEqual([]);
    expect(Object.keys(privateData.wallets)).toEqual(['hd-1', 'hd-2']);
    expect(Object.keys(privateData.importedAccounts)).toEqual([
      'imported--60--pub',
      'imported--607--ton',
    ]);
  });

  it('labels and prunes a skipped HD wallet, leaving the rest intact', () => {
    const privateData = makePrivateData();
    const result = collectAndPruneUnavailableTransferCredentials({
      privateData,
      unavailableCredentialIds: ['hd-1'],
    });
    expect(result).toEqual([{ credentialId: 'hd-1', label: 'Main Wallet' }]);
    // only the skipped wallet is pruned; everything else stays
    expect(Object.keys(privateData.wallets)).toEqual(['hd-2']);
    expect(Object.keys(privateData.importedAccounts)).toEqual([
      'imported--60--pub',
      'imported--607--ton',
    ]);
  });

  it('labels and prunes a skipped imported account', () => {
    const privateData = makePrivateData();
    const result = collectAndPruneUnavailableTransferCredentials({
      privateData,
      unavailableCredentialIds: ['imported--60--pub'],
    });
    expect(result).toEqual([
      { credentialId: 'imported--60--pub', label: 'My Import' },
    ]);
    expect(privateData.importedAccounts['imported--60--pub']).toBeUndefined();
  });

  it('maps a TON mnemonic credential id back to its imported account for label and pruning', () => {
    const privateData = makePrivateData();
    const tonCredentialId = accountUtils.buildTonMnemonicCredentialId({
      accountId: 'imported--607--ton',
    });
    const result = collectAndPruneUnavailableTransferCredentials({
      privateData,
      unavailableCredentialIds: [tonCredentialId],
    });
    expect(result).toEqual([
      { credentialId: tonCredentialId, label: 'My TON' },
    ]);
    expect(privateData.importedAccounts['imported--607--ton']).toBeUndefined();
  });

  it('falls back to the credentialId when no wallet/account name is found', () => {
    const privateData = makePrivateData();
    const result = collectAndPruneUnavailableTransferCredentials({
      privateData,
      unavailableCredentialIds: ['hd-unknown'],
    });
    expect(result).toEqual([
      { credentialId: 'hd-unknown', label: 'hd-unknown' },
    ]);
  });
});
