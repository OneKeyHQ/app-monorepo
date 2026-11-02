/* cspell:ignore Ufvks */
import { withMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

import {
  forgetIdleZcashLifecycleMutexes,
  getZcashSyncMutex,
} from './lifecycle';
import Vault from './Vault';
import {
  zcashDeleteRuntimeAccount,
  zcashPrepareAccounts,
  zcashPurgeRuntimeOrphans,
} from './vaultLifecycle';

jest.mock('../../../dbs/local/localDbInstance');

const LIVE = 'hd-1--0';
const PAUSED = 'hd-1--1';

function createVault({ pausedMetaVkFp = 'fp-paused' } = {}) {
  const prepareWalletAccounts = jest.fn(
    async (prepared: { ufvk: string }[]) => prepared,
  );
  const accounts: Record<string, { ufvk: string }> = {
    [LIVE]: { ufvk: 'ufvk-live' },
    [PAUSED]: { ufvk: 'ufvk-paused' },
  };
  const zcashGetWalletAccount = jest.fn(
    async ({ accountId }: { accountId: string }) => accounts[accountId],
  );
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    networkId: 'zec--0',
    zcashGetAccountMeta: async () => undefined,
    backgroundApi: {
      simpleDb: {
        privacyChainState: {
          listZcashAccountMetas: async () => [
            { accountId: LIVE, meta: { vkFp: 'fp-live' } },
            { accountId: PAUSED, meta: { vkFp: pausedMetaVkFp } },
          ],
          isAccountDeletionPending: async () => false,
          getAccountEpoch: async () => undefined,
        },
      },
    },
    listLocalWalletAccounts: async () => ({
      accounts: [
        { accountId: LIVE, syncEnabled: true },
        { accountId: PAUSED, syncEnabled: false },
      ],
    }),
    zcashGetWalletAccount,
    zcashHealOutOfRangeBirthdays: async () => undefined,
    zcashGetApi: async () => ({ prepareWalletAccounts }),
  });
  return { vault, prepareWalletAccounts, zcashGetWalletAccount };
}

const retained = [
  { accountId: LIVE, vkFp: 'fp-live' },
  { accountId: PAUSED, vkFp: 'fp-paused' },
];

describe('zcash runtime orphan cleanup', () => {
  it('keeps every retained identity by label, paused ones included, opening through a scanning account', async () => {
    const { vault, prepareWalletAccounts } = createVault();

    await expect(zcashPurgeRuntimeOrphans(vault, { retained })).resolves.toBe(
      true,
    );

    // Only the scanning account is registered; the paused one is kept by key.
    expect(prepareWalletAccounts).toHaveBeenCalledWith(
      [{ ufvk: 'ufvk-live' }],
      { retainedLabels: ['fp-live', 'fp-paused'] },
    );
  });

  it('does not run while the scan lane is held', async () => {
    const { vault, prepareWalletAccounts } = createVault();
    const release = await getZcashSyncMutex('main').acquire();
    try {
      await expect(zcashPurgeRuntimeOrphans(vault, { retained })).resolves.toBe(
        false,
      );
    } finally {
      release();
    }
    expect(prepareWalletAccounts).not.toHaveBeenCalled();
  });

  it('does not run when a key names another identity than its account record', async () => {
    const { vault, prepareWalletAccounts } = createVault({
      pausedMetaVkFp: 'fp-other',
    });
    await expect(zcashPurgeRuntimeOrphans(vault, { retained })).resolves.toBe(
      false,
    );
    expect(prepareWalletAccounts).not.toHaveBeenCalled();
  });

  it('does not run without a scanning account to open the database', async () => {
    const { vault, prepareWalletAccounts } = createVault();
    await expect(
      zcashPurgeRuntimeOrphans(vault, { retained: [retained[1]] }),
    ).resolves.toBe(false);
    expect(prepareWalletAccounts).not.toHaveBeenCalled();
  });

  it('never purges on an ordinary scan turn', async () => {
    const { vault, prepareWalletAccounts } = createVault();
    await zcashPrepareAccounts(vault, { accountIds: [LIVE] });
    expect(prepareWalletAccounts).toHaveBeenCalledWith([{ ufvk: 'ufvk-live' }]);
  });
});

describe('zcash runtime deletion beside a twin', () => {
  const NETWORK_ID = 'zec--0';
  const TWIN = 'hw-1--0';
  const vkFp = 'b'.repeat(32);

  afterEach(() => {
    forgetIdleZcashLifecycleMutexes();
  });

  async function setupTwins() {
    const state = withMemoryStorage(
      new SimpleDbEntityPrivacyChainState(),
      null,
    );
    for (const accountId of [LIVE, TWIN]) {
      // eslint-disable-next-line no-await-in-loop
      await state.beginZcashPrivacyModeEnable({
        networkId: NETWORK_ID,
        accountId,
        birthdayHeight: 2000,
      });
      // eslint-disable-next-line no-await-in-loop
      await state.saveZcashAccountMeta({
        accountId,
        meta: {
          vkFp,
          unifiedAddress: 'u1',
          transparentAddress: 't1',
          seedFingerprintHex: 'ab'.repeat(32),
          hdIndex: 0,
          birthdayHeight: 2000,
          createdAt: 1,
        },
      });
      // eslint-disable-next-line no-await-in-loop
      await state.completeZcashPrivacyModeEnable({ accountId });
    }
    const purgeWallet = jest.fn(async () => ({ removed: true }));
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: NETWORK_ID,
      backgroundApi: {
        simpleDb: { privacyChainState: state },
        serviceAccount: {
          getDBAccountSafe: async ({ accountId }: { accountId: string }) => ({
            id: accountId,
          }),
        },
      },
      zcashGetApi: async () => ({ purgeWallet }),
    });
    return { state, vault, purgeWallet };
  }

  it.each([
    {
      title: 'removes the shared data when the twin is being deleted too',
      reenabled: false,
      purged: true,
    },
    {
      title: 'keeps the shared data for a twin re-enabled during its deletion',
      reenabled: true,
      purged: false,
    },
  ])('$title', async ({ reenabled, purged }) => {
    const { state, vault, purgeWallet } = await setupTwins();
    const twinRequest = await state.requestAccountDeletion({
      networkId: NETWORK_ID,
      accountId: TWIN,
    });
    if (reenabled) {
      await state.beginAccountReenable(twinRequest);
      await state.beginZcashPrivacyModeEnable({
        networkId: NETWORK_ID,
        accountId: TWIN,
        birthdayHeight: 2000,
      });
      await state.completeZcashPrivacyModeEnable({ accountId: TWIN });
    }
    const request = await state.requestAccountDeletion({
      networkId: NETWORK_ID,
      accountId: LIVE,
    });

    await expect(
      zcashDeleteRuntimeAccount(vault, {
        accountId: LIVE,
        deletionRequestId: request.requestId,
      }),
    ).resolves.toEqual({ orphaned: false });
    expect(purgeWallet.mock.calls).toEqual(
      purged ? [[{ network: 'main', label: vkFp }]] : [],
    );
  });
});
