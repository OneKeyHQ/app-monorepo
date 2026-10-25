import { Semaphore } from 'async-mutex';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCheckServerStatusResult,
  ICloudSyncCredential,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { rejectPublicAccountSnapshotWrite } from './publicAccountSnapshotWriteGuard';
import ServicePrimeCloudSync from './ServicePrimeCloudSync';

import type { IDBCloudSyncItem } from '../../dbs/local/types';

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
    get: jest.fn(async () => ({})),
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
  default: {},
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('./botWalletCloudSyncUtils', () => ({
  filterBotWalletRecordsByCurrentKeylessSyncScope: jest.fn(),
}));

jest.mock('./cloudSyncCheckUtils', () => ({
  buildOnlyCheckLocalDataTypes: jest.fn(),
}));

jest.mock('./cloudSyncItemBuilder', () => ({
  __esModule: true,
  default: {
    normalizeDataTime: (time: number | undefined) => time,
    getPwdHash: (credential?: { masterPasswordUUID: string }) =>
      credential?.masterPasswordUUID ?? '',
  },
}));

jest.mock('./keylessCloudSyncUtils', () => ({
  __esModule: true,
  default: { isKeylessPwdHash: () => false },
}));

function item(
  id: string,
  data = 'encrypted-public-data',
  pwdHash = 'owner-A',
): IDBCloudSyncItem {
  return {
    id,
    data,
    rawKey: '',
    rawData: '',
    dataType: EPrimeCloudSyncDataType.Account,
    dataTime: 1,
    pwdHash,
    isDeleted: false,
    localSceneUpdated: true,
    serverUploaded: false,
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function harness() {
  const sourceMutex = new Semaphore(1);
  const runWithCloudSyncKeyLock = jest.fn((operation: () => Promise<unknown>) =>
    sourceMutex.runExclusive(operation),
  );
  let credential: ICloudSyncCredential = {
    primeAccountSalt: 'public-test-salt',
    securityPasswordR1: 'test-only-unused',
    masterPasswordUUID: 'owner-A',
  };
  const service = new ServicePrimeCloudSync({
    backgroundApi: {
      serviceKeylessCloudSync: {
        runWithCloudSyncKeyLock,
        getCloudAccountImportGeneration: () => 0,
      },
    },
  });
  const available = jest
    .spyOn(service, 'isCloudSyncIsAvailable')
    .mockResolvedValue(true);
  jest
    .spyOn(service, 'ensureCloudSyncIsAvailable')
    .mockResolvedValue(undefined);
  const getCredential = jest
    .spyOn(service, 'getSyncCredentialSafe')
    .mockImplementation(async () => credential);
  jest
    .spyOn(service, 'getActiveSyncMode')
    .mockResolvedValue(ECloudSyncMode.Keyless);
  jest.spyOn(service, 'getCloudSyncDataTime').mockResolvedValue(10);
  jest.spyOn(service, 'updateLastSyncTime').mockResolvedValue(undefined);
  const status = jest
    .spyOn(service, 'checkServerStatusWithRequestOptions')
    .mockImplementation(async ({ localItems = [] } = {}) => ({
      obsoleted: localItems.map((record) => record.id),
      diff: [],
      updated: [],
      deleted: [],
      pwdHash: credential.masterPasswordUUID,
      serverTime: 10,
    }));
  const upload = jest
    .spyOn(service, 'apiUploadItemsKeyless')
    .mockImplementation(async ({ postData }) => ({
      nonce: 1,
      created: postData.localData.length,
      updated: 0,
    }));
  const select = (owner: string) => {
    credential = { ...credential, masterPasswordUUID: owner };
  };
  return {
    service,
    sourceMutex,
    runWithCloudSyncKeyLock,
    status,
    upload,
    available,
    getCredential,
    select,
  };
}

describe('ServicePrimeCloudSync per-record status coalescing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('rejects marked source objects before a queue clone could lose the write guard', async () => {
    const { service, status, upload } = harness();
    const rejected = item('rejected-snapshot');
    rejectPublicAccountSnapshotWrite(rejected);
    await service.startServerSyncFlowForItems({ localItems: [rejected] });
    await jest.advanceTimersByTimeAsync(1000);
    expect(status).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    await service.startServerSyncFlowForItems({
      localItems: [rejected, item('allowed')],
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(
      status.mock.calls[0][0]?.localItems?.map((record) => record.id),
    ).toEqual(['allowed']);
    expect(
      upload.mock.calls[0][0].postData.localData.map((record) => record.key),
    ).toEqual(['allowed']);
  });

  test('1000 concurrent hooks hit the threshold with one drain and twenty bounded uploads', async () => {
    const { service, status, upload, sourceMutex, runWithCloudSyncKeyLock } =
      harness();
    const entry = jest.spyOn(service, 'startServerSyncFlowForItems');
    upload.mockImplementation(async ({ postData }) => {
      expect(sourceMutex.isLocked()).toBe(true);
      expect(postData.localData).toHaveLength(50);
      return { nonce: 1, created: postData.localData.length, updated: 0 };
    });
    await Promise.all(
      Array.from({ length: 1000 }, (_, index) =>
        service.startServerSyncFlowForItems({
          localItems: [item(String(index))],
        }),
      ),
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(status).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status.mock.calls[0][0]?.localItems).toHaveLength(1000);
    expect(upload).toHaveBeenCalledTimes(20);
    expect(
      upload.mock.calls.flatMap(([request]) => request.postData.localData),
    ).toHaveLength(1000);
    expect(runWithCloudSyncKeyLock).toHaveBeenCalledTimes(1);
    expect(entry).toHaveBeenCalledTimes(1000);
    expect(sourceMutex.isLocked()).toBe(false);
  });

  test('continuous writes cannot starve the five-second max wait', async () => {
    const { service, status } = harness();
    for (let index = 0; index < 6; index += 1) {
      await service.startServerSyncFlowForItems({
        localItems: [item(`continuous-${index}`)],
      });
      await jest.advanceTimersByTimeAsync(900);
    }
    expect(status).toHaveBeenCalledTimes(1);
    expect(status.mock.calls[0][0]?.localItems).toHaveLength(6);
    await service.startServerSyncFlowForItems({ localItems: [item('after')] });
    await jest.advanceTimersByTimeAsync(1000);
    expect(status).toHaveBeenCalledTimes(2);
  });

  test('threshold triggers share one queued source lock while another task holds it', async () => {
    const { service, sourceMutex, status, runWithCloudSyncKeyLock } = harness();
    const [, release] = await sourceMutex.acquire();
    await Promise.all(
      Array.from({ length: 1000 }, (_, index) =>
        service.startServerSyncFlowForItems({
          localItems: [item(`held-${index}`)],
        }),
      ),
    );
    expect(runWithCloudSyncKeyLock).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    release();
    await jest.advanceTimersByTimeAsync(0);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status.mock.calls[0][0]?.localItems).toHaveLength(1000);
  });

  test('latest same-ID write wins before status and upload', async () => {
    const { service, status, upload } = harness();
    await service.startServerSyncFlowForItems({
      localItems: [item('same', 'old')],
    });
    await service.startServerSyncFlowForItems({
      localItems: [item('same', 'new')],
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(status.mock.calls[0][0]?.localItems).toEqual([item('same', 'new')]);
    expect(upload.mock.calls[0][0].postData.localData).toHaveLength(1);
    expect(upload.mock.calls[0][0].postData.localData[0].data).toBe('new');
  });

  test('rechecks source after acquiring the mutex and discards old-owner requests only from memory', async () => {
    const { service, status, upload, select, sourceMutex, getCredential } =
      harness();
    const oldRecord = item('old');
    const [, release] = await sourceMutex.acquire();
    await service.startServerSyncFlowForItems({ localItems: [oldRecord] });
    await jest.advanceTimersByTimeAsync(1000);
    expect(getCredential).not.toHaveBeenCalled();
    select('owner-B');
    release();
    await jest.advanceTimersByTimeAsync(0);
    expect(status).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(oldRecord.serverUploaded).toBe(false);
    await service.startServerSyncFlowForItems({
      localItems: [item('new', 'new-data', 'owner-B')],
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(status).toHaveBeenCalledTimes(1);
    expect(
      status.mock.calls[0][0]?.localItems?.map((record) => record.id),
    ).toEqual(['new']);
    expect(upload.mock.calls[0][0].postData.pwdHash).toBe('owner-B');
  });

  test('unavailable Cloud skips network and keeps pending records recoverable', async () => {
    const { service, status, upload, available } = harness();
    available.mockResolvedValue(false);
    const record = item('offline');
    await service.startServerSyncFlowForItems({ localItems: [record] });
    await jest.advanceTimersByTimeAsync(1000);
    expect(status).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    available.mockResolvedValue(true);
    await service._drainServerSyncFlowForItems();
    expect(status.mock.calls[0][0]?.localItems).toEqual([record]);
    expect(record.serverUploaded).toBe(false);
  });

  test('timer cancellation preserves dirty records for the next drain', async () => {
    const { service, status } = harness();
    const record = item('cancelled');
    await service.startServerSyncFlowForItems({ localItems: [record] });
    service._startServerSyncFlowForItemsDebounced.cancel();
    await jest.advanceTimersByTimeAsync(1000);
    expect(status).not.toHaveBeenCalled();
    expect(record.serverUploaded).toBe(false);
    await service._drainServerSyncFlowForItems();
    expect(status).toHaveBeenCalledTimes(1);
    expect(status.mock.calls[0][0]?.localItems).toEqual([record]);
  });

  test('cancels an in-flight status request and rejects a transport that returns late', async () => {
    const { service, status, upload } = harness();
    const network = deferred<ICloudSyncCheckServerStatusResult>();
    const started = deferred<void>();
    status.mockImplementationOnce(async () => {
      started.resolve();
      return network.promise;
    });
    const save = jest.spyOn(service, 'saveServerSyncItemsToLocal');
    const remove = jest.spyOn(service, 'saveServerDeletedItemsToLocal');
    const record = item('late-status');
    await service.startServerSyncFlowForItems({ localItems: [record] });
    service._startServerSyncFlowForItemsDebounced.cancel();
    const drain = service._drainServerSyncFlowForItems();
    await started.promise;
    const signal = status.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    await service.cancelPublicAccountSnapshotImport();
    expect(signal?.aborted).toBe(true);
    network.resolve({
      obsoleted: [record.id],
      diff: [],
      updated: [],
      deleted: [record.id],
      pwdHash: 'owner-A',
      serverTime: 10,
    });
    await expect(drain).rejects.toThrow('cancelled');
    expect(upload).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(5000);
    expect(status).toHaveBeenCalledTimes(1);
    await service._drainServerSyncFlowForItems();
    expect(status).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(record.serverUploaded).toBe(false);
  });

  test('cancels an in-flight upload before any late server updates are applied', async () => {
    const { service, status, upload } = harness();
    const network = deferred<{
      nonce: number;
      created: number;
      updated: number;
    }>();
    const started = deferred<void>();
    upload.mockImplementationOnce(async () => {
      started.resolve();
      return network.promise;
    });
    const remove = jest.spyOn(service, 'saveServerDeletedItemsToLocal');
    status.mockResolvedValueOnce({
      obsoleted: ['late-upload'],
      diff: [],
      updated: [],
      deleted: ['late-upload'],
      pwdHash: 'owner-A',
      serverTime: 10,
    });
    await service.startServerSyncFlowForItems({
      localItems: [item('late-upload')],
    });
    service._startServerSyncFlowForItemsDebounced.cancel();
    const drain = service._drainServerSyncFlowForItems();
    await started.promise;
    const signal = upload.mock.calls[0][0].requestOptions?.signal;
    expect(signal?.aborted).toBe(false);
    await service.cancelPublicAccountSnapshotImport();
    expect(signal?.aborted).toBe(true);
    network.resolve({ nonce: 1, created: 1, updated: 0 });
    await expect(drain).rejects.toThrow('cancelled');
    expect(remove).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(5000);
    expect(status).toHaveBeenCalledTimes(1);
  });

  test('a cancelled queued drain cannot start later under a new generation', async () => {
    const { service, status, upload, sourceMutex } = harness();
    const [, release] = await sourceMutex.acquire();
    await service.startServerSyncFlowForItems({
      localItems: [item('queued-cancel')],
    });
    service._startServerSyncFlowForItemsDebounced.cancel();
    const drain = service._drainServerSyncFlowForItems();
    await service.cancelPublicAccountSnapshotImport();
    release();
    await drain;
    expect(status).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    await service._drainServerSyncFlowForItems();
    expect(status).toHaveBeenCalledTimes(1);
  });

  test('failed status restores its records for retry without repeating the public enqueue path', async () => {
    const { service, status, upload } = harness();
    status.mockRejectedValueOnce(new OneKeyLocalError('offline'));
    const entry = jest.spyOn(service, 'startServerSyncFlowForItems');
    await service.startServerSyncFlowForItems({ localItems: [item('retry')] });
    service._startServerSyncFlowForItemsDebounced.cancel();
    await expect(service._drainServerSyncFlowForItems()).rejects.toThrow(
      'offline',
    );
    expect(upload).not.toHaveBeenCalled();
    await service._drainServerSyncFlowForItems();
    expect(status).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(entry).toHaveBeenCalledTimes(1);
  });

  test('an upload failure also leaves the merged status records retryable', async () => {
    const { service, status, upload } = harness();
    upload.mockRejectedValueOnce(new OneKeyLocalError('upload offline'));
    const record = item('upload-retry');
    await service.startServerSyncFlowForItems({ localItems: [record] });
    service._startServerSyncFlowForItemsDebounced.cancel();
    await expect(service._drainServerSyncFlowForItems()).rejects.toThrow(
      'upload offline',
    );
    expect(record.serverUploaded).toBe(false);
    await service._drainServerSyncFlowForItems();
    expect(status).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[1][0].postData.localData).toHaveLength(1);
  });

  test('failure recovery keeps a newer concurrent same-ID write', async () => {
    const { service, status } = harness();
    const network = deferred<ICloudSyncCheckServerStatusResult>();
    const started = deferred<void>();
    status.mockImplementationOnce(async () => {
      started.resolve();
      return network.promise;
    });
    await service.startServerSyncFlowForItems({
      localItems: [item('same', 'old'), item('other')],
    });
    service._startServerSyncFlowForItemsDebounced.cancel();
    const first = service._drainServerSyncFlowForItems();
    await started.promise;
    await service.startServerSyncFlowForItems({
      localItems: [item('same', 'new')],
    });
    service._startServerSyncFlowForItemsDebounced.cancel();
    network.reject(new OneKeyLocalError('offline'));
    await expect(first).rejects.toThrow('offline');
    await service._drainServerSyncFlowForItems();
    expect(status.mock.calls[1][0]?.localItems).toEqual([
      item('same', 'new'),
      item('other'),
    ]);
  });

  test.each([
    { isFullDBChecking: true },
    { isFlush: true },
    { noDebounceUpload: true },
  ])(
    'explicit flow %j runs immediately without reacquiring its caller source lock',
    async (options) => {
      const { service, sourceMutex, status, runWithCloudSyncKeyLock } =
        harness();
      jest.spyOn(service, 'apiUploadItems').mockResolvedValue(undefined);
      const [, release] = await sourceMutex.acquire();
      try {
        await service.startServerSyncFlowForItems({
          localItems: [item('explicit')],
          ...options,
        });
        expect(status).toHaveBeenCalledTimes(1);
        expect(runWithCloudSyncKeyLock).not.toHaveBeenCalled();
        expect(sourceMutex.isLocked()).toBe(true);
      } finally {
        release();
      }
      await jest.advanceTimersByTimeAsync(1000);
      expect(status).toHaveBeenCalledTimes(1);
    },
  );
});
