/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./localHistory', () => ({
  buildZcashLocalHistoryTx: async ({ item }: { item: { txid: string } }) => ({
    id: item.txid,
    decodedTx: { txid: item.txid, status: 'ok' },
    privacyChainHistorySide: 'private',
    privacyChainHistoryPoolIds: [4],
  }),
  findZcashLocalHistoryItem: jest.fn(),
}));

import { HISTORY_PAGE_SIZE } from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityPrivacyChainCache } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';

import Vault from './Vault';
import { zcashLastPrivateHistory } from './vaultUtils';

// Private rows are never cached outside the runtime, so a failed runtime read
// falls back to the last rows read in this process instead of none.
describe('Zcash private history when the runtime read fails', () => {
  function createVault(getHistory: jest.Mock): Vault {
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
      zcashGetApi: async () => ({
        getHistory,
        getSyncProgress: async () => ({ isBackfillComplete: true }),
      }),
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
    zcashLastPrivateHistory.delete('acc');
    const missing = Object.assign(new Error('ACCOUNT_NOT_FOUND'), {
      code: 'ACCOUNT_NOT_FOUND',
    });
    const getHistory = jest.fn().mockRejectedValue(missing);
    const vault = createVault(getHistory);
    await expect(vault.fetchAccountHistoryFromLocal(params)).resolves.toEqual(
      [],
    );
    expect(getHistory).toHaveBeenCalledTimes(1);
    expect(zcashLastPrivateHistory.has('acc')).toBe(false);
  });

  it('keeps the last private rows read', async () => {
    const getHistory = jest
      .fn()
      .mockResolvedValueOnce([{ txid: 'tx-private' }])
      .mockRejectedValueOnce(new Error('runtime down'));
    const vault = createVault(getHistory);

    await vault.fetchAccountHistoryFromLocal(params);
    const afterFailure = await vault.fetchAccountHistoryFromLocal(params);

    expect(afterFailure?.map((tx) => tx.decodedTx.txid)).toEqual([
      'tx-private',
    ]);
  });

  // The full list always comes from the runtime; memory holds one page.
  it('keeps only the first page for the fallback', async () => {
    const rows = Array.from({ length: HISTORY_PAGE_SIZE + 5 }, (_, index) => ({
      txid: `tx-${index}`,
    }));
    const getHistory = jest
      .fn()
      .mockResolvedValueOnce(rows)
      .mockRejectedValueOnce(new Error('runtime down'));
    const vault = createVault(getHistory);

    const live = await vault.fetchAccountHistoryFromLocal(params);
    expect(live).toHaveLength(rows.length);
    expect(zcashLastPrivateHistory.get('acc')?.items).toHaveLength(
      HISTORY_PAGE_SIZE,
    );
    const afterFailure = await vault.fetchAccountHistoryFromLocal(params);
    expect(afterFailure?.map((tx) => tx.decodedTx.txid)).toEqual(
      rows.slice(0, HISTORY_PAGE_SIZE).map(({ txid }) => txid),
    );
  });

  // Rows remembered for scanned data since destroyed are not shown again.
  it('does not fall back to rows read under an older epoch', async () => {
    const getHistory = jest
      .fn()
      .mockResolvedValueOnce([{ txid: 'tx-before-delete' }])
      .mockRejectedValueOnce(new Error('runtime down'));
    const vault = createVault(getHistory);
    const getAccountEpoch = vault.backgroundApi.simpleDb.privacyChainState
      .getAccountEpoch as jest.Mock;
    getAccountEpoch.mockResolvedValue('aaaaaaaaaaaaaaaa');

    await vault.fetchAccountHistoryFromLocal(params);
    getAccountEpoch.mockResolvedValue('bbbbbbbbbbbbbbbb');
    const afterFailure = await vault.fetchAccountHistoryFromLocal(params);

    expect(afterFailure?.map((tx) => tx.decodedTx.txid)).toEqual([]);
  });
});

describe('Zcash private balance when the runtime read fails', () => {
  function memoryCache() {
    let saved: unknown = null;
    const entity = new SimpleDbEntityPrivacyChainCache();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: jest.fn(async () => saved),
      setItem: jest.fn(async (_key: string, value: unknown) => {
        saved = value;
      }),
      removeItem: jest.fn(async () => {
        saved = null;
      }),
    };
    return entity;
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
          balanceStatus: 'unavailable',
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

  // Kept on disk, so a restart whose first read fails still has it, shown as
  // not current.
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

// A transparent send whose broadcast outcome is unknown is not in the
// backend's list yet; it stays visible as pending so nobody sends it again.
describe('Zcash transparent send the backend has not seen yet', () => {
  function fixture({
    observed = false,
    withJournal = true,
    accepted = false,
    locallyCreated = true,
    incoming = false,
  } = {}) {
    const pendingRow = {
      id: 'row-ab',
      decodedTx: {
        txid: 'AB',
        status: 'Pending',
        createdAt: 1,
        encodedTx: locallyCreated
          ? { zcashMode: 'transparent', expiry: 100 }
          : undefined,
      },
    };
    const settle = jest.fn();
    const save = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as object, {
      accountId: 'acc',
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            getAccountEpoch: jest.fn().mockResolvedValue(undefined),
            getZcashPrivacyModeState: async () => ({ intent: 'off' }),
          },
          privacyChainJournal: {
            listTransparentPendingTxs: async () =>
              withJournal
                ? [
                    {
                      txid: 'ab',
                      broadcastState: accepted ? 'accepted' : 'unknown',
                      createdAt: 1,
                    },
                  ]
                : [],
            settleTransparentPendingTx: settle,
          },
          localHistory: {
            getAccountLocalHistoryConfirmedTxs: async () => [],
            getAccountLocalHistoryPendingTxs: async () => [pendingRow],
            saveLocalHistoryTxs: save,
          },
        },
        serviceToken: { getToken: async () => undefined },
      },
      getAccount: async () => ({ address: 't1-own' }),
      zcashFetchTransparentHistory: async () => ({
        txs: observed
          ? [
              {
                ...pendingRow,
                decodedTx: {
                  txid: 'AB',
                  status: 'Pending',
                  createdAt: 10,
                  owner: 't1-own',
                  signer: incoming ? 't1-other' : 't1-own',
                },
              },
            ]
          : [],
        snapshotComplete: true,
      }),
    }) as unknown as Vault;
    const read = () =>
      vault.fetchAccountHistoryFromLocal({
        accountId: 'acc',
        networkId: 'zec--0',
        accountAddress: 't1-own',
      });
    return { read, settle, save };
  }
  it('keeps the row saved at send time as pending', async () => {
    const { read } = fixture();
    const rows = await read();
    expect(rows?.map((tx) => tx.id)).toEqual(['row-ab']);
    expect(rows?.[0].decodedTx.broadcastOutcomeUnknown).toBe(true);
  });
  it('does not treat a backend Pending row as node acceptance', async () => {
    const { read, settle } = fixture({ observed: true });
    const rows = await read();
    expect(rows?.[0].decodedTx).toMatchObject({
      status: 'Pending',
      broadcastOutcomeUnknown: true,
      createdAt: 1,
      encodedTx: { expiry: 100 },
    });
    expect(settle).not.toHaveBeenCalled();
  });
  it('keeps a legacy pending send with missing journal and expiry traceable', async () => {
    const { read } = fixture({ withJournal: false });
    const rows = await read();
    expect(rows?.map((tx) => tx.id)).toEqual(['row-ab']);
    expect(rows?.[0].decodedTx.broadcastOutcomeUnknown).toBe(true);
  });
  it('keeps known node acceptance while the backend still reports Pending', async () => {
    const { read } = fixture({ observed: true, accepted: true });
    const rows = await read();
    expect(rows?.[0].decodedTx.broadcastOutcomeUnknown).toBe(false);
  });
  it.each([true, false])(
    'does not invent an unknown broadcast for an observed non-local transaction (incoming=%s)',
    async (incoming) => {
      const { read } = fixture({
        observed: true,
        withJournal: false,
        locallyCreated: false,
        incoming,
      });
      const rows = await read();
      expect(rows?.[0].decodedTx.status).toBe('Pending');
      expect(rows?.[0].decodedTx.broadcastOutcomeUnknown).not.toBe(true);
      expect(rows?.[0].decodedTx.createdAt).toBe(10);
    },
  );
  it.each([true, false])(
    'stores only sends from this device in local pending history (incoming=%s)',
    async (incoming) => {
      const { read, save } = fixture({
        observed: true,
        withJournal: !incoming,
        locallyCreated: !incoming,
        incoming,
      });
      await read();
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingTxs: incoming
            ? []
            : [expect.objectContaining({ id: 'row-ab' })],
        }),
      );
    },
  );
});
