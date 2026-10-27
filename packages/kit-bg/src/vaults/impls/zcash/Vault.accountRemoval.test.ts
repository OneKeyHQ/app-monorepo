/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');

import {
  forgetIdleZcashLifecycleMutexes,
  getZcashLifecycleMutex,
} from './lifecycle';
import Vault from './Vault';
import { createZcashSetupIncompleteError } from './vaultUtils';

// Runtime primitive for deleting an account's local data: never waits on an in-flight tx, never drops data another live account scans under the same viewing key.
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

  it.each<{
    title: string;
    options?: Parameters<typeof createVault>[0];
    accountId?: string;
    orphaned: boolean;
    purge: boolean;
  }>([
    {
      title: 'removes its runtime data even with a transaction in flight',
      orphaned: false,
      purge: true,
    },
    {
      title:
        'keeps runtime data another live account with the same key still scans',
      options: { otherAccountStillExists: true },
      orphaned: false,
      purge: false,
    },
    {
      title: 'does not keep data for an alias that holds no scan data',
      options: { otherAccountStillExists: true, otherHoldsScanData: false },
      orphaned: false,
      purge: true,
    },
    {
      title: 'does not keep data for an alias whose app account is gone',
      orphaned: false,
      purge: true,
    },
    {
      title: 'reports possible orphans when its key can no longer be read',
      options: { keyReadable: false },
      orphaned: true,
      purge: false,
    },
    {
      title:
        'keeps the data and reports possible orphans when holders are unknown',
      options: { scanListReadable: false },
      orphaned: true,
      purge: false,
    },
    {
      title:
        'keeps the data while another record that holds scan data is unreadable',
      options: { malformedHolder: true },
      orphaned: true,
      purge: false,
    },
    {
      title: 'names nothing in the runtime when setup never stored metadata',
      accountId: 'never-set-up',
      orphaned: false,
      purge: false,
    },
  ])('$title', async ({ options, accountId = 'deleted', orphaned, purge }) => {
    const { vault, purgeWallet } = createVault(options);
    await expect(
      vault.getLocalWalletCapability().deleteRuntimeAccount({ accountId }),
    ).resolves.toEqual({ orphaned });
    if (purge) expect(purgeWallet).toHaveBeenCalledWith({ ufvk });
    else expect(purgeWallet).not.toHaveBeenCalled();
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
