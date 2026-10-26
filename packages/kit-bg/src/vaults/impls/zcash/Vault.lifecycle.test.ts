import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

import { getZcashSyncMutex } from './lifecycle';
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
    const rescanWallet = jest.fn(async () => undefined);
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
            isAccountDeletionPending: async () => false,
            getZcashPrivacyModeState: async () => ({ intent: 'off' }),
            isZcashPrivacyModeEnabled: async () => true,
            listZcashAccountMetas: async () => [{ accountId, meta: account }],
            listZcashMetaAccountIds: async () => [accountId],
            listAccountIds: async () => [accountId],
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
        rescanWallet,
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
      rescanWallet,
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
      expect(f.purgeWallet).toHaveBeenCalledTimes(1);
      expect(f.purgeWallet).toHaveBeenCalledWith(f.account);
      expect(f.rescanWallet).toHaveBeenCalledTimes(2);
      expect(f.rescanWallet).toHaveBeenCalledWith(f.account);
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
      // Invalidate reads before a journaled rescan or database rebuild.
      expect(f.rotateAccountEpochs.mock.calls).toEqual([
        [{ accountIds: [f.accountId] }],
        [{ accountIds: [f.accountId] }],
      ]);
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

  // A height repair from the caller carries `birthdayTimestamp: undefined`;
  // the journal read back has no such key. It must apply on this turn.
  it('applies a journaled repair whose caller copy has undefined keys', async () => {
    const f = fixture('pending');
    await f.vault.applyPendingRescan({
      accountId: f.accountId,
      repair: { ...f.repair, birthdayTimestamp: undefined },
    });
    expect(f.rescanWallet).toHaveBeenCalledTimes(1);
    expect(f.purgeWallet).not.toHaveBeenCalled();
  });

  it('moves the runtime before saving the birthday or rotating epochs', async () => {
    const f = fixture('pending');
    f.rescanWallet.mockImplementationOnce(async () => {
      expect(f.saveAccountMeta).not.toHaveBeenCalled();
      expect(f.rotateAccountEpochs).not.toHaveBeenCalled();
    });
    await f.vault.applyPendingRescan({
      accountId: f.accountId,
      repair: f.repair,
    });
    expect(f.rescanWallet).toHaveBeenCalledTimes(1);
    expect(f.rotateAccountEpochs).toHaveBeenCalledWith({
      accountIds: [f.accountId],
    });
    expect(f.purgeWallet).not.toHaveBeenCalled();
  });

  it('rescans aliases of one viewing key from their earliest birthday', async () => {
    const f = fixture('pending');
    Object.assign(f.vault.backgroundApi.simpleDb.privacyChainState, {
      listZcashAccountMetas: async () => [
        {
          accountId: f.accountId,
          meta: { vkFp: 'shared', birthdayHeight: 2_500_000 },
        },
        {
          accountId: 'alias',
          meta: { vkFp: 'shared', birthdayHeight: 1_900_000 },
        },
        {
          accountId: 'other',
          meta: { vkFp: 'other', birthdayHeight: 1_000_000 },
        },
      ],
    });
    await f.vault.zcashRewindAccount({ accountId: f.accountId });
    await f.vault.applyPendingRescan({
      accountId: f.accountId,
      repair: f.repair,
    });
    expect(f.rescanWallet.mock.calls).toEqual([
      [{ ...f.account, birthdayHeight: 1_900_000 }],
      [{ ...f.account, birthdayHeight: 1_900_000 }],
    ]);
  });

  it('keeps the saved birthday, epochs and journal when the runtime refuses the rescan', async () => {
    const f = fixture('pending');
    f.rescanWallet.mockRejectedValueOnce(new Error('rescan refused'));
    await expect(
      f.vault.applyPendingRescan({
        accountId: f.accountId,
        repair: f.repair,
      }),
    ).rejects.toThrow('rescan refused');
    expect(f.saveAccountMeta).not.toHaveBeenCalled();
    expect(f.rotateAccountEpochs).not.toHaveBeenCalled();
    expect(f.removePendingRescan).not.toHaveBeenCalled();
  });

  it('rotates every account of the network before rebuilding the database', async () => {
    const f = fixture('pending');
    f.dropWalletDatabase.mockImplementationOnce(async () => {
      expect(f.rotateAccountEpochs).toHaveBeenCalledWith({
        accountIds: [f.accountId],
      });
    });
    await zcashRebuildRuntimeDatabase(f.vault);
    expect(f.dropWalletDatabase).toHaveBeenCalledTimes(1);
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

  it('accepts a user birthday after saving the journal without waiting for runtime work', async () => {
    const f = fixture('pending');
    const apply = jest
      .spyOn(f.vault, 'applyPendingRescan')
      .mockRejectedValue(new Error('runtime is busy'));
    const save = jest.fn(async () => undefined);
    Object.assign(f.vault.backgroundApi.simpleDb.privacyChainState, {
      saveZcashPendingRescan: save,
    });
    await expect(
      f.vault.rescanLocalWallet({
        accountId: f.accountId,
        from: { type: 'height', height: 2_500_000 },
      }),
    ).resolves.toEqual({ fromHeight: 2_500_000 });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: f.accountId,
        repair: expect.objectContaining({ birthdayHeight: 2_500_000 }),
      }),
    );
    expect(apply).not.toHaveBeenCalled();
    expect(f.rescanWallet).not.toHaveBeenCalled();
    expect(f.purgeWallet).not.toHaveBeenCalled();
  });

  it('waits for an active scan to finish before deleting its runtime rows', async () => {
    const f = fixture('pending');
    let release: () => void = () => {};
    const step = new Promise<void>((resolve) => {
      release = resolve;
    });
    const scanning = getZcashSyncMutex('main').runExclusive(() => step);
    const deleting = f.vault.zcashDeleteRuntimeAccount({
      accountId: f.accountId,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(f.purgeWallet).not.toHaveBeenCalled();
    release();
    await scanning;
    await expect(deleting).resolves.toEqual({ orphaned: false });
    expect(f.purgeWallet).toHaveBeenCalledTimes(1);
  });
});

describe('Zcash automatic database recovery', () => {
  it.each([
    undefined,
    'migration failed: invalid schema',
    'Wallet database is corrupted: Network type mismatch: account UFVK is for mainnet but attempting to initialize for testnet.',
    'Wallet database is corrupted: invalid account metadata',
    'SQLITE_READONLY',
    'database is locked',
    'no space left on device',
  ])(
    'preserves the database and original migration error: %s',
    async (detail) => {
      const error = Object.assign(new Error('DATABASE_ERROR'), {
        code: 'DATABASE_ERROR',
        params: { operation: 'migrate' },
        detail,
      });
      const rebuild = jest.fn(async () => undefined);
      const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
        syncLocalWalletGroupImpl: jest.fn().mockRejectedValue(error),
        zcashRebuildRuntimeDatabase: rebuild,
      });

      await expect(
        vault.syncLocalWalletGroup({ accountIds: ['synthetic-account'] }),
      ).rejects.toBe(error);
      expect(rebuild).not.toHaveBeenCalled();
    },
  );
});

describe('automatic Zcash repair uses the original account snapshot', () => {
  it.each(['pending', 'applied', 'alias', 'none'] as const)(
    'preserves a newer user birthday (%s)',
    async (change) => {
      const accountId = 'hd-1--race';
      const networkId = 'zec--0';
      const meta = {
        vkFp: 'c'.repeat(32),
        unifiedAddress: 'u1',
        transparentAddress: 't1',
        seedFingerprintHex: 'd'.repeat(64),
        hdIndex: 0,
        birthdayHeight: 2_000_000,
        birthdaySource: 'manual-height' as const,
        createdAt: 1,
      };
      let saved: unknown;
      const db = new SimpleDbEntityPrivacyChainState();
      (db as { appStorage: unknown }).appStorage = {
        getItem: async () => saved,
        setItem: async (_key: string, value: unknown) => {
          saved = value;
        },
      };
      for (const id of [accountId, 'hd-1--alias']) {
        // eslint-disable-next-line no-await-in-loop
        await db.beginZcashPrivacyModeEnable({
          networkId,
          accountId: id,
          birthdayHeight: meta.birthdayHeight,
        });
        // eslint-disable-next-line no-await-in-loop
        await db.saveZcashAccountMeta({ accountId: id, meta });
        // eslint-disable-next-line no-await-in-loop
        await db.completeZcashPrivacyModeEnable({ accountId: id });
      }
      let release: () => void = () => undefined;
      let entered: () => void = () => undefined;
      const progressGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const progressEntered = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const rescanWallet = jest.fn(async () => undefined);
      const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
        networkId,
        backgroundApi: {
          simpleDb: { privacyChainState: db },
          serviceAccount: { getDBAccountSafe: async () => ({ id: accountId }) },
        },
        zcashGetAccountMeta: () => db.getZcashAccountMeta({ accountId }),
        zcashGetWalletAccount: async () => ({
          ...(await db.getZcashAccountMeta({ accountId })),
          ufvk: 'synthetic-ufvk',
        }),
        zcashHealOutOfRangeBirthdays: async () => undefined,
        getLocalWalletAccountAliases: async () => [accountId],
        zcashGetApi: async () => ({
          prepareWalletAccounts: async (accounts: unknown) => accounts,
          getSyncProgress: async () => {
            entered();
            await progressGate;
            return { birthdayHeight: 2_500_000 };
          },
          rescanWallet,
        }),
      });
      const preparing = vault.zcashPrepareAccounts({ accountIds: [accountId] });
      await progressEntered;
      const repair = {
        birthdayHeight: 3_000_000,
        birthdaySource: 'manual-height' as const,
        requestedAt: 2,
      };
      if (change !== 'none')
        await db.saveZcashPendingRescan({
          accountId: change === 'alias' ? 'hd-1--alias' : accountId,
          repair,
        });
      if (change === 'applied')
        await vault.applyPendingRescan({ accountId, repair });
      rescanWallet.mockClear();
      release();
      await preparing;
      if (change === 'none') expect(rescanWallet).toHaveBeenCalledTimes(1);
      else expect(rescanWallet).not.toHaveBeenCalled();
      if (change === 'pending' || change === 'alias')
        expect(await db.listZcashPendingRescans({ networkId })).toEqual([
          { accountId: change === 'alias' ? 'hd-1--alias' : accountId, repair },
        ]);
      if (change === 'applied')
        expect(await db.getZcashAccountMeta({ accountId })).toMatchObject({
          birthdayHeight: 3_000_000,
        });
    },
  );
});

it('heals only the surviving account after filtering a pending deletion', async () => {
  let saved: unknown;
  const db = new SimpleDbEntityPrivacyChainState();
  (db as { appStorage: unknown }).appStorage = {
    getItem: async () => saved,
    setItem: async (_key: string, value: unknown) => {
      saved = value;
    },
  };
  const networkId = 'zec--0';
  const meta = {
    vkFp: 'c'.repeat(32),
    unifiedAddress: 'u1',
    transparentAddress: 't1',
    seedFingerprintHex: 'd'.repeat(64),
    hdIndex: 0,
    birthdaySource: 'manual-height' as const,
    createdAt: 1,
  };
  for (const [accountId, birthdayHeight] of [
    ['hd-1--a', 2_000_000],
    ['hd-1--b', 4_000_000],
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    await db.beginZcashPrivacyModeEnable({
      networkId,
      accountId,
      birthdayHeight,
    });
    // eslint-disable-next-line no-await-in-loop
    await db.saveZcashAccountMeta({
      accountId,
      meta: { ...meta, birthdayHeight },
    });
    // eslint-disable-next-line no-await-in-loop
    await db.completeZcashPrivacyModeEnable({ accountId });
  }
  await db.requestAccountDeletion({ networkId, accountId: 'hd-1--a' });
  const prepareWalletAccounts = jest.fn(
    async (accounts: unknown[]) => accounts,
  );
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    networkId,
    backgroundApi: { simpleDb: { privacyChainState: db } },
    zcashGetAccountMeta: (params: { accountId: string }) =>
      db.getZcashAccountMeta(params),
    zcashGetWalletAccount: async ({ accountId }: { accountId: string }) => ({
      ...(await db.getZcashAccountMeta({ accountId })),
      ufvk: accountId,
    }),
    zcashGetApi: async () => ({
      prepareWalletAccounts,
      getSyncProgress: async () => ({ birthdayHeight: null }),
    }),
  });
  await vault.zcashPrepareAccounts({
    accountIds: ['hd-1--a', 'hd-1--b'],
    chainTip: 3_000_000,
  });
  expect(await db.getZcashAccountMeta({ accountId: 'hd-1--a' })).toMatchObject({
    birthdayHeight: 2_000_000,
  });
  expect(await db.getZcashAccountMeta({ accountId: 'hd-1--b' })).toMatchObject({
    birthdayHeight: 3_000_000,
  });
  expect(prepareWalletAccounts).toHaveBeenCalledWith([
    expect.objectContaining({ ufvk: 'hd-1--b', birthdayHeight: 3_000_000 }),
  ]);
});
