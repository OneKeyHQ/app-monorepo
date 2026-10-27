/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');
jest.mock('./localHistory', () => ({
  buildZcashLocalHistoryTx: async ({ item }: { item: { txid: string } }) => ({
    id: item.txid,
    decodedTx: { txid: item.txid, status: 'ok' },
    privacyChainHistorySide: 'private',
    privacyChainHistoryPoolIds: [4],
  }),
  findZcashLocalHistoryItem: jest.fn(),
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { withMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityPrivacyChainCache } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';

import Vault from './Vault';
import { createZcashSetupIncompleteError } from './vaultUtils';

describe('Zcash private history when the runtime read fails', () => {
  function createVault(
    getHistory: jest.Mock,
    getSyncProgress: jest.Mock = jest
      .fn()
      .mockResolvedValue({ isBackfillComplete: true }),
  ): Vault {
    return Object.assign(Object.create(Vault.prototype) as object, {
      accountId: 'acc',
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            getAccountEpoch: jest.fn().mockResolvedValue(undefined),
            getZcashPrivacyModeState: async () => ({ intent: 'on' }),
          },
          privacyChainJournal: {
            listTransparentPendingTxs: async () => [],
          },
          localHistory: {
            getAccountLocalHistoryConfirmedTxs: async () => [],
            getAccountLocalHistoryPendingTxs: async () => [],
          },
        },
        serviceToken: { getToken: async () => undefined },
      },
      getAccount: async () => ({ address: 't1-own' }),
      zcashGetWalletAccount: async () => ({ ufvk: 'uview-history-test' }),
      zcashGetApi: async () => ({ getHistory, getSyncProgress }),
      zcashFetchTransparentHistory: async () => {
        throw new OneKeyLocalError('indexer down');
      },
    }) as unknown as Vault;
  }
  const params = {
    accountId: 'acc',
    networkId: 'zec--0',
    accountAddress: 't1-own',
  };

  it('returns empty pending history without rejecting while registration is pending', async () => {
    const missing = Object.assign(new Error('ACCOUNT_NOT_FOUND'), {
      code: 'ACCOUNT_NOT_FOUND',
    });
    const getHistory = jest.fn().mockRejectedValue(missing);
    const vault = createVault(getHistory);
    await expect(vault.fetchAccountHistoryFromLocal(params)).resolves.toEqual(
      [],
    );
    expect(getHistory).toHaveBeenCalledTimes(1);
  });

  it('returns empty history while the account setup is unfinished', async () => {
    const getHistory = jest.fn();
    const vault = createVault(getHistory);
    Object.assign(vault, {
      zcashGetWalletAccount: async () => {
        throw createZcashSetupIncompleteError();
      },
    });
    await expect(vault.fetchAccountHistoryFromLocal(params)).resolves.toEqual(
      [],
    );
    expect(getHistory).not.toHaveBeenCalled();
  });

  it('throws when the runtime read fails, never answering from an old page', async () => {
    const getHistory = jest
      .fn()
      .mockResolvedValueOnce([{ txid: 'tx-private' }])
      .mockRejectedValueOnce(new Error('runtime down'));
    const vault = createVault(getHistory);

    await vault.fetchAccountHistoryFromLocal(params);
    await expect(vault.fetchAccountHistoryFromLocal(params)).rejects.toThrow(
      'runtime down',
    );
  });

  it('still returns history when the tip read fails', async () => {
    const getHistory = jest.fn().mockResolvedValue([{ txid: 'tx-private' }]);
    const vault = createVault(
      getHistory,
      jest.fn().mockRejectedValue(new Error('tip down')),
    );
    const rows = await vault.fetchAccountHistoryFromLocal(params);
    expect(rows?.map((tx) => tx.decodedTx.txid)).toEqual(['tx-private']);
  });

  it.each([true, false])(
    'reads retained private history only when an off account is paused=%s',
    async (paused) => {
      const getHistory = jest
        .fn()
        .mockResolvedValue([{ txid: 'paused-private-tx' }]);
      const vault = createVault(getHistory);
      Object.assign(vault.backgroundApi.simpleDb.privacyChainState, {
        getZcashPrivacyModeState: async () => ({
          intent: 'off',
          ...(paused ? { resumeFromHeight: 100 } : {}),
        }),
      });
      const rows = await vault.fetchAccountHistoryFromLocal(params);
      expect(rows?.map((tx) => tx.decodedTx.txid)).toEqual(
        paused ? ['paused-private-tx'] : [],
      );
      expect(getHistory).toHaveBeenCalledTimes(paused ? 1 : 0);
    },
  );
});

describe('Zcash private balance when the runtime read fails', () => {
  function memoryCache() {
    return withMemoryStorage(new SimpleDbEntityPrivacyChainCache());
  }
  function createVault(
    getBalance: jest.Mock,
    privacyChainCache: SimpleDbEntityPrivacyChainCache,
  ) {
    return Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainCache,
          privacyChainState: {
            getAccountEpoch: jest.fn().mockResolvedValue('aaaaaaaaaaaaaaaa'),
          },
        },
      },
      zcashGetWalletAccount: async () => ({ ufvk: 'uview-balance-test' }),
      zcashGetApi: async () => ({ getBalance }),
    });
  }

  it('reports preparing progress and unavailable private funds without repairing a pending registration', async () => {
    jest.useFakeTimers();
    try {
      const missing = Object.assign(new Error('ACCOUNT_NOT_FOUND'), {
        payload: { code: 'ACCOUNT_NOT_FOUND', params: {} },
      });
      const getBalance = jest.fn().mockRejectedValue(missing);
      const vault = createVault(getBalance, memoryCache());
      const repair = jest.fn();
      Object.assign(vault, {
        accountId: 'balance-acc',
        zcashPrivacyModeIsActive: async () => true,
        zcashTryAutoRepairLocalWalletSetupIfUnlocked: repair,
        zcashGetWalletAccount: async () => ({ birthdayHeight: 2_000_000 }),
        zcashGetApi: async () => ({
          getBalance,
          getSyncProgress: async () => {
            throw missing;
          },
        }),
        zcashGetIndexerTransparentBalance: async () => ({}),
      });
      Object.assign(vault.backgroundApi, {
        serviceAccount: { getDBAccount: async () => ({ id: 'balance-acc' }) },
      });
      Object.assign(vault.backgroundApi.simpleDb.privacyChainState, {
        getZcashPrivacyModeState: async () => ({ intent: 'on' }),
      });
      await expect(
        vault.getLocalWalletBalance({ accountId: 'balance-acc' }),
      ).resolves.toBeNull();
      await expect(vault.zcashGetBalanceSafe()).resolves.toBeNull();
      await expect(
        vault.getLocalWalletSyncProgress({ accountId: 'balance-acc' }),
      ).resolves.toEqual({
        birthdayHeight: 2_000_000,
        backfillScannedHeight: null,
        backfillTargetHeight: null,
        backfillProgress: 0,
        isBackfillComplete: false,
        tipScannedHeight: null,
        chainTip: null,
        tipLag: null,
        isTipCaughtUp: false,
        isSyncing: true,
      });
      const balance = await vault.getLocalWalletAccountBalance({
        accountId: 'balance-acc',
      });
      for (const key of ['ironwood', 'orchard']) {
        expect(balance?.pools.find((item) => item.key === key)).toMatchObject({
          total: undefined,
          spendable: undefined,
          move: { enabled: false },
        });
      }
      const sendPools = await vault.listLocalWalletSendPools({
        accountId: 'balance-acc',
      });
      expect(
        sendPools?.find((item) => item.key === 'ironwood')?.spendable,
      ).toBeUndefined();
      expect(
        sendPools?.find((item) => item.key === 'orchard')?.spendable,
      ).toBeUndefined();
      expect(repair).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('answers with the last balance read, even after a restart', async () => {
    const balance = { shielded: '5', isComplete: true };
    const privacyChainCache = memoryCache();
    await createVault(
      jest.fn().mockResolvedValueOnce(balance),
      privacyChainCache,
    ).getLocalWalletBalance({ accountId: 'balance-acc' });

    const restarted = createVault(
      jest.fn().mockRejectedValueOnce(new Error('runtime down')),
      privacyChainCache,
    );
    await expect(
      restarted.getLocalWalletBalance({ accountId: 'balance-acc' }),
    ).resolves.toEqual({ ...balance, isComplete: false });
  });

  it('answers nothing when no balance was ever read', async () => {
    const vault = createVault(
      jest.fn().mockRejectedValueOnce(new Error('runtime down')),
      memoryCache(),
    );
    await expect(
      vault.getLocalWalletBalance({ accountId: 'balance-acc' }),
    ).resolves.toBeNull();
  });
});
