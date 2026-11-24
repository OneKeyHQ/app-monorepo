import { EDeviceType } from '@onekeyfe/hd-shared';
import { cloneDeep } from 'lodash';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { RuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode/runtimeProfile';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type {
  IDBDevice,
  ILocalDBAgent,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
  ILocalDBWithTransactionTask,
} from './types';

const DEVICE: IDBDevice = {
  id: 'device-cache-test',
  name: 'Test device',
  features: '{}',
  connectId: 'test-connection',
  uuid: 'test-uuid',
  deviceId: 'test-device-id',
  deviceType: EDeviceType.Unknown,
  settingsRaw: '{}',
  createdAt: 1,
  updatedAt: 1,
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class DeviceCacheTestDb extends LocalDbBase {
  constructor(agent: ILocalDBAgent) {
    super();
    this.readyDb = Promise.resolve(agent);
  }

  override readyDb: Promise<ILocalDBAgent>;

  override async reset() {
    this.clearStoreCachedData();
  }
}

function harness(initialDevices: IDBDevice[] = []) {
  const state = {
    devices: cloneDeep(initialDevices),
    pendingDevices: cloneDeep(initialDevices),
    exposePending: false,
    commitGate: undefined as Promise<void> | undefined,
  };
  const committing = deferred<void>();
  const getAllRecords = jest.fn(async () => ({
    records: cloneDeep(
      state.exposePending ? state.pendingDevices : state.devices,
    ),
  }));
  const agent = {
    getAllRecords,
    withTransaction: async <T>(
      bucketName: EIndexedDBBucketNames,
      task: ILocalDBWithTransactionTask<T>,
    ) => {
      state.pendingDevices = cloneDeep(state.devices);
      const result = await task({ bucketName });
      committing.resolve();
      await state.commitGate;
      state.devices = cloneDeep(state.pendingDevices);
      return result;
    },
    txAddRecords: async ({
      records,
    }: ILocalDBTxAddRecordsParams<ELocalDBStoreNames.Device>) => {
      state.pendingDevices.push(...cloneDeep(records));
      return {
        added: records.length,
        addedIds: records.map((r) => r.id),
        skipped: 0,
      };
    },
    txUpdateRecords: async ({
      ids,
      updater,
    }: ILocalDBTxUpdateRecordsParams<ELocalDBStoreNames.Device>) => {
      for (const record of state.pendingDevices) {
        if (ids?.includes(record.id)) await updater(record);
      }
    },
    txRemoveRecords: async ({
      ids,
    }: ILocalDBTxRemoveRecordsParams<ELocalDBStoreNames.Device>) => {
      state.pendingDevices = state.pendingDevices.filter(
        (record) => !ids?.includes(record.id),
      );
    },
    clearRecords: async () => {
      committing.resolve();
      await state.commitGate;
      state.devices = [];
    },
  };
  const db = new DeviceCacheTestDb(agent as unknown as ILocalDBAgent);
  const addDevice = () =>
    db.withTransaction(EIndexedDBBucketNames.account, async (tx) =>
      db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        records: [{ ...DEVICE }],
      }),
    );
  return { db, state, getAllRecords, committing, addDevice };
}

describe('LocalDbBase device cache', () => {
  beforeEach(() => {
    const realEnvironment = RuntimeEnvironment.create(
      getTravelModeRuntimeProfile(false),
    );
    jest
      .spyOn(travelModeManager, 'getRuntimeEnvironment')
      .mockResolvedValue(realEnvironment);
    jest
      .spyOn(travelModeManager, 'getRuntimeEnvironmentSync')
      .mockReturnValue(realEnvironment);
    jest.replaceProperty(appGlobals, '$backgroundApiProxy', {
      serviceKeylessCloudSync: {
        hydrateKeylessSyncCredentialFromStorageIfNeeded: async () => undefined,
      },
    } as unknown as typeof appGlobals.$backgroundApiProxy);
  });

  afterEach(() => jest.restoreAllMocks());

  test('caches an empty Device store without changing other empty-cache defaults', async () => {
    const h = harness();
    for (let i = 0; i < 20; i += 1) {
      expect((await h.db.getAllDevices()).devices).toEqual([]);
    }
    expect(h.getAllRecords).toHaveBeenCalledTimes(1);
    h.db.dbAllRecordsCache.set('allDbWallets', []);
    expect(h.db.getAllRecordsByCache('allDbWallets')).toBeUndefined();
  });

  test('shares a cold read and gives all callers separate refilled device copies', async () => {
    const h = harness([DEVICE]);
    const [first, second] = await Promise.all([
      h.db.getAllDevices(),
      h.db.getAllDevices(),
    ]);
    first.devices[0].name = 'caller mutation';
    const warm = await h.db.getAllDevices();

    expect(h.getAllRecords).toHaveBeenCalledTimes(1);
    expect(second.devices[0].name).toBe(DEVICE.name);
    expect(warm.devices[0].name).toBe(DEVICE.name);
    expect(warm.devices[0].vendor).toBe(EHardwareVendor.onekey);
  });

  test('invalidates an empty cache when a Device is added', async () => {
    const h = harness();
    await h.db.getAllDevices();
    await h.addDevice();
    const result = await h.db.getAllDevices();

    expect(result.devices.map((device) => device.id)).toEqual([DEVICE.id]);
    expect(h.getAllRecords).toHaveBeenCalledTimes(2);
  });

  test('does not publish or clean up a newer read when an invalidated older read completes', async () => {
    const h = harness();
    const oldRead = deferred<{ records: IDBDevice[] }>();
    const newRead = deferred<{ records: IDBDevice[] }>();
    const oldStarted = deferred<void>();
    const newStarted = deferred<void>();
    h.getAllRecords
      .mockImplementationOnce(async () => {
        oldStarted.resolve();
        return oldRead.promise;
      })
      .mockImplementationOnce(async () => {
        newStarted.resolve();
        return newRead.promise;
      });
    const oldResult = h.db.getAllDevices();
    await oldStarted.promise;
    await h.addDevice();
    const newResult = h.db.getAllDevices();
    await newStarted.promise;
    oldRead.resolve({ records: [] });
    await oldResult;
    const joiningResult = h.db.getAllDevices();
    newRead.resolve({ records: [{ ...DEVICE }] });
    await Promise.all([newResult, joiningResult]);

    expect((await h.db.getAllDevices()).devices[0].id).toBe(DEVICE.id);
    expect(h.getAllRecords).toHaveBeenCalledTimes(2);
  });

  test('does not cache reads while a Device write is awaiting its outer commit', async () => {
    const h = harness();
    const commit = deferred<void>();
    h.state.commitGate = commit.promise;
    await h.db.getAllDevices();
    const write = h.addDevice();
    await h.committing.promise;
    expect((await h.db.getAllDevices()).devices).toEqual([]);
    expect((await h.db.getAllDevices()).devices).toEqual([]);
    expect(h.db.dbAllRecordsCache.has('allDbDevices')).toBe(false);
    expect(h.getAllRecords).toHaveBeenCalledTimes(3);
    commit.resolve();
    await write;

    expect((await h.db.getAllDevices()).devices[0].id).toBe(DEVICE.id);
    expect(h.getAllRecords).toHaveBeenCalledTimes(4);
  });

  test('drops an uncommitted Realm-style read after rollback', async () => {
    const h = harness();
    const commit = deferred<void>();
    h.state.commitGate = commit.promise;
    const write = h.addDevice();
    const rejected = write.catch((error: unknown) => error);
    await h.committing.promise;
    h.state.exposePending = true;
    expect((await h.db.getAllDevices()).devices[0].id).toBe(DEVICE.id);
    expect(h.db.dbAllRecordsCache.has('allDbDevices')).toBe(false);
    commit.reject(new Error('rolled back'));
    expect(await rejected).toEqual(new Error('rolled back'));
    h.state.exposePending = false;

    expect((await h.db.getAllDevices()).devices).toEqual([]);
    expect((await h.db.getAllDevices()).devices).toEqual([]);
    expect(h.getAllRecords).toHaveBeenCalledTimes(2);
  });

  test('invalidates changed vendor data and removed Devices', async () => {
    const h = harness([DEVICE]);
    await h.db.getAllDevices();
    await h.db.withTransaction(EIndexedDBBucketNames.account, async (tx) =>
      h.db.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [DEVICE.id],
        updater: (device) => {
          device.settingsRaw = '{"vendor":"trezor"}';
          return device;
        },
      }),
    );
    expect((await h.db.getAllDevices()).devices[0].vendor).toBe(
      EHardwareVendor.trezor,
    );
    await h.db.withTransaction(EIndexedDBBucketNames.account, async (tx) =>
      h.db.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [DEVICE.id],
      }),
    );
    expect((await h.db.getAllDevices()).devices).toEqual([]);
    expect(h.getAllRecords).toHaveBeenCalledTimes(3);
  });

  test('invalidates after clearRecords completes, including intervening reads', async () => {
    const h = harness([DEVICE]);
    const commit = deferred<void>();
    h.state.commitGate = commit.promise;
    await h.db.getAllDevices();
    const clear = h.db.clearRecords({ name: ELocalDBStoreNames.Device });
    await h.committing.promise;
    expect((await h.db.getAllDevices()).devices[0].id).toBe(DEVICE.id);
    expect(h.db.dbAllRecordsCache.has('allDbDevices')).toBe(false);
    commit.resolve();
    await clear;

    expect((await h.db.getAllDevices()).devices).toEqual([]);
    expect(h.getAllRecords).toHaveBeenCalledTimes(3);
  });

  test('does not cache a failed read and permits a later retry', async () => {
    const h = harness();
    h.getAllRecords.mockRejectedValueOnce(new Error('Device read failed'));
    await expect(h.db.getAllDevices()).rejects.toThrow('Device read failed');
    expect(h.db.dbAllRecordsCache.has('allDbDevices')).toBe(false);
    expect(h.db.dbAllRecordsInflight.has('allDbDevices')).toBe(false);
    expect((await h.db.getAllDevices()).devices).toEqual([]);
    expect(h.getAllRecords).toHaveBeenCalledTimes(2);
  });

  test.each([false, true])(
    'masked persistence cannot use a real cache or inflight read: %s',
    async (inflight) => {
      const h = harness([DEVICE]);
      const pendingRead = deferred<{ records: IDBDevice[] }>();
      const readStarted = deferred<void>();
      let realRead: ReturnType<typeof h.db.getAllDevices> | undefined;
      if (inflight) {
        h.getAllRecords.mockImplementationOnce(async () => {
          readStarted.resolve();
          return pendingRead.promise;
        });
        realRead = h.db.getAllDevices();
        await readStarted.promise;
      } else {
        await h.db.getAllDevices();
      }
      const masked = RuntimeEnvironment.create(
        getTravelModeRuntimeProfile(true),
      );
      jest
        .spyOn(travelModeManager, 'getRuntimeEnvironment')
        .mockResolvedValue(masked);
      jest
        .spyOn(travelModeManager, 'getRuntimeEnvironmentSync')
        .mockReturnValue(masked);
      const first = await h.db.getAllDevices();
      first.devices.push({ ...DEVICE });
      expect((await h.db.getAllDevices()).devices).toEqual([]);
      expect(h.getAllRecords).toHaveBeenCalledTimes(1);
      if (inflight) {
        pendingRead.resolve({ records: [{ ...DEVICE }] });
        await realRead;
      }
    },
  );
});
