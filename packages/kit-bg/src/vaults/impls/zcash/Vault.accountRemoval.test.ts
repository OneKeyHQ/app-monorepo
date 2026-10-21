/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { forgetZcashLifecycleMutex, getZcashLifecycleMutex } from './lifecycle';
import Vault from './Vault';
import { createZcashSetupIncompleteError } from './vaultUtils';

// A deleted app account never waits on a transaction in flight: the funds are
// on chain and a re-import scans them back. The one thing it must not do is
// drop runtime data another app account still uses (same viewing key).
describe('Zcash cleanup of a deleted account', () => {
  const ufvk = 'uview-removal-test';
  const vkFp = 'f'.repeat(32);

  function createVault(
    otherAccountStillExists: boolean,
    { keyReadable = true }: { keyReadable?: boolean } = {},
  ) {
    const purgeWallet = jest.fn(async () => undefined);
    const metas = new Map([
      ['deleted', { vkFp }],
      ['other', { vkFp }],
    ]);
    if (!otherAccountStillExists) {
      metas.delete('other');
    }
    const removeAccountState = jest.fn(
      async ({ accountId }: { accountId: string }) => {
        metas.delete(accountId);
      },
    );
    const removeZcashTransparentAccount = jest.fn(async () => undefined);
    const removeKeys = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash: {
            getAccountMeta: async ({ accountId }: { accountId: string }) =>
              metas.get(accountId),
            listAccountMetas: async () =>
              [...metas].map(([accountId, meta]) => ({ accountId, meta })),
            removeAccountState,
          },
          privacyChainJournal: { removeZcashTransparentAccount },
          privacyChainKeys: { removeKeys },
        },
        serviceAccount: {
          getDBAccountSafe: async ({ accountId }: { accountId: string }) =>
            accountId === 'other' && otherAccountStillExists
              ? { id: 'other' }
              : null,
        },
      },
      zcashGetWalletAccount: async () => {
        if (!keyReadable) throw createZcashSetupIncompleteError();
        return { ufvk };
      },
      zcashGetApi: async () => ({ purgeWallet }),
    });
    return {
      vault,
      purgeWallet,
      removeAccountState,
      removeZcashTransparentAccount,
      removeKeys,
    };
  }

  afterEach(() => {
    forgetZcashLifecycleMutex(vkFp);
  });

  it('removes its runtime data even with a transaction in flight', async () => {
    const {
      vault,
      purgeWallet,
      removeAccountState,
      removeZcashTransparentAccount,
      removeKeys,
    } = createVault(false);

    await vault.resetLocalWallet({ accountId: 'deleted', scope: 'all' });

    expect(purgeWallet).toHaveBeenCalledWith({ ufvk });
    expect(removeAccountState).toHaveBeenCalledWith({ accountId: 'deleted' });
    expect(removeZcashTransparentAccount).toHaveBeenCalledWith({
      accountId: 'deleted',
    });
    expect(removeKeys).toHaveBeenCalledWith({ accountIds: ['deleted'] });
  });

  it('keeps runtime data another account with the same key still uses', async () => {
    const {
      vault,
      purgeWallet,
      removeAccountState,
      removeZcashTransparentAccount,
      removeKeys,
    } = createVault(true);

    await vault.resetLocalWallet({ accountId: 'deleted', scope: 'all' });

    expect(purgeWallet).not.toHaveBeenCalled();
    expect(removeAccountState).toHaveBeenCalledWith({ accountId: 'deleted' });
    expect(removeZcashTransparentAccount).toHaveBeenCalledWith({
      accountId: 'deleted',
    });
    expect(removeKeys).toHaveBeenCalledWith({ accountIds: ['deleted'] });
  });

  it('still removes the account when its key can no longer be read', async () => {
    const { vault, purgeWallet, removeAccountState } = createVault(false, {
      keyReadable: false,
    });

    await vault.resetLocalWallet({ accountId: 'deleted', scope: 'all' });

    expect(purgeWallet).not.toHaveBeenCalled();
    expect(removeAccountState).toHaveBeenCalledWith({ accountId: 'deleted' });
  });

  it('forgets the lifecycle mutex once no account names the key', async () => {
    const { vault } = createVault(false);
    const before = getZcashLifecycleMutex(vkFp);

    await vault.resetLocalWallet({ accountId: 'deleted', scope: 'all' });

    expect(getZcashLifecycleMutex(vkFp)).not.toBe(before);
  });

  it('keeps the lifecycle mutex an alias still shares', async () => {
    const { vault } = createVault(true);
    const before = getZcashLifecycleMutex(vkFp);

    await vault.resetLocalWallet({ accountId: 'deleted', scope: 'all' });

    expect(getZcashLifecycleMutex(vkFp)).toBe(before);
  });

  it('never forgets a mutex that is held', async () => {
    const mutex = getZcashLifecycleMutex(vkFp);
    const release = await mutex.acquire();

    forgetZcashLifecycleMutex(vkFp);

    expect(getZcashLifecycleMutex(vkFp)).toBe(mutex);
    release();
  });
});
