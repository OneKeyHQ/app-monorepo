/* cspell:ignore Ufvks */
/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import Vault from './Vault';

// A "do not save" hidden wallet is absent from getWallets() once its session
// ends, while its viewing key stays in SimpleDB. Scanning reads SimpleDB, so
// without this rule the device keeps announcing that account to a third-party
// node after the wallet has visibly disappeared.
function createVault({ visibleWalletIds }: { visibleWalletIds: string[] }) {
  return Object.assign(Object.create(Vault.prototype) as Vault, {
    backgroundApi: {
      serviceAccount: {
        getWallets: async () => ({
          wallets: visibleWalletIds.map((id) => ({ id })),
        }),
      },
      simpleDb: {
        zcash: {
          listAccountIds: async () => ['hd-saved--1', 'hd-hidden--1'],
          listPrivacyModeEnabledAccountIds: async () => [
            'hd-saved--1',
            'hd-hidden--1',
          ],
          listCleanupAccountIds: async () => [],
        },
      },
    },
    zcashGetWalletAccount: async ({ accountId }: { accountId: string }) => ({
      network: 'main',
      ufvk: `ufvk-${accountId}`,
    }),
  });
}

describe('Zcash scanning follows hidden-wallet visibility', () => {
  it('stops scanning an account whose wallet is no longer unlocked', async () => {
    const vault = createVault({ visibleWalletIds: ['hd-saved'] });

    const { accounts } = await vault.listLocalWalletAccounts();

    expect(
      accounts.map(({ accountId, syncEnabled }) => [accountId, syncEnabled]),
    ).toEqual([
      ['hd-saved--1', true],
      ['hd-hidden--1', false],
    ]);
  });

  it('scans it again once that wallet is unlocked', async () => {
    const vault = createVault({
      visibleWalletIds: ['hd-saved', 'hd-hidden'],
    });

    const { accounts } = await vault.listLocalWalletAccounts();

    expect(accounts.every(({ syncEnabled }) => syncEnabled)).toBe(true);
  });

  it('keeps the account listed so its cache and slot bookkeeping survive', async () => {
    const vault = createVault({ visibleWalletIds: ['hd-saved'] });

    const { accounts } = await vault.listLocalWalletAccounts();

    // Deliberately not filtered out: dropping the row would read as "account
    // gone" to the GC pass, which purges cache the user expects to find on
    // the next unlock.
    expect(accounts).toHaveLength(2);
  });
});
