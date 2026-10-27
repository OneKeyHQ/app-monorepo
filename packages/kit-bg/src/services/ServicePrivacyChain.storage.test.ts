import { Mutex } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IRuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';

import { SimpleDbEntityPrivacyChainJournal } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
import { SimpleDbEntityPrivacyChainKeys } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { SimpleDbEntityPrivacyChainState } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import { SimpleDbEntityPrivacyChainXmrSent } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainXmrSent';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');
const mockGetChainOnlyVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: mockGetChainOnlyVault },
}));
const mockGetVaultSettings = jest.fn();
jest.mock('../vaults/settings', () => ({
  getVaultSettings: (params: { networkId: string }) =>
    mockGetVaultSettings(params) as Promise<{ localWallet?: unknown }>,
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

type IService = InstanceType<typeof ServicePrivacyChain>;

const networkId = 'xmr--0';
const liveAccountId = 'hd-1--0';
const removedAccountId = 'hd-1--1';
// Locked passphrase wallets are hidden from getWallets() but stay on disk.
const hiddenAccountId = 'hd-2--0';

function accountRow(id: string) {
  return { id, indexedAccountId: `${id}--indexed` };
}

function createPrivacyChainDb(initial?: unknown) {
  const storage = createMemoryStorage(initial ?? null);
  const entity = new SimpleDbEntityPrivacyChainState();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: storage.getItem,
    setItem: storage.setItem,
  };
  return entity;
}

function createKeysDb(accountIds: string[]) {
  const storage = createMemoryStorage({
    data: {
      keys: Object.fromEntries(
        accountIds.map((id) => [
          id,
          {
            networkId,
            vkFp: 'a'.repeat(32),
            sealed: { format: 'plain', value: id },
          },
        ]),
      ),
    },
    updatedAt: 1,
  });
  const entity = new SimpleDbEntityPrivacyChainKeys();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: storage.getItem,
    setItem: storage.setItem,
  };
  return entity;
}

function memoryStorage(initial: unknown) {
  const storage = createMemoryStorage(initial);
  return storage;
}

function createJournalDb(accountIds: string[] = []) {
  const entity = new SimpleDbEntityPrivacyChainJournal();
  (entity as { appStorage: unknown }).appStorage = memoryStorage({
    data: {
      zcashTransparent: Object.fromEntries(
        accountIds.map((id) => [id, { reservations: {}, pendingTxs: {} }]),
      ),
    },
    updatedAt: 1,
  });
  return entity;
}

function createXmrSentDb(accountIds: string[] = []) {
  const entity = new SimpleDbEntityPrivacyChainXmrSent();
  (entity as { appStorage: unknown }).appStorage = memoryStorage({
    data: {
      accounts: Object.fromEntries(
        accountIds.map((id) => [id, { tx: { recipient: `4${id}` } }]),
      ),
    },
    updatedAt: 1,
  });
  return entity;
}

function scanRecord(accountId: string, walletId = 'hd-1') {
  return {
    networkId,
    walletId,
    epoch: accountId
      .replace(/[^0-9]/g, '0')
      .padEnd(16, '0')
      .slice(0, 16),
    scan: { intent: 'on', birthday: { height: 100 } },
    createdAt: 1,
    updatedAt: 1,
  };
}

const lifecycleFields = () => ({
  backfillActiveByAccount: {},
  boostPausedByNetwork: {},
  syncFailureBackoff: new Map(),
  orphanCleanupGeneration: new Map<string, number>(),
  scheduleBackgroundSync: jest.fn(),
});

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flushPromises() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

function createService(overrides: Record<string, unknown>): IService {
  return Object.assign(
    Object.create(ServicePrivacyChain.prototype) as IService,
    overrides,
  );
}

describe('removed-account gc', () => {
  const allIds = [liveAccountId, removedAccountId, hiddenAccountId];

  function createGcHarness(
    getAllAccounts: () => Promise<{
      accounts: { id: string; indexedAccountId?: string }[];
    }>,
    indexedAccountIds: string[] = allIds.map(
      (id) => accountRow(id).indexedAccountId,
    ),
    { wallets = [] as { id: string }[] } = {},
  ) {
    const deleteRuntimeAccount = jest.fn(async () => ({ orphaned: false }));
    const privacyChainKeys = createKeysDb(allIds);
    const removeLastBalances = jest.fn(async () => undefined);
    const privacyChainJournal = createJournalDb(allIds);
    const privacyChainXmrSent = createXmrSentDb(allIds);
    const privacyChainState = createPrivacyChainDb({
      data: {
        accounts: Object.fromEntries(allIds.map((id) => [id, scanRecord(id)])),
        wallets: { 'hd-gone': {}, 'hd-1': {} },
      },
      updatedAt: 1,
    });
    const listAccounts = jest.fn(async () => ({
      accounts: [],
      cleanupAccountIds: allIds,
    }));
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts,
        deleteRuntimeAccount,
      }),
    });
    const serviceAccount = {
      getAllAccounts: jest.fn(getAllAccounts),
      getAllIndexedAccounts: jest.fn(async () => ({
        indexedAccounts: indexedAccountIds.map((id) => ({ id })),
      })),
      // A per-id read would report every one of these as missing.
      getDBAccountSafe: jest.fn(async () => undefined),
      getAccount: jest.fn(async () => {
        throw new OneKeyLocalError('account is gone');
      }),
      getAllWallets: jest.fn(async () => ({
        wallets: [{ id: 'hd-1' }, ...wallets],
      })),
    };
    const service = createService({
      ...lifecycleFields(),
      gcRunning: false,
      gcRequested: false,
      backgroundApi: {
        serviceAccount,
        simpleDb: {
          privacyChainKeys,
          privacyChainCache: {
            listLastBalanceAccountIds: async () => [
              liveAccountId,
              removedAccountId,
            ],
            removeLastBalances,
          },
          privacyChainJournal,
          privacyChainXmrSent,
          privacyChainState,
        },
      },
      getLocalWalletNetworkIds: async () => [networkId],
    });
    return {
      service,
      serviceAccount,
      deleteRuntimeAccount,
      listAccounts,
      privacyChainKeys,
      privacyChainJournal,
      privacyChainXmrSent,
      privacyChainState,
      removeLastBalances,
    };
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockGetChainOnlyVault.mockReset();
  });

  it('purges nothing when the account list cannot be read', async () => {
    const {
      service,
      deleteRuntimeAccount,
      privacyChainKeys,
      privacyChainJournal,
      privacyChainState,
      removeLastBalances,
    } = createGcHarness(async () => {
      throw new OneKeyLocalError('database is locked');
    });

    await service.gcRemovedAccounts();

    expect(deleteRuntimeAccount).not.toHaveBeenCalled();
    expect(removeLastBalances).not.toHaveBeenCalled();
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual(allIds);
    await expect(privacyChainJournal.listAccountIds()).resolves.toEqual(allIds);
    await expect(privacyChainState.listWalletStateIds()).resolves.toContain(
      'hd-gone',
    );
    expect(service.gcRunning).toBe(false);
  });

  it('purges an account that is definitely gone', async () => {
    const {
      service,
      deleteRuntimeAccount,
      privacyChainKeys,
      privacyChainJournal,
      privacyChainXmrSent,
      privacyChainState,
      removeLastBalances,
    } = createGcHarness(async () => ({
      accounts: [accountRow(liveAccountId), accountRow(hiddenAccountId)],
    }));

    await service.gcRemovedAccounts();

    expect(deleteRuntimeAccount).toHaveBeenCalledTimes(1);
    expect(deleteRuntimeAccount).toHaveBeenCalledWith({
      accountId: removedAccountId,
    });
    expect(service.orphanCleanupGeneration.get(networkId)).toBe(1);
    const kept = [liveAccountId, hiddenAccountId];
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual(kept);
    expect(removeLastBalances).toHaveBeenCalledWith({
      accountIds: [removedAccountId],
    });
    await expect(privacyChainJournal.listAccountIds()).resolves.toEqual(kept);
    await expect(privacyChainXmrSent.listAccountIds()).resolves.toEqual(kept);
    await expect(
      privacyChainState.listAccountIds({ networkId }),
    ).resolves.toEqual(kept);
    await expect(privacyChainState.listWalletStateIds()).resolves.toEqual([
      'hd-1',
    ]);
  });

  it('keeps every record of an account whose runtime delete failed', async () => {
    const {
      service,
      deleteRuntimeAccount,
      privacyChainKeys,
      privacyChainJournal,
      privacyChainState,
    } = createGcHarness(async () => ({
      accounts: [accountRow(liveAccountId), accountRow(hiddenAccountId)],
    }));
    deleteRuntimeAccount.mockRejectedValueOnce(new Error('runtime busy'));

    await service.gcRemovedAccounts();

    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual(allIds);
    await expect(privacyChainJournal.listAccountIds()).resolves.toEqual(allIds);
    await expect(
      privacyChainState.listAccountIds({ networkId }),
    ).resolves.toEqual(allIds);
  });

  it('marks the network when a removed account names no runtime account', async () => {
    const { service, deleteRuntimeAccount, privacyChainState } =
      createGcHarness(async () => ({
        accounts: [accountRow(liveAccountId), accountRow(hiddenAccountId)],
      }));
    deleteRuntimeAccount.mockResolvedValueOnce({ orphaned: true });

    await service.gcRemovedAccounts();

    await expect(
      privacyChainState.hasRuntimeOrphans({ networkId }),
    ).resolves.toBe(true);
    await expect(
      privacyChainState.listAccountIds({ networkId }),
    ).resolves.toEqual([liveAccountId, hiddenAccountId]);
  });

  it('removes records no chain lists, unless a chain could not list', async () => {
    const strayId = 'hd-4--0';
    const harness = createGcHarness(async () => ({
      accounts: allIds.map(accountRow),
    }));
    await harness.privacyChainXmrSent.recordXmrSent({
      accountId: strayId,
      txid: 'tx',
      recipient: '4stray',
    });

    harness.listAccounts.mockRejectedValueOnce(new Error('cannot list'));
    await harness.service.gcRemovedAccounts();
    await expect(
      harness.privacyChainXmrSent.listAccountIds(),
    ).resolves.toContain(strayId);

    await harness.service.gcRemovedAccounts();
    await expect(
      harness.privacyChainXmrSent.listAccountIds(),
    ).resolves.not.toContain(strayId);
    expect(harness.deleteRuntimeAccount).not.toHaveBeenCalled();
  });

  it('keeps a hidden or locked passphrase wallet account', async () => {
    const { service, serviceAccount, deleteRuntimeAccount } = createGcHarness(
      async () => ({
        accounts: allIds.map(accountRow),
      }),
    );

    await service.gcRemovedAccounts();

    // Unfiltered: filterRemoved would drop locked passphrase wallets.
    expect(serviceAccount.getAllAccounts).toHaveBeenCalledWith();
    expect(deleteRuntimeAccount).not.toHaveBeenCalled();
    expect(service.orphanCleanupGeneration.get(networkId)).toBeUndefined();
  });

  it('purges an account whose HD account was deleted', async () => {
    const { service, deleteRuntimeAccount, privacyChainKeys } = createGcHarness(
      async () => ({
        accounts: [
          accountRow(liveAccountId),
          accountRow(hiddenAccountId),
          accountRow(removedAccountId),
        ],
      }),
      [liveAccountId, hiddenAccountId].map(
        (id) => accountRow(id).indexedAccountId,
      ),
    );

    await service.gcRemovedAccounts();

    expect(deleteRuntimeAccount).toHaveBeenCalledTimes(1);
    expect(deleteRuntimeAccount).toHaveBeenCalledWith({
      accountId: removedAccountId,
    });
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
      liveAccountId,
      hiddenAccountId,
    ]);
  });

  it('keeps an imported account, which has no indexed account', async () => {
    const importedAccountId = 'imported--0';
    const { service, deleteRuntimeAccount } = createGcHarness(async () => ({
      accounts: [...allIds.map(accountRow), { id: importedAccountId }],
    }));
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({
          accounts: [],
          cleanupAccountIds: [importedAccountId],
        }),
        deleteRuntimeAccount,
      }),
    });

    await service.gcRemovedAccounts();

    expect(deleteRuntimeAccount).not.toHaveBeenCalled();
  });

  function createEmptyGcHarness() {
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({ accounts: [], cleanupAccountIds: [] }),
        deleteRuntimeAccount: jest.fn(),
      }),
    });
    const serviceAccount = {
      getAllAccounts: jest.fn(async () => ({ accounts: [] })),
      getAllIndexedAccounts: jest.fn(async () => ({ indexedAccounts: [] })),
      getAllWallets: jest.fn(async () => ({ wallets: [] })),
    };
    const privacyChainState = createPrivacyChainDb({
      data: { wallets: { 'hd-gone': {} } },
      updatedAt: 1,
    });
    const service = createService({
      ...lifecycleFields(),
      gcRunning: false,
      gcRequested: false,
      backgroundApi: {
        serviceAccount,
        simpleDb: {
          privacyChainKeys: createKeysDb([]),
          privacyChainCache: {
            listLastBalanceAccountIds: async () => [],
            removeLastBalances: jest.fn(),
          },
          privacyChainJournal: createJournalDb(),
          privacyChainXmrSent: createXmrSentDb(),
          privacyChainState,
        },
      },
      getLocalWalletNetworkIds: async () => [networkId],
    });
    return { service, serviceAccount, privacyChainState };
  }

  it('reads no accounts when there is nothing to purge', async () => {
    const { service, serviceAccount, privacyChainState } =
      createEmptyGcHarness();

    await service.gcRemovedAccounts();

    expect(serviceAccount.getAllAccounts).not.toHaveBeenCalled();
    expect(serviceAccount.getAllIndexedAccounts).not.toHaveBeenCalled();
    await expect(privacyChainState.listWalletStateIds()).resolves.toEqual([]);
  });

  it('keeps wallet state while Travel Mode masks the database', async () => {
    jest.spyOn(travelModeManager, 'getRuntimeEnvironment').mockResolvedValue({
      persistence: { kind: 'masked' },
    } as unknown as IRuntimeEnvironment);
    const { service, serviceAccount } = createEmptyGcHarness();

    await service.gcRemovedAccounts();

    expect(serviceAccount.getAllWallets).not.toHaveBeenCalled();
  });

  it('purges nothing while Travel Mode masks the database', async () => {
    jest.spyOn(travelModeManager, 'getRuntimeEnvironment').mockResolvedValue({
      persistence: { kind: 'masked' },
    } as unknown as IRuntimeEnvironment);
    const { service, serviceAccount, deleteRuntimeAccount } = createGcHarness(
      async () => ({ accounts: [] }),
    );

    await service.gcRemovedAccounts();

    expect(serviceAccount.getAllAccounts).not.toHaveBeenCalled();
    expect(deleteRuntimeAccount).not.toHaveBeenCalled();
    expect(serviceAccount.getAllWallets).not.toHaveBeenCalled();
  });
});

describe('pending local data drop retry', () => {
  function createRetryHarness({
    pending,
    cleanupAccountIds = [],
    storedAccountIds,
    dropLocalData = jest.fn(async () => undefined),
  }: {
    pending: string[];
    cleanupAccountIds?: string[];
    storedAccountIds?: string[];
    dropLocalData?: jest.Mock;
  }) {
    const privacyChain = createPrivacyChainDb({
      data: { pendingLocalDataDrop: pending },
      updatedAt: 1,
    });
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({
          accounts: [],
          cleanupAccountIds,
          storedAccountIds,
        }),
        dropLocalData,
      }),
    });
    const service = createService({
      ...lifecycleFields(),
      backgroundApi: {
        simpleDb: {
          privacyChainState: privacyChain,
          privacyChainKeys: createKeysDb([]),
          privacyChainJournal: createJournalDb(),
          privacyChainXmrSent: createXmrSentDb(),
          privacyChainCache: {
            removeLastBalances: jest.fn(async () => undefined),
            removeNetworkLastBalances: jest.fn(async () => undefined),
            removeChainTips: jest.fn(async () => undefined),
          },
        },
      },
    });
    return { service, privacyChain, dropLocalData };
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockGetChainOnlyVault.mockReset();
  });

  it('wipes a pending network and clears its mark', async () => {
    const { service, privacyChain, dropLocalData } = createRetryHarness({
      pending: [networkId],
    });
    await privacyChain.markRuntimeOrphans({ networkId });

    await service.retryPendingLocalDataDrop();

    expect(dropLocalData).toHaveBeenCalledTimes(1);
    await expect(privacyChain.getPendingLocalDataDrop()).resolves.toEqual([]);
    await expect(privacyChain.hasRuntimeOrphans({ networkId })).resolves.toBe(
      false,
    );
  });

  it('keeps the mark when the wipe fails', async () => {
    const { service, privacyChain } = createRetryHarness({
      pending: [networkId],
      dropLocalData: jest.fn(async () => {
        throw new OneKeyLocalError('storage busy');
      }),
    });

    await service.retryPendingLocalDataDrop();

    await expect(privacyChain.getPendingLocalDataDrop()).resolves.toEqual([
      networkId,
    ]);
  });

  it('leaves a network alone once it holds state again', async () => {
    const { service, privacyChain, dropLocalData } = createRetryHarness({
      pending: [networkId],
      cleanupAccountIds: [liveAccountId],
    });

    await service.retryPendingLocalDataDrop();

    expect(dropLocalData).not.toHaveBeenCalled();
    await expect(privacyChain.getPendingLocalDataDrop()).resolves.toEqual([
      networkId,
    ]);
  });

  it('wipes a network whose accounts hold no stored data', async () => {
    const { service, dropLocalData } = createRetryHarness({
      pending: [networkId],
      cleanupAccountIds: [liveAccountId],
      storedAccountIds: [],
    });

    await service.retryPendingLocalDataDrop();

    expect(dropLocalData).toHaveBeenCalledTimes(1);
  });

  it('keeps a network an account stores data in', async () => {
    const { service, dropLocalData } = createRetryHarness({
      pending: [networkId],
      cleanupAccountIds: [liveAccountId],
      storedAccountIds: [liveAccountId],
    });

    await service.retryPendingLocalDataDrop();

    expect(dropLocalData).not.toHaveBeenCalled();
  });

  it('starts from init without holding it up', async () => {
    const retry = deferred();
    const retryPendingLocalDataDrop = jest.fn(() => retry.promise);
    const service = createService({
      initialized: false,
      initPromise: undefined,
      isPrivacySyncOnCellularAllowed: async () => false,
      gcRemovedAccounts: jest.fn(async () => undefined),
      retryPendingLocalDataDrop,
      scheduleBackgroundSync: jest.fn(),
      resumePendingLocalWalletOperations: jest.fn(async () => undefined),
    });

    try {
      await service.init();
      expect(retryPendingLocalDataDrop).toHaveBeenCalledTimes(1);
      expect(service.pendingLocalDataDropRetry).toBeDefined();

      retry.resolve();
      await flushPromises();
      expect(service.pendingLocalDataDropRetry).toBeUndefined();
    } finally {
      clearInterval(service.periodicSyncTimer);
    }
  });

  it('holds the first sync tick until the wipe settles', async () => {
    const retry = deferred();
    const isLocalWalletScanAllowed = jest.fn(async () => false);
    const service = createService({
      syncTickRunning: false,
      syncTickRequested: false,
      pendingLocalDataDropRetry: retry.promise,
      isLocalWalletScanAllowed,
      publishHeldScanProgress: jest.fn(async () => undefined),
      scheduleBackgroundSync: jest.fn(),
    });

    const tick = service.backgroundSyncTick();
    await flushPromises();
    expect(isLocalWalletScanAllowed).not.toHaveBeenCalled();

    retry.resolve();
    await tick;
    expect(isLocalWalletScanAllowed).toHaveBeenCalledTimes(1);
  });

  it('holds an enable until the wipe settles', async () => {
    const retry = deferred();
    const enableAccount = jest.fn(async () => undefined);
    mockGetVaultSettings.mockResolvedValue({ localWallet: {} });
    const service = createService({
      enableMutexByNetwork: new Map<string, Mutex>(),
      pendingLocalDataDropRetry: retry.promise,
      requireAccountCapability: async () => ({ enableAccount }),
      backgroundApi: {
        simpleDb: { privacyChainState: createPrivacyChainDb() },
        serviceAccount: { getWalletSafe: async () => ({ isTemp: false }) },
      },
    });

    const enable = service.enableLocalWalletAccount({
      networkId,
      accountId: liveAccountId,
    });
    await flushPromises();
    expect(enableAccount).not.toHaveBeenCalled();

    retry.resolve();
    await enable;
    expect(enableAccount).toHaveBeenCalledTimes(1);
  });
});

describe.each(['zec--0', 'xmr--0'])(
  'deleting local data on %s',
  (chainNetworkId) => {
    function createDeleteHarness() {
      const calls: string[] = [];
      const capability = {
        getAccountState: jest.fn(async () => ({ enabled: false })),
        deleteRuntimeAccount: jest.fn(async () => {
          calls.push('delete');
          return { orphaned: false };
        }),
        clearPendingSends: jest.fn(
          async ({ scope }: { scope: 'pending' | 'expired' }) => {
            calls.push(`clearPending:${scope}`);
          },
        ),
        enableAccount: jest.fn(async () => {
          calls.push('enable');
        }),
      };
      mockGetVaultSettings.mockResolvedValue({ localWallet: {} });
      const privacyChainKeys = createKeysDb([liveAccountId, hiddenAccountId]);
      const privacyChainState = createPrivacyChainDb();
      const forgetCachedLocalWalletBalance = jest.fn(async () => undefined);
      const service = createService({
        ...lifecycleFields(),
        backgroundApi: {
          simpleDb: {
            privacyChainKeys,
            privacyChainState,
            privacyChainXmrSent: createXmrSentDb([liveAccountId]),
            privacyChainCache: {
              removeLastBalances: jest.fn(async () => undefined),
            },
          },
        },
        enableMutexByNetwork: new Map<string, Mutex>(),
        requireAccountCapability: async () => capability,
        isTempWalletAccount: async () => false,
        onLocalWalletAccountsChanged: jest.fn(async () => undefined),
        forgetCachedLocalWalletBalance,
      });
      return {
        service,
        capability,
        calls,
        privacyChainKeys,
        privacyChainState,
        forgetCachedLocalWalletBalance,
      };
    }
    const params = { networkId: chainNetworkId, accountId: liveAccountId };

    it('accepts the saved request while cleanup is still waiting for a database step', async () => {
      const { service, capability, privacyChainState, privacyChainKeys } =
        createDeleteHarness();
      const step = deferred();
      capability.deleteRuntimeAccount.mockImplementationOnce(async () => {
        await step.promise;
        return { orphaned: false };
      });
      await privacyChainState.saveXmrEnabledAccount({
        ...params,
        vkFp: 'a'.repeat(32),
        birthdayHeight: 100,
      });
      await expect(
        service.deleteLocalWalletAccountData(params),
      ).resolves.toBeUndefined();
      expect(await privacyChainState.getXmrAccountState(params)).toMatchObject({
        intent: 'off',
      });
      expect(
        await privacyChainState.listPendingAccountDeletions(),
      ).toHaveLength(1);
      expect(await privacyChainKeys.listAccountIds()).toContain(liveAccountId);
      step.resolve();
      await service.resumePendingAccountDeletions();
      expect(await privacyChainState.listPendingAccountDeletions()).toEqual([]);
      expect(await privacyChainKeys.listAccountIds()).toEqual([
        hiddenAccountId,
      ]);
    });

    it('deletes local data and expired sends while preserving other accounts', async () => {
      const {
        service,
        calls,
        privacyChainKeys,
        forgetCachedLocalWalletBalance,
      } = createDeleteHarness();
      await service.deleteLocalWalletAccountData(params);
      await service.resumePendingAccountDeletions();
      expect(calls).toEqual(['delete', 'clearPending:expired']);
      expect(await privacyChainKeys.listAccountIds()).toEqual([
        hiddenAccountId,
      ]);
      expect(service.orphanCleanupGeneration.get(chainNetworkId)).toBe(1);
      expect(forgetCachedLocalWalletBalance).toHaveBeenCalledWith(params);
    });

    it('marks orphan cleanup when the runtime identity cannot be named', async () => {
      const { service, capability, privacyChainState } = createDeleteHarness();
      capability.deleteRuntimeAccount.mockResolvedValueOnce({ orphaned: true });
      await service.deleteLocalWalletAccountData(params);
      await service.resumePendingAccountDeletions();
      expect(await privacyChainState.hasRuntimeOrphans(params)).toBe(true);
    });

    it('retains keys and the saved request after a busy runtime, then retries', async () => {
      const { service, capability, privacyChainKeys, privacyChainState } =
        createDeleteHarness();
      const publishSyncError = jest.spyOn(service, 'publishSyncError');
      capability.deleteRuntimeAccount.mockRejectedValue(
        new Error('runtime busy'),
      );
      await service.deleteLocalWalletAccountData(params);
      await service.resumePendingAccountDeletions();
      expect(await privacyChainKeys.listAccountIds()).toContain(liveAccountId);
      expect(
        await privacyChainState.listPendingAccountDeletions(),
      ).toHaveLength(1);
      expect(publishSyncError).not.toHaveBeenCalled();
      capability.deleteRuntimeAccount.mockResolvedValue({ orphaned: false });
      await service.resumePendingAccountDeletions();
      expect(await privacyChainKeys.listAccountIds()).toEqual([
        hiddenAccountId,
      ]);
      expect(await privacyChainState.listPendingAccountDeletions()).toEqual([]);
    });

    it('replays an interrupted deletion after host cleanup but before key deletion', async () => {
      const first = createDeleteHarness();
      const blocked = jest
        .spyOn(first.privacyChainKeys, 'removeKeys')
        .mockRejectedValue(new Error('storage busy'));
      await first.service.deleteLocalWalletAccountData(params);
      await first.service.resumePendingAccountDeletions();
      const saved = await first.privacyChainState.getRawData();
      expect(
        await first.privacyChainState.listPendingAccountDeletions(),
      ).toHaveLength(1);
      blocked.mockRestore();
      const recovered = createDeleteHarness();
      const restoredState = createPrivacyChainDb({ data: saved, updatedAt: 1 });
      Object.assign(recovered.service.backgroundApi.simpleDb, {
        privacyChainState: restoredState,
        privacyChainKeys: first.privacyChainKeys,
      });
      await recovered.service.resumePendingAccountDeletions();
      expect(await restoredState.listPendingAccountDeletions()).toEqual([]);
      expect(await first.privacyChainKeys.listAccountIds()).toEqual([
        hiddenAccountId,
      ]);
    });

    it('replays real generic balance cache write failures before completing deletion', async () => {
      const { service, privacyChainState } = createDeleteHarness();
      delete (
        service as unknown as { forgetCachedLocalWalletBalance?: unknown }
      ).forgetCachedLocalWalletBalance;
      const removeAccountTokenList = jest
        .fn(async () => undefined)
        .mockRejectedValueOnce(new Error('storage temporarily unavailable'));
      const removeAccountNetworkValue = jest.fn(async () => undefined);
      Object.assign(service.backgroundApi, {
        serviceAccount: {
          getDBAccountSafe: async () => ({ id: liveAccountId }),
          getAccount: async () => ({ address: 'synthetic-address' }),
        },
      });
      Object.assign(service.backgroundApi.simpleDb, {
        localTokens: { removeAccountTokenList },
        accountValue: { removeAccountNetworkValue },
      });
      await service.deleteLocalWalletAccountData(params);
      await service.resumePendingAccountDeletions();
      expect(
        await privacyChainState.listPendingAccountDeletions(),
      ).toHaveLength(1);
      await service.resumePendingAccountDeletions();
      expect(await privacyChainState.listPendingAccountDeletions()).toEqual([]);
      expect(removeAccountTokenList).toHaveBeenCalledTimes(2);
      expect(removeAccountNetworkValue).toHaveBeenCalledTimes(1);
    });

    it('does not touch the runtime if the deletion request cannot be saved', async () => {
      const { service, capability, privacyChainState } = createDeleteHarness();
      jest.spyOn(privacyChainState, 'setRawData').mockResolvedValue(undefined);
      await expect(
        service.deleteLocalWalletAccountData(params),
      ).rejects.toThrow('request could not be persisted');
      expect(capability.deleteRuntimeAccount).not.toHaveBeenCalled();
    });

    it('accepts deletion without waiting for an earlier enable, then cleans up in order', async () => {
      const { service, calls, privacyChainState } = createDeleteHarness();
      const enableDone = deferred();
      const mutex = new Mutex();
      service.enableMutexByNetwork.set(chainNetworkId, mutex);
      const holding = mutex.runExclusive(() => enableDone.promise);
      await service.deleteLocalWalletAccountData(params);
      expect(calls).toEqual([]);
      expect(
        await privacyChainState.listPendingAccountDeletions(),
      ).toHaveLength(1);
      enableDone.resolve();
      await holding;
      await service.resumePendingAccountDeletions();
      expect(calls).toEqual(['delete', 'clearPending:expired']);
    });

    it('saves a new enable while old runtime cleanup waits, then preserves the authorization', async () => {
      const {
        service,
        capability,
        calls,
        privacyChainState,
        privacyChainKeys,
      } = createDeleteHarness();
      capability.enableAccount.mockImplementation(async () => {
        calls.push('enable');
        await privacyChainState.saveXmrEnabledAccount({
          ...params,
          vkFp: 'a'.repeat(32),
          birthdayHeight: 200,
        });
      });
      const cleanup = deferred();
      const entered = deferred();
      capability.deleteRuntimeAccount.mockImplementationOnce(async () => {
        calls.push('delete');
        entered.resolve();
        await cleanup.promise;
        return { orphaned: false };
      });
      await service.deleteLocalWalletAccountData(params);
      await entered.promise;
      await service.enableLocalWalletAccount(params);
      expect(capability.enableAccount).toHaveBeenCalledTimes(1);
      expect(
        await privacyChainState.listPendingAccountDeletions(),
      ).toMatchObject([{ reenabled: true }]);
      expect(await privacyChainState.listXmrEnabledAccountIds(params)).toEqual(
        [],
      );
      cleanup.resolve();
      await service.resumePendingAccountDeletions();
      expect(calls).toEqual(['delete', 'enable', 'clearPending:expired']);
      expect(await privacyChainState.listPendingAccountDeletions()).toEqual([]);
      expect(await privacyChainState.getXmrAccountState(params)).toMatchObject({
        intent: 'on',
        birthdayHeight: 200,
      });
      expect(await privacyChainKeys.listAccountIds()).toContain(liveAccountId);
    });
  },
);
