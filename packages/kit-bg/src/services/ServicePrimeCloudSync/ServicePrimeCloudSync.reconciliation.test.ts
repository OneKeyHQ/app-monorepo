import { Semaphore } from 'async-mutex';
import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCheckServerStatusResult,
  ICloudSyncServerItem,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import simpleDb from '../../dbs/simple/simpleDb';
import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';

import ServicePrimeCloudSync from './ServicePrimeCloudSync';

import type { IDBCloudSyncItem } from '../../dbs/local/types';
import type { IPrimeCloudSyncPersistAtomData } from '../../states/jotai/atoms/prime';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthroughDecorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];

  return {
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    backgroundMethodForDev: passthroughDecorator,
    toastIfError: passthroughDecorator,
  };
});

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBaseMock {
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    backgroundApi: unknown;
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  primeCloudSyncPersistAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  addressBookPersistAtom: {},
  devSettingsPersistAtom: { get: jest.fn(async () => ({})) },
  primeMasterPasswordPersistAtom: {},
  primePersistAtom: {},
}));

jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAccount', () => ({
  CloudSyncFlowManagerAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAddressBook', () => ({
  CloudSyncFlowManagerAddressBook: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBotWallet', () => ({
  CloudSyncFlowManagerBotWallet: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBrowserBookmark', () => ({
  CloudSyncFlowManagerBrowserBookmark: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomNetwork', () => ({
  CloudSyncFlowManagerCustomNetwork: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomRpc', () => ({
  CloudSyncFlowManagerCustomRpc: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomToken', () => ({
  CloudSyncFlowManagerCustomToken: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerIndexedAccount', () => ({
  CloudSyncFlowManagerIndexedAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerLock', () => ({
  CloudSyncFlowManagerLock: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerMarketWatchList', () => ({
  CloudSyncFlowManagerMarketWatchList: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerWallet', () => ({
  CloudSyncFlowManagerWallet: jest.fn(),
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getAllSyncItems: jest.fn(),
    getRecordsByIds: jest.fn(),
    addAndUpdateSyncItems: jest.fn(),
    removeCloudSyncPoolItems: jest.fn(),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    cloudSyncAccountIssues: { getRawData: jest.fn(async () => null) },
  },
}));

jest.mock('./botWalletCloudSyncUtils', () => ({
  filterBotWalletRecordsByCurrentKeylessSyncScope: jest.fn(),
}));

jest.mock('./cloudSyncCheckUtils', () => ({
  ...jest.requireActual<typeof import('./cloudSyncCheckUtils')>(
    './cloudSyncCheckUtils',
  ),
  buildOnlyCheckLocalDataTypes: jest.fn(),
}));

jest.mock('./cloudSyncItemBuilder', () => ({
  __esModule: true,
  default: {
    normalizeDataTime: (time: number | undefined) => time,
    setDefaultPropsOfServerToLocalItem: ({
      localItem,
    }: {
      localItem: { localSceneUpdated: boolean; serverUploaded: boolean };
    }) => {
      localItem.localSceneUpdated = false;
      localItem.serverUploaded = true;
      return localItem;
    },
    getPwdHash: (credential?: { masterPasswordUUID: string }) =>
      credential?.masterPasswordUUID ?? '',
  },
}));

jest.mock('./keylessCloudSyncUtils', () => ({
  __esModule: true,
  default: { isKeylessPwdHash: () => false },
}));

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function serverItem(index: number): ICloudSyncServerItem {
  return {
    key: `public-root-record-${index}`,
    data: `public-synthetic-ciphertext-${index}`,
    dataTimestamp: 1_750_000_000_000 + index,
    dataType: EPrimeCloudSyncDataType.Account,
    isDeleted: false,
    pwdHash: 'public-root-space',
  };
}

function reply(
  overrides: Partial<ICloudSyncCheckServerStatusResult> = {},
): ICloudSyncCheckServerStatusResult {
  return {
    diff: [],
    updated: [],
    deleted: [],
    obsoleted: [],
    pwdHash: 'public-root-space',
    serverTime: Date.now(),
    reconciliation: {
      version: 1,
      diffBeforeLimit: true,
      includesDeleted: true,
      hasMore: true,
      maxItems: 500,
      maxBytes: 1024 * 1024,
    },
    ...overrides,
  };
}

const services: ServicePrimeCloudSync[] = [];

function harness(
  remoteCount = 0,
  initial: {
    initialConfig?: IPrimeCloudSyncPersistAtomData;
    initialPool?: ReadonlyMap<string, IDBCloudSyncItem>;
  } = {},
) {
  const defaultConfig: IPrimeCloudSyncPersistAtomData = {
    isCloudSyncEnabled: false,
    isCloudSyncEnabledKeyless: true,
    cloudSyncAccountApplyVersion: 2,
  };
  let config = cloneDeep(initial.initialConfig ?? defaultConfig);
  const getConfig = jest
    .mocked(primeCloudSyncPersistAtom.get)
    .mockImplementation(async () => config);
  const setConfig = jest
    .mocked(primeCloudSyncPersistAtom.set)
    .mockImplementation(async (update) => {
      config = typeof update === 'function' ? update(config) : update;
    });
  const pool = new Map<string, IDBCloudSyncItem>(
    Array.from(
      initial.initialPool ?? [],
      ([key, row]) => [key, cloneDeep(row)] as const,
    ),
  );
  const remote = Array.from({ length: remoteCount }, (_, index) =>
    serverItem(index),
  );
  const sourceMutex = new Semaphore(1);
  let keyGeneration = 0;
  const isLocked = jest.fn(async () => false);
  const runWithCloudSyncKeyLock = jest.fn((operation: () => Promise<unknown>) =>
    sourceMutex.runExclusive(operation),
  );
  const service = new ServicePrimeCloudSync({
    backgroundApi: {
      localDb,
      serviceApp: { isAppLocked: isLocked },
      serviceKeylessCloudSync: {
        runWithCloudSyncKeyLock,
        getCloudAccountImportGeneration: () => keyGeneration,
      },
    },
  });
  services.push(service);
  jest.spyOn(service, 'isCloudSyncIsAvailable').mockResolvedValue(true);
  jest
    .spyOn(service, 'ensureCloudSyncIsAvailable')
    .mockResolvedValue(undefined);
  jest
    .spyOn(service, 'getActiveSyncMode')
    .mockResolvedValue(ECloudSyncMode.Keyless);
  jest.spyOn(service, 'getSyncCredentialSafe').mockResolvedValue({
    masterPasswordUUID: 'public-root-space',
    primeAccountSalt: 'public-fixture',
    securityPasswordR1: 'unused-test-only',
  });
  jest
    .spyOn(service, 'fillingSyncItemsMissingDataFromRawData')
    .mockResolvedValue(undefined);
  const scene = jest
    .spyOn(service, 'syncToSceneWithLocalSyncItems')
    .mockResolvedValue(undefined);
  const replay = jest
    .spyOn(service, 'syncPendingItemsToScene')
    .mockResolvedValue(undefined);
  const publishStatus = jest
    .spyOn(service, 'publishPublicAccountSnapshotStatus')
    .mockImplementation(async ({ counts }) => {
      config = { ...config, publicAccountSnapshotStatus: { ...counts } };
    });
  const updateLastSyncTime = jest
    .spyOn(service, 'updateLastSyncTime')
    .mockResolvedValue(undefined);
  const getPool = jest
    .spyOn(localDb, 'getAllSyncItems')
    .mockImplementation(async () => ({
      syncItems: Array.from(pool.values()).map((row) => cloneDeep(row)),
    }));
  const getRecords = jest
    .spyOn(localDb, 'getRecordsByIds')
    .mockImplementation(async ({ ids }) => ({
      records: ids.map((id) => cloneDeep(pool.get(id))),
    }));
  let commitGate: (() => Promise<void>) | undefined;
  let rollbacks = 0;
  const committedBatches: number[] = [];
  const writePool = jest
    .spyOn(localDb, 'addAndUpdateSyncItems')
    .mockImplementation(async ({ items, fn }) => {
      const staged = new Map(
        Array.from(pool, ([key, value]) => [key, cloneDeep(value)]),
      );
      for (const row of items) {
        const previous = staged.get(row.id);
        if (!previous || (row.dataTime ?? 0) >= (previous.dataTime ?? 0))
          staged.set(row.id, cloneDeep(row));
      }
      const gate = commitGate;
      commitGate = undefined;
      try {
        if (gate) await gate();
        await fn?.();
        pool.clear();
        staged.forEach((row, key) => pool.set(key, row));
        committedBatches.push(items.length);
      } catch (error) {
        rollbacks += 1;
        throw error;
      }
    });
  const firstCheck = deferred<void>();
  const check = jest
    .spyOn(service, 'checkServerStatusWithRequestOptions')
    .mockImplementation(async ({ localItems = [] }, options = {}) => {
      firstCheck.resolve();
      const summary = new Map(localItems.map((row) => [row.id, row]));
      const remaining = remote.filter(
        (row) => summary.get(row.key)?.dataTime !== row.dataTimestamp,
      );
      const batch = remaining.slice(
        0,
        options.reconciliation?.maxItems ?? remaining.length,
      );
      return {
        diff: batch,
        updated: [],
        deleted: [],
        obsoleted: [],
        pwdHash: 'public-root-space',
        serverTime: Date.now(),
        reconciliation: options.reconciliation
          ? {
              ...options.reconciliation,
              diffBeforeLimit: true,
              includesDeleted: true,
              hasMore: remaining.length > batch.length,
            }
          : undefined,
      };
    });
  service.syncManagers.account.removeSyncItemIfServerDeleted = false;
  return {
    service,
    sourceMutex,
    pool,
    remote,
    check,
    firstCheck,
    writePool,
    getPool,
    getRecords,
    scene,
    replay,
    publishStatus,
    isLocked,
    updateLastSyncTime,
    getConfig,
    setConfig,
    committedBatches,
    config: () => config,
    patchConfig: (update: Partial<IPrimeCloudSyncPersistAtomData>) => {
      config = { ...config, ...update };
    },
    holdNextCommit: () => {
      const entered = deferred<void>();
      const release = deferred<void>();
      commitGate = async () => {
        entered.resolve();
        await release.promise;
      };
      return { entered, release };
    },
    rollbacks: () => rollbacks,
    changeSource: () => {
      keyGeneration += 1;
    },
    run: () => service.startServerSyncFlowSilently({ throwError: true }),
  };
}

describe('root Cloud reconciliation integration with the actual runner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_750_000_000_000);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest
      .mocked(simpleDb.cloudSyncAccountIssues.getRawData)
      .mockResolvedValue(null);
  });
  afterEach(async () => {
    for (const service of services.splice(0))
      await service.cancelPublicAccountSnapshotImport();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test.each([
    { forceSync: true },
    { isFlush: true, encryptedSecurityPasswordR1ForServer: 'public-test-lock' },
    { noDebounceUpload: true, setUndefinedTimeToNow: true },
  ])('preserves explicit concurrent sync parameters %p', async (params) => {
    const h = harness();
    const entered = deferred<void>();
    const release = deferred<boolean>();
    const selected = jest
      .spyOn(
        h.service as unknown as {
          startServerSyncFlowWithSelectedKey: (
            value: object,
          ) => Promise<boolean>;
        },
        'startServerSyncFlowWithSelectedKey',
      )
      .mockImplementationOnce(async () => {
        entered.resolve();
        return release.promise;
      })
      .mockResolvedValueOnce(true);
    const first = h.service.startServerSyncFlowSilently();
    await entered.promise;
    const second = h.service.startServerSyncFlowSilently(params);
    expect(selected).toHaveBeenCalledTimes(1);
    release.resolve(false);
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    expect(selected).toHaveBeenCalledTimes(2);
    expect(selected).toHaveBeenLastCalledWith(expect.objectContaining(params));
  });

  test('does not replay a queued flush across a key switch', async () => {
    const h = harness();
    const entered = deferred<void>();
    const release = deferred<boolean>();
    const selected = jest
      .spyOn(
        h.service as unknown as {
          startServerSyncFlowWithSelectedKey: (
            value: object,
          ) => Promise<boolean>;
        },
        'startServerSyncFlowWithSelectedKey',
      )
      .mockImplementationOnce(async () => {
        entered.resolve();
        return release.promise;
      });
    const first = h.service.startServerSyncFlowSilently();
    await entered.promise;
    const second = h.service.startServerSyncFlowSilently({ isFlush: true });
    h.changeSource();
    release.resolve(true);
    await first;
    await expect(second).resolves.toBe(false);
    expect(selected).toHaveBeenCalledTimes(1);
  });

  test('more than 500 remote records use fresh complete summaries and pool transactions of at most 50', async () => {
    const h = harness(1200);
    await expect(h.run()).resolves.toBe(true);
    expect(h.check).toHaveBeenCalledTimes(3);
    expect(
      h.check.mock.calls.map(([params]) => params.localItems?.length),
    ).toEqual([0, 500, 1000]);
    expect(h.pool.size).toBe(1200);
    expect(h.committedBatches).toHaveLength(24);
    expect(h.committedBatches.every((size) => size <= 50)).toBe(true);
    expect(
      h.writePool.mock.calls.every(
        ([params]) => typeof params.fn === 'function',
      ),
    ).toBe(true);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      unfinished: false,
      requests: 3,
      rounds: 3,
      applied: 1200,
    });
    expect(h.sourceMutex.isLocked()).toBe(false);
  });

  test('request-budget exhaustion persists waiting and its timer resumes from the current full summary', async () => {
    const h = harness(4500);
    await expect(h.run()).resolves.toBe(false);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'waiting',
      reason: 'request-budget',
      unfinished: true,
      requests: 8,
      applied: 4000,
    });
    expect(h.pool.size).toBe(4000);
    await jest.advanceTimersByTimeAsync(1000);
    expect(h.check).toHaveBeenCalledTimes(9);
    expect(h.check.mock.calls[8][0].localItems).toHaveLength(4000);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      unfinished: false,
      requests: 9,
      applied: 4500,
    });
    expect(h.pool.size).toBe(4500);
  });

  test.each(['locked', 'offline'] as const)(
    'a completed run recovers a persisted deletion after %s shutdown and service recreation',
    async (blocked) => {
      const first = harness();
      await first.run();
      expect(first.config().cloudSyncReconciliation).toMatchObject({
        status: 'complete',
        unfinished: false,
      });
      const row = serverItem(0);
      first.pool.set(row.key, {
        id: row.key,
        data: row.data,
        dataTime: row.dataTimestamp,
        dataType: row.dataType,
        pwdHash: row.pwdHash,
        isDeleted: true,
        rawData: '',
        rawKey: '',
        localSceneUpdated: true,
        serverUploaded: false,
      });
      if (blocked === 'locked') first.isLocked.mockResolvedValue(true);
      else await first.service.setCloudSyncNetworkReachable(false);
      await first.service.startServerSyncFlowSilently({ localMutation: true });
      expect(first.check).toHaveBeenCalledTimes(1);
      const savedConfig = cloneDeep(first.config());
      const shutdownAt = Date.now();
      jest.clearAllTimers();
      jest.setSystemTime(shutdownAt);
      const restarted = harness(0, {
        initialConfig: savedConfig,
        initialPool: first.pool,
      });
      const upload = jest
        .spyOn(restarted.service, '_callApiUploadItems')
        .mockResolvedValue({ nonce: 0, created: 0, updated: 1 });
      const response = reply({ obsoleted: [row.key] });
      if (response.reconciliation) response.reconciliation.hasMore = false;
      restarted.check.mockResolvedValue(response);
      if (blocked === 'locked') restarted.isLocked.mockResolvedValue(true);
      else await restarted.service.setCloudSyncNetworkReachable(false);
      await restarted.service.resumeCloudSyncReconciliation({
        reason: 'startup',
      });
      expect(restarted.check).not.toHaveBeenCalled();
      restarted.isLocked.mockResolvedValue(false);
      await restarted.service.setCloudSyncNetworkReachable(true);
      await restarted.service.resumeCloudSyncReconciliation({
        reason: blocked === 'locked' ? 'unlock' : 'network',
      });
      expect(restarted.check).toHaveBeenCalledTimes(1);
      expect(upload).toHaveBeenCalledWith(
        expect.objectContaining({
          localItems: [
            expect.objectContaining({ id: row.key, isDeleted: true }),
          ],
        }),
      );
    },
  );

  test('completed-state wake ignores persisted dirty records from another space', async () => {
    const h = harness();
    await h.run();
    const row = serverItem(0);
    h.pool.set(row.key, {
      id: row.key,
      data: row.data,
      dataTime: row.dataTimestamp,
      dataType: row.dataType,
      pwdHash: 'other-space',
      isDeleted: true,
      rawData: '',
      rawKey: '',
      localSceneUpdated: true,
      serverUploaded: false,
    });
    await h.service.resumeCloudSyncReconciliation({ reason: 'startup' });
    expect(h.check).toHaveBeenCalledTimes(1);
  });

  test.each(['startup', 'unlock'] as const)(
    'a new Service instance resumes saved waiting state on %s without bypassing cooldown or lock',
    async (resumeReason) => {
      const first = harness(4500);
      await first.run();
      const savedConfig = cloneDeep(first.config());
      expect(savedConfig.cloudSyncReconciliation).toMatchObject({
        status: 'waiting',
        unfinished: true,
        requests: 8,
        applied: 4000,
      });
      expect(first.pool.size).toBe(4000);
      // Discard the old JS timers without invoking cancellation or changing the
      // durable snapshot. This models Service recreation, not a native restart.
      const shutdownAt = Date.now();
      jest.clearAllTimers();
      // Sinon reset also restores its initial clock; retain the restart time.
      jest.setSystemTime(shutdownAt);
      const restarted = harness(4500, {
        initialConfig: savedConfig,
        initialPool: first.pool,
      });
      expect(restarted.service).not.toBe(first.service);
      expect(restarted.check).not.toBe(first.check);
      expect(restarted.config()).toEqual(savedConfig);
      expect(savedConfig.cloudSyncReconciliation?.nextRetryAt).toBeGreaterThan(
        Date.now(),
      );
      restarted.isLocked.mockResolvedValue(resumeReason === 'unlock');
      await restarted.service.resumeCloudSyncReconciliation({
        reason: 'startup',
      });
      expect(restarted.check).not.toHaveBeenCalled();
      expect(restarted.config().cloudSyncReconciliation).toEqual(
        savedConfig.cloudSyncReconciliation,
      );
      jest.clearAllTimers();
      jest.setSystemTime(
        savedConfig.cloudSyncReconciliation?.nextRetryAt ?? Date.now(),
      );
      if (resumeReason === 'unlock') {
        await restarted.service.resumeCloudSyncReconciliation({
          reason: 'startup',
        });
        expect(restarted.check).not.toHaveBeenCalled();
        restarted.isLocked.mockResolvedValue(false);
      }
      await restarted.service.resumeCloudSyncReconciliation({
        reason: resumeReason,
      });
      expect(restarted.check).toHaveBeenCalledTimes(1);
      expect(restarted.check.mock.calls[0][0].localItems).toHaveLength(4000);
      expect(restarted.pool.size).toBe(4500);
      expect(restarted.config().cloudSyncReconciliation).toMatchObject({
        status: 'complete',
        unfinished: false,
        requests: 9,
        rounds: 9,
        applied: 4500,
      });
      expect(restarted.committedBatches.every((size) => size <= 50)).toBe(true);
    },
  );

  test.each([400, 422])(
    'strict legacy status %s falls back once without capability and never drains a second legacy batch',
    async (status) => {
      const h = harness(700);
      h.check.mockImplementationOnce(async () => {
        throw Object.assign(new OneKeyLocalError('Synthetic strict backend'), {
          response: { status },
        });
      });
      await expect(h.run()).resolves.toBe(false);
      expect(h.check).toHaveBeenCalledTimes(2);
      expect(h.check.mock.calls[0][1]?.reconciliation).toBeDefined();
      expect(h.check.mock.calls[1][1]?.reconciliation).toBeUndefined();
      expect(h.check.mock.calls[1][1]?.signal).toBe(
        h.check.mock.calls[0][1]?.signal,
      );
      expect(h.pool.size).toBe(700);
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'blocked',
        reason: 'backend-unverified',
        unfinished: true,
        requests: 2,
      });
      await jest.advanceTimersByTimeAsync(2000);
      expect(h.check).toHaveBeenCalledTimes(2);
    },
  );

  test.each([401, 403])(
    'authentication status %s never takes the legacy downgrade path',
    async (status) => {
      const h = harness();
      h.check.mockRejectedValue(
        Object.assign(new OneKeyLocalError('Synthetic auth failure'), {
          response: { status },
        }),
      );
      const pending = h.run();
      await jest.advanceTimersByTimeAsync(1000);
      await pending;
      expect(h.check).toHaveBeenCalledTimes(3);
      expect(
        h.check.mock.calls.every(
          ([, options]) => options?.reconciliation !== undefined,
        ),
      ).toBe(true);
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        reason: 'retry-exhausted',
        requests: 3,
        unfinished: true,
      });
    },
  );

  test.each(['deadline', 'cancel'])(
    '%s while a transaction is paused rolls back before releasing the source lock',
    async (mode) => {
      const h = harness(50);
      const commit = h.holdNextCommit();
      let settled = false;
      const pending = h.run().finally(() => {
        settled = true;
      });
      await commit.entered.promise;
      expect(h.pool.size).toBe(0);
      if (mode === 'deadline') await jest.advanceTimersByTimeAsync(20_000);
      else await h.service.cancelPublicAccountSnapshotImport();
      expect(settled).toBe(false);
      expect(h.sourceMutex.isLocked()).toBe(true);
      let switched = false;
      const switchKey = h.sourceMutex.runExclusive(async () => {
        switched = true;
      });
      await Promise.resolve();
      expect(switched).toBe(false);
      commit.release.resolve();
      await pending;
      await switchKey;
      expect(h.rollbacks()).toBe(1);
      expect(h.pool.size).toBe(0);
      expect(switched).toBe(true);
      expect(h.sourceMutex.isLocked()).toBe(false);
    },
  );

  test('a cancelled HTTP check cannot commit its late old-source reply', async () => {
    const h = harness(1);
    const ready = deferred<void>();
    const network = deferred<ICloudSyncCheckServerStatusResult>();
    h.check.mockImplementationOnce(async () => {
      ready.resolve();
      return network.promise;
    });
    const pending = h.run();
    await ready.promise;
    const signal = h.check.mock.calls[0][1]?.signal;
    await h.service.cancelPublicAccountSnapshotImport();
    await pending;
    expect(signal?.aborted).toBe(true);
    h.changeSource();
    network.resolve({
      diff: h.remote,
      updated: [],
      deleted: [],
      obsoleted: [],
      pwdHash: 'public-root-space',
      serverTime: Date.now(),
    });
    await Promise.resolve();
    expect(h.writePool).not.toHaveBeenCalled();
    expect(h.pool.size).toBe(0);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'waiting',
      reason: 'cancelled',
      unfinished: true,
    });
  });

  test('an aborted runner awaits a late upload without blocking source switches', async () => {
    const h = harness();
    const row = serverItem(0);
    h.pool.set(row.key, {
      id: row.key,
      data: row.data,
      dataTime: row.dataTimestamp,
      dataType: row.dataType,
      pwdHash: row.pwdHash,
      isDeleted: false,
      rawData: '',
      rawKey: '',
      localSceneUpdated: true,
      serverUploaded: false,
    });
    h.check.mockResolvedValue(reply({ obsoleted: [row.key] }));
    const entered = deferred<void>();
    const release = deferred<void>();
    const upload = jest
      .spyOn(h.service, '_callApiUploadItems')
      .mockImplementationOnce(async () => {
        entered.resolve();
        await release.promise;
        return { nonce: 0, created: 1, updated: 0 };
      });
    let settled = false;
    const pending = h.run().finally(() => {
      settled = true;
    });
    await entered.promise;
    await jest.advanceTimersByTimeAsync(20_000);
    expect(upload.mock.calls[0][0].requestOptions?.signal?.aborted).toBe(true);
    expect(settled).toBe(false);
    expect(h.sourceMutex.isLocked()).toBe(false);
    let switched = false;
    const switchKey = h.sourceMutex.runExclusive(async () => {
      switched = true;
    });
    await Promise.resolve();
    expect(switched).toBe(true);
    release.resolve();
    await pending;
    await switchKey;
    expect(switched).toBe(true);
    expect(h.sourceMutex.isLocked()).toBe(false);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  test('local mutations share one cooldown retry without starting a legacy polling loop', async () => {
    const h = harness();
    h.check.mockResolvedValue({ ...reply(), reconciliation: undefined });
    await h.run();
    expect(h.config().cloudSyncReconciliation?.reason).toBe(
      'backend-unverified',
    );
    for (let index = 0; index < 20; index += 1)
      await h.service.startServerSyncFlowSilently({ localMutation: true });
    expect(h.check).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(59_999);
    expect(h.check).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(h.check).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(h.check).toHaveBeenCalledTimes(2);
  });

  test.each(['locked', 'offline'] as const)(
    'a %s local retry waits for recovery without sending or dropping pending work',
    async (blocked) => {
      const h = harness();
      h.check.mockResolvedValue({ ...reply(), reconciliation: undefined });
      await h.run();
      await h.service.startServerSyncFlowSilently({ localMutation: true });
      if (blocked === 'locked') h.isLocked.mockResolvedValue(true);
      else await h.service.setCloudSyncNetworkReachable(false);
      await jest.advanceTimersByTimeAsync(120_000);
      expect(h.check).toHaveBeenCalledTimes(1);
      h.isLocked.mockResolvedValue(false);
      await h.service.setCloudSyncNetworkReachable(true);
      await h.service.resumeCloudSyncReconciliation({ reason: 'network' });
      expect(h.check).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(120_000);
      expect(h.check).toHaveBeenCalledTimes(2);
    },
  );

  test.each(['cancel', 'generation', 'space'] as const)(
    'a %s change cancels an old local-mutation retry without waking the new space',
    async (change) => {
      const h = harness();
      h.check.mockResolvedValue({ ...reply(), reconciliation: undefined });
      await h.run();
      await h.service.startServerSyncFlowSilently({ localMutation: true });
      if (change === 'cancel')
        await h.service.cancelPublicAccountSnapshotImport();
      else if (change === 'generation') h.changeSource();
      else
        jest.spyOn(h.service, 'getSyncCredentialSafe').mockResolvedValue({
          masterPasswordUUID: 'other-space',
          primeAccountSalt: 'other-fixture',
          securityPasswordR1: 'unused-test-only',
        });
      await jest.advanceTimersByTimeAsync(120_000);
      expect(h.check).toHaveBeenCalledTimes(1);
    },
  );

  test('a local mutation after an in-flight summary gets a follow-up even if the current drain completes', async () => {
    const h = harness();
    const ready = deferred<void>();
    const response = deferred<ICloudSyncCheckServerStatusResult>();
    h.check.mockImplementationOnce(async () => {
      ready.resolve();
      return response.promise;
    });
    const running = h.run();
    await ready.promise;
    const mutation = h.service.startServerSyncFlowSilently({
      localMutation: true,
    });
    await Promise.resolve();
    const complete = reply();
    if (complete.reconciliation) complete.reconciliation.hasMore = false;
    response.resolve(complete);
    await Promise.all([running, mutation]);
    expect(h.config().cloudSyncReconciliation?.status).toBe('complete');
    await jest.advanceTimersByTimeAsync(1000);
    expect(h.check).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(h.check).toHaveBeenCalledTimes(2);
  });

  test('an old run awaiting the lock check cannot erase a new-space mutation queued into it', async () => {
    const h = harness();
    const entered = deferred<void>();
    const locked = deferred<boolean>();
    h.isLocked.mockImplementationOnce(async () => {
      entered.resolve();
      return locked.promise;
    });
    const oldRun = h.run();
    await entered.promise;
    await h.service.cancelPublicAccountSnapshotImport();
    h.changeSource();
    jest.spyOn(h.service, 'getSyncCredentialSafe').mockResolvedValue({
      masterPasswordUUID: 'new-space',
      primeAccountSalt: 'new-fixture',
      securityPasswordR1: 'unused-test-only',
    });
    const complete = reply({ pwdHash: 'new-space' });
    if (complete.reconciliation) complete.reconciliation.hasMore = false;
    h.check.mockResolvedValue(complete);
    const mutation = h.service.startServerSyncFlowSilently({
      localMutation: true,
    });
    await Promise.resolve();
    locked.resolve(false);
    await Promise.all([oldRun, mutation]);
    expect(h.check).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000);
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(h.config().cloudSyncReconciliation?.spaceId).toBe('new-space');
  });

  test('no-progress cooldown survives manual/network triggers and later retries without a permanent gate', async () => {
    const h = harness();
    h.check.mockResolvedValueOnce(reply({ diff: [serverItem(0)] }));
    h.writePool.mockImplementationOnce(async ({ fn }) => {
      await fn?.();
    });
    await h.run();
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'blocked',
      reason: 'no-progress',
      unfinished: true,
      failures: 1,
      requests: 1,
    });
    const nextRetryAt = h.config().cloudSyncReconciliation?.nextRetryAt;
    expect(nextRetryAt).toBe(Date.now() + 30_000);
    await h.run();
    await h.service.resumeCloudSyncReconciliation({ reason: 'manual' });
    await h.service.resumeCloudSyncReconciliation({ reason: 'network' });
    expect(h.check).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(29_999);
    expect(h.check).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(h.check).toHaveBeenCalledTimes(2);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      unfinished: false,
      requests: 2,
    });
  });

  test('existing metadata deletion ACKs advance a delete-only multi-batch drain after pool cleanup', async () => {
    const records: IDBCloudSyncItem[] = [0, 1].map((index) => ({
      id: `wallet-delete-${index}`,
      dataType: EPrimeCloudSyncDataType.Wallet,
      data: 'public-encrypted-fixture',
      dataTime: 1_750_000_000_000,
      pwdHash: 'public-root-space',
      rawKey: '',
      rawData: '',
      isDeleted: false,
      localSceneUpdated: true,
      serverUploaded: true,
    }));
    const h = harness(0, {
      initialPool: new Map(records.map((row) => [row.id, row])),
    });
    h.service.syncManagers.wallet.removeSyncItemIfServerDeleted = true;
    jest
      .spyOn(localDb, 'removeCloudSyncPoolItems')
      .mockImplementation(async ({ keys }) => {
        for (const id of keys) h.pool.delete(id);
      });
    h.check.mockImplementation(async ({ localItems = [] }) =>
      reply({
        deleted: localItems.slice(0, 1).map((row) => row.id),
        reconciliation: {
          version: 1,
          maxItems: 500,
          maxBytes: 1024 * 1024,
          diffBeforeLimit: true,
          includesDeleted: true,
          hasMore: localItems.length > 1,
        },
      }),
    );
    await h.run();
    expect(h.pool.size).toBe(0);
    expect(h.check).toHaveBeenCalledTimes(2);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      applied: 2,
      requests: 2,
    });
  });

  test('equal-version ciphertext churn enters increasing cooldown instead of budget continuations', async () => {
    const remote = serverItem(0);
    const initial: IDBCloudSyncItem = {
      id: remote.key,
      data: remote.data,
      dataType: remote.dataType,
      dataTime: remote.dataTimestamp,
      pwdHash: remote.pwdHash,
      rawKey: '',
      rawData: '',
      isDeleted: false,
      localSceneUpdated: true,
      serverUploaded: true,
    };
    const h = harness(0, { initialPool: new Map([[initial.id, initial]]) });
    let sequence = 0;
    h.check.mockImplementation(async () => {
      sequence += 1;
      return reply({ diff: [{ ...remote, data: `new-cipher-${sequence}` }] });
    });
    await h.run();
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'blocked',
      reason: 'no-progress',
      failures: 1,
      applied: 0,
      requests: 1,
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(h.check).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(29_000);
    expect(h.check).toHaveBeenCalledTimes(2);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'blocked',
      reason: 'no-progress',
      failures: 2,
      applied: 0,
      requests: 2,
    });
    const nextRetryAt = h.config().cloudSyncReconciliation?.nextRetryAt ?? 0;
    expect(nextRetryAt - Date.now()).toBe(60_000);
  });

  test.each(['rejected', 'conflicts'] as const)(
    'a %s account version is saved but not reported as effective progress',
    async (issue) => {
      const h = harness(1);
      const remote = h.remote[0];
      jest
        .mocked(simpleDb.cloudSyncAccountIssues.getRawData)
        .mockResolvedValue({
          spaceId: 'public-root-space',
          issues: { [remote.key]: issue },
        });
      h.check.mockResolvedValue(reply({ diff: [remote] }));
      await h.run();
      expect(h.pool.has(remote.key)).toBe(true);
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'blocked',
        reason: 'no-progress',
        applied: 0,
        requests: 1,
      });
      expect(h.replay).not.toHaveBeenCalled();
    },
  );

  test('a downloaded future format remains local pending work without repeated network draining', async () => {
    const h = harness(1);
    const remote = h.remote[0];
    jest.mocked(simpleDb.cloudSyncAccountIssues.getRawData).mockResolvedValue({
      spaceId: 'public-root-space',
      issues: { [remote.key]: 'needsUpdate' },
    });
    h.scene.mockImplementation(async () => {
      h.patchConfig({
        publicAccountSnapshotStatus: {
          needsUpdate: 1,
          pending: 0,
          rejected: 0,
          conflicts: 0,
          added: 0,
          unchanged: 0,
        },
      });
    });
    await h.run();
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'partial',
      unfinished: false,
      applied: 1,
    });
    const requests = h.check.mock.calls.length;
    await h.service.resumeCloudSyncReconciliation({ reason: 'foreground' });
    expect(h.check).toHaveBeenCalledTimes(requests);
    expect(h.replay).toHaveBeenCalled();
  });

  test('duplicate server work stops after one applied batch and persists a recoverable block', async () => {
    const h = harness();
    h.check.mockResolvedValue(reply({ diff: [serverItem(0)] }));
    await h.run();
    expect(h.check).toHaveBeenCalledTimes(2);
    expect(h.writePool).toHaveBeenCalledTimes(1);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'blocked',
      reason: 'repeated-response',
      unfinished: true,
      requests: 2,
      rounds: 1,
      applied: 1,
    });
    expect(h.config().cloudSyncReconciliation?.nextRetryAt).toBe(
      Date.now() + 30_000,
    );
  });

  test('a completed Cloud drain with local pending issues replays locally without a new network check', async () => {
    const h = harness();
    h.patchConfig({
      cloudSyncReconciliation: {
        version: 1,
        spaceId: 'public-root-space',
        status: 'partial',
        unfinished: false,
        failures: 0,
        requests: 4,
        rounds: 4,
        received: 10,
        applied: 10,
        uploaded: 0,
        updatedAt: Date.now(),
      },
      publicAccountSnapshotStatus: {
        needsUpdate: 0,
        pending: 1,
        conflicts: 0,
        rejected: 0,
        added: 0,
        unchanged: 0,
      },
    });
    h.replay.mockImplementationOnce(async () => {
      expect(h.sourceMutex.isLocked()).toBe(true);
      h.patchConfig({
        publicAccountSnapshotStatus: {
          needsUpdate: 0,
          pending: 0,
          conflicts: 0,
          rejected: 0,
          added: 1,
          unchanged: 0,
        },
      });
    });
    await h.service.resumeCloudSyncReconciliation({ reason: 'foreground' });
    expect(h.replay).toHaveBeenCalledTimes(1);
    expect(h.check).not.toHaveBeenCalled();
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      unfinished: false,
      requests: 4,
    });
  });

  test.each(['complete', 'blocked'] as const)(
    'old-space %s state cannot suppress a fresh selected-space wake or leak its issue counts',
    async (status) => {
      const h = harness();
      h.patchConfig({
        cloudSyncAccountApplyVersion: 2,
        cloudSyncReconciliation: {
          version: 1,
          spaceId: 'old-public-space',
          status,
          unfinished: status === 'blocked',
          failures: 6,
          requests: 99,
          rounds: 20,
          received: 100,
          applied: 80,
          uploaded: 20,
          updatedAt: Date.now(),
          reason: status === 'blocked' ? 'retry-exhausted' : 'finished',
          nextRetryAt:
            status === 'blocked' ? Date.now() + 24 * 60 * 60_000 : undefined,
        },
        publicAccountSnapshotStatus: {
          needsUpdate: 4,
          pending: 5,
          conflicts: 6,
          rejected: 7,
          added: 8,
          unchanged: 9,
        },
      });
      await h.service.resumeCloudSyncReconciliation({ reason: 'foreground' });
      expect(h.check).toHaveBeenCalledTimes(1);
      expect(h.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          updates: [],
          syncCredential: expect.objectContaining({
            masterPasswordUUID: 'public-root-space',
          }),
          counts: expect.objectContaining({
            needsUpdate: 0,
            pending: 0,
            conflicts: 0,
            rejected: 0,
            added: 0,
            unchanged: 0,
          }),
        }),
      );
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        spaceId: 'public-root-space',
        status: 'complete',
        unfinished: false,
        failures: 0,
        requests: 1,
        rounds: 1,
        applied: 0,
        uploaded: 0,
      });
      expect(h.config().publicAccountSnapshotStatus).toMatchObject({
        needsUpdate: 0,
        pending: 0,
        conflicts: 0,
        rejected: 0,
        added: 0,
        unchanged: 0,
      });
      expect(h.replay).toHaveBeenCalledWith(
        expect.objectContaining({ forceSync: true }),
      );
    },
  );
});
