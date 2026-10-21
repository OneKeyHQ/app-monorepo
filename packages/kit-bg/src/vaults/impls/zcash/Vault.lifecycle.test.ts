import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import Vault from './Vault';
import { zcashRebuildRuntimeDatabase } from './vaultLifecycle';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

describe('Zcash local lifecycle operations do not depend on pending history', () => {
  function fixture(historyState: 'pending' | 'unreadable') {
    const accountId = 'synthetic-account';
    const account = { ufvk: 'synthetic-ufvk' };
    const repair = {
      birthdayHeight: 2_000_000,
      requestedAt: 1,
      birthdaySource: 'manual-height' as const,
    };
    const readPending = jest.fn(async () => {
      if (historyState === 'unreadable')
        throw new OneKeyLocalError('history unavailable');
      return ['11'.repeat(32)];
    });
    const purgeWallet = jest.fn(async () => undefined);
    const dropWalletDatabase = jest.fn(async () => undefined);
    const clearAccountScanData = jest.fn(async () => undefined);
    const saveAccountMeta = jest.fn(async () => undefined);
    const removePendingRescan = jest.fn(async () => undefined);
    const rotateAccountEpochs = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      accountId,
      backgroundApi: {
        serviceAccount: {
          getDBAccountSafe: async () => ({ id: accountId }),
        },
        simpleDb: {
          privacyChainState: {
            getZcashAccountMeta: async () => account,
            getZcashPrivacyModeState: async () => ({ intent: 'off' }),
            isZcashPrivacyModeEnabled: async () => true,
            listZcashAccountMetas: async () => [{ accountId, meta: account }],
            listZcashPendingRescans: async () => [{ accountId, repair }],
            listScanDataAccountIds: async () => [],
            clearAccountScanData,
            saveZcashAccountMeta: saveAccountMeta,
            removeZcashPendingRescan: removePendingRescan,
            rotateAccountEpochs,
          },
          privacyChainJournal: {
            listTransparentPendingTxs: async () =>
              (await readPending()).map((txid) => ({ txid })),
          },
        },
      },
      zcashGetAccountMeta: async () => account,
      zcashGetWalletAccount: async () => account,
      listLocalWalletAccounts: async () => ({ accounts: [{ accountId }] }),
      zcashGetApi: async () => ({
        purgeWallet,
        dropWalletDatabase,
        getPendingBroadcasts: readPending,
      }),
    });
    return {
      vault,
      accountId,
      account,
      repair,
      readPending,
      purgeWallet,
      dropWalletDatabase,
      clearAccountScanData,
      saveAccountMeta,
      removePendingRescan,
      rotateAccountEpochs,
    };
  }

  it.each(['pending', 'unreadable'] as const)(
    'allows delete, cache reset, repair and database rebuild with %s history',
    async (historyState) => {
      const f = fixture(historyState);

      await expect(
        f.vault.zcashDeleteRuntimeAccount({ accountId: f.accountId }),
      ).resolves.toEqual({ orphaned: false });
      await f.vault.zcashRewindAccount({ accountId: f.accountId });
      await f.vault.applyPendingRescan({
        accountId: f.accountId,
        repair: f.repair,
      });
      await zcashRebuildRuntimeDatabase(f.vault);

      expect(f.readPending).not.toHaveBeenCalled();
      expect(f.purgeWallet).toHaveBeenCalledTimes(3);
      expect(f.purgeWallet).toHaveBeenCalledWith(f.account);
      expect(f.dropWalletDatabase).toHaveBeenCalledWith('main');
      expect(f.saveAccountMeta).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: f.accountId,
          meta: expect.objectContaining({
            birthdayHeight: f.repair.birthdayHeight,
          }),
        }),
      );
      expect(f.removePendingRescan).toHaveBeenCalledWith({
        accountId: f.accountId,
        expectedRepair: f.repair,
      });
      // Epochs are the lifecycle executor's, before it calls these.
      expect(f.rotateAccountEpochs).not.toHaveBeenCalled();
      // Host records are the executor's too.
      expect(f.clearAccountScanData).not.toHaveBeenCalled();
    },
  );

  // The executor stops before host records when the runtime step throws, so
  // the key that names the runtime account survives for a retry.
  it('fails the runtime deletion when storage removal fails', async () => {
    const f = fixture('pending');
    const error = new Error('storage deletion failed');
    f.purgeWallet.mockRejectedValueOnce(error);

    await expect(
      f.vault.zcashDeleteRuntimeAccount({ accountId: f.accountId }),
    ).rejects.toBe(error);
    expect(f.clearAccountScanData).not.toHaveBeenCalled();
  });

  it('sets a rescan height without fetching a live chain tip', async () => {
    const f = fixture('unreadable');
    const getTip = jest
      .spyOn(f.vault, 'getLocalWalletChainTip')
      .mockRejectedValue(new OneKeyLocalError('offline'));
    const saveRepair = jest.fn(async () => undefined);
    Object.assign(f.vault.backgroundApi.simpleDb.privacyChainState, {
      saveZcashPendingRescan: saveRepair,
    });
    jest.spyOn(f.vault, 'applyPendingRescan').mockResolvedValue(undefined);

    await f.vault.zcashRescanFromHeight({
      accountId: f.accountId,
      birthdayHeight: 2_500_000,
      birthdaySource: 'manual-height',
    });

    expect(getTip).not.toHaveBeenCalled();
    expect(saveRepair).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: f.accountId,
        repair: expect.objectContaining({ birthdayHeight: 2_500_000 }),
      }),
    );
  });
});
