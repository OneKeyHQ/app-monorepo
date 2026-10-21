/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import Vault from './Vault';

// A deleted app account never waits on a transaction in flight: the funds are
// on chain and a re-import scans them back. The one thing it must not do is
// drop runtime data another app account still uses (same viewing key).
describe('Zcash cleanup of a deleted account', () => {
  const ufvk = 'uview-removal-test';

  function createVault(otherAccountStillExists: boolean) {
    const purgeWallet = jest.fn(async () => undefined);
    const removeAccountState = jest.fn(async () => undefined);
    const removeZcashTransparentAccount = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash: {
            getAccountMeta: async () => ({ ufvk }),
            listAccountMetas: async () => [
              { accountId: 'deleted', meta: { ufvk } },
              { accountId: 'other', meta: { ufvk } },
            ],
            removeAccountState,
          },
          privacyChainJournal: { removeZcashTransparentAccount },
        },
        serviceAccount: {
          getDBAccountSafe: async ({ accountId }: { accountId: string }) =>
            accountId === 'other' && otherAccountStillExists
              ? { id: 'other' }
              : null,
        },
      },
      zcashGetWalletAccount: async () => ({ ufvk }),
      zcashGetApi: async () => ({ purgeWallet }),
    });
    return {
      vault,
      purgeWallet,
      removeAccountState,
      removeZcashTransparentAccount,
    };
  }

  it('removes its runtime data even with a transaction in flight', async () => {
    const {
      vault,
      purgeWallet,
      removeAccountState,
      removeZcashTransparentAccount,
    } = createVault(false);

    await vault.resetLocalWallet({ accountId: 'deleted', scope: 'all' });

    expect(purgeWallet).toHaveBeenCalledWith({ ufvk });
    expect(removeAccountState).toHaveBeenCalledWith({ accountId: 'deleted' });
    expect(removeZcashTransparentAccount).toHaveBeenCalledWith({
      accountId: 'deleted',
    });
  });

  it('keeps runtime data another account with the same key still uses', async () => {
    const {
      vault,
      purgeWallet,
      removeAccountState,
      removeZcashTransparentAccount,
    } = createVault(true);

    await vault.resetLocalWallet({ accountId: 'deleted', scope: 'all' });

    expect(purgeWallet).not.toHaveBeenCalled();
    expect(removeAccountState).toHaveBeenCalledWith({ accountId: 'deleted' });
    expect(removeZcashTransparentAccount).toHaveBeenCalledWith({
      accountId: 'deleted',
    });
  });
});
