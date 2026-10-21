/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import {
  forgetIdleZcashLifecycleMutexes,
  getZcashLifecycleMutex,
} from './lifecycle';
import Vault from './Vault';
import { createZcashSetupIncompleteError } from './vaultUtils';

// The runtime primitive behind deleting an account or its local data: it
// never waits on a transaction in flight (the funds are on chain and a later
// enable scans them back), and never drops runtime data another live account
// still scans under the same viewing key. Host records are the executor's.
describe('Zcash runtime deletion of an account', () => {
  const ufvk = 'uview-removal-test';
  const vkFp = 'f'.repeat(32);

  function createVault({
    otherAccountStillExists = false,
    otherHoldsScanData = true,
    keyReadable = true,
    scanListReadable = true,
    malformedHolder = false,
  }: {
    otherAccountStillExists?: boolean;
    otherHoldsScanData?: boolean;
    malformedHolder?: boolean;
    keyReadable?: boolean;
    scanListReadable?: boolean;
  } = {}) {
    const purgeWallet = jest.fn(async () => undefined);
    const metas = new Map([
      ['deleted', { vkFp }],
      ['other', { vkFp }],
    ]);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            getZcashAccountMeta: async ({ accountId }: { accountId: string }) =>
              metas.get(accountId),
            listZcashAccountMetas: async () =>
              [...metas].map(([accountId, meta]) => ({ accountId, meta })),
            // A record that can't be read is listed, but has no meta view.
            listZcashMetaAccountIds: async () => [
              ...metas.keys(),
              ...(malformedHolder ? ['malformed'] : []),
            ],
            listScanDataAccountIds: async () => {
              if (!scanListReadable) return undefined;
              return [
                'deleted',
                ...(otherHoldsScanData ? ['other'] : []),
                ...(malformedHolder ? ['malformed'] : []),
              ];
            },
          },
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
    return { vault, purgeWallet };
  }

  afterEach(() => {
    forgetIdleZcashLifecycleMutexes();
  });

  it('removes its runtime data even with a transaction in flight', async () => {
    const { vault, purgeWallet } = createVault();

    await expect(
      vault.zcashDeleteRuntimeAccount({ accountId: 'deleted' }),
    ).resolves.toEqual({ orphaned: false });

    expect(purgeWallet).toHaveBeenCalledWith({ ufvk });
  });

  it('keeps runtime data another live account with the same key still scans', async () => {
    const { vault, purgeWallet } = createVault({
      otherAccountStillExists: true,
    });

    await expect(
      vault.zcashDeleteRuntimeAccount({ accountId: 'deleted' }),
    ).resolves.toEqual({ orphaned: false });

    expect(purgeWallet).not.toHaveBeenCalled();
  });

  it('does not keep data for an alias that holds no scan data', async () => {
    const { vault, purgeWallet } = createVault({
      otherAccountStillExists: true,
      otherHoldsScanData: false,
    });

    await vault.zcashDeleteRuntimeAccount({ accountId: 'deleted' });

    expect(purgeWallet).toHaveBeenCalledWith({ ufvk });
  });

  it('does not keep data for an alias whose app account is gone', async () => {
    const { vault, purgeWallet } = createVault();

    await vault.zcashDeleteRuntimeAccount({ accountId: 'deleted' });

    expect(purgeWallet).toHaveBeenCalledWith({ ufvk });
  });

  it('reports possible orphans when its key can no longer be read', async () => {
    const { vault, purgeWallet } = createVault({ keyReadable: false });

    await expect(
      vault.zcashDeleteRuntimeAccount({ accountId: 'deleted' }),
    ).resolves.toEqual({ orphaned: true });

    expect(purgeWallet).not.toHaveBeenCalled();
  });

  it('keeps the data and reports possible orphans when holders are unknown', async () => {
    const { vault, purgeWallet } = createVault({ scanListReadable: false });

    await expect(
      vault.zcashDeleteRuntimeAccount({ accountId: 'deleted' }),
    ).resolves.toEqual({ orphaned: true });

    expect(purgeWallet).not.toHaveBeenCalled();
  });

  // Like XMR: an unreadable record may be an alias, so it counts as one.
  it('keeps the data while another record that holds scan data is unreadable', async () => {
    const { vault, purgeWallet } = createVault({ malformedHolder: true });

    await expect(
      vault.zcashDeleteRuntimeAccount({ accountId: 'deleted' }),
    ).resolves.toEqual({ orphaned: true });

    expect(purgeWallet).not.toHaveBeenCalled();
  });

  it('names nothing in the runtime when setup never stored metadata', async () => {
    const { vault, purgeWallet } = createVault();

    await expect(
      vault.zcashDeleteRuntimeAccount({ accountId: 'never-set-up' }),
    ).resolves.toEqual({ orphaned: false });

    expect(purgeWallet).not.toHaveBeenCalled();
  });
});

describe('Zcash lifecycle mutex bound', () => {
  const vkFp = 'e'.repeat(32);

  it('forgets an idle mutex; the next use makes a fresh one', () => {
    const before = getZcashLifecycleMutex(vkFp);

    forgetIdleZcashLifecycleMutexes();

    expect(getZcashLifecycleMutex(vkFp)).not.toBe(before);
    forgetIdleZcashLifecycleMutexes();
  });

  it('never forgets a mutex that is held', async () => {
    const mutex = getZcashLifecycleMutex(vkFp);
    const release = await mutex.acquire();

    forgetIdleZcashLifecycleMutexes();

    expect(getZcashLifecycleMutex(vkFp)).toBe(mutex);
    release();
    forgetIdleZcashLifecycleMutexes();
  });
});
