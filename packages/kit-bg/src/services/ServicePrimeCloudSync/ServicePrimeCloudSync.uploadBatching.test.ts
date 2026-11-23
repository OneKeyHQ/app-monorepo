import { AxiosHeaders } from 'axios';

import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncUploadPostData,
  ICloudSyncUploadResult,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CLOUD_SYNC_UPLOAD_MAX_BYTES } from './cloudSyncUploadBatching';
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
    get: jest.fn(),
    set: jest.fn(),
  },
  addressBookPersistAtom: {},
  devSettingsPersistAtom: {},
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
  ...jest.requireActual<typeof import('./cloudSyncCheckUtils')>(
    './cloudSyncCheckUtils',
  ),
  buildOnlyCheckLocalDataTypes: jest.fn(),
}));

jest.mock('./cloudSyncItemBuilder', () => ({
  __esModule: true,
  default: { normalizeDataTime: (time: number | undefined) => time },
}));

jest.mock('./keylessCloudSyncUtils', () => ({
  __esModule: true,
  default: { isKeylessPwdHash: () => false },
}));

function item(id: string, data = 'encrypted-public-data'): IDBCloudSyncItem {
  return {
    id,
    data,
    rawKey: '',
    rawData: '',
    dataType: EPrimeCloudSyncDataType.Account,
    dataTime: 1,
    pwdHash: 'keyless-pwd-hash',
    isDeleted: false,
    localSceneUpdated: true,
    serverUploaded: false,
  };
}

function buildService(mode = ECloudSyncMode.Keyless) {
  const post = jest.fn(
    async (_path: string, request: ICloudSyncUploadPostData) => ({
      data: {
        data: { nonce: 2, created: request.localData.length, updated: 0 },
      },
    }),
  );
  const getHardwareUploadGeneration = jest.fn<undefined | number, []>(() => 0);
  const service = new ServicePrimeCloudSync({
    backgroundApi: {
      servicePrime: { getPrimeClient: async () => ({ post }) },
      serviceKeylessCloudSync: { getHardwareUploadGeneration },
    },
  });
  jest.spyOn(service, 'getCloudSyncDataTime').mockResolvedValue(10);
  jest.spyOn(service, 'getActiveSyncMode').mockResolvedValue(mode);
  const updateLastSyncTime = jest
    .spyOn(service, 'updateLastSyncTime')
    .mockResolvedValue(undefined);
  const upload = jest
    .spyOn(service, 'apiUploadItemsKeyless')
    .mockImplementation(async ({ postData }) => ({
      nonce: 1,
      created: postData.localData.length,
      updated: 0,
    }));
  return {
    service,
    upload,
    post,
    updateLastSyncTime,
    getHardwareUploadGeneration,
  };
}

function uploadParams(localItems: IDBCloudSyncItem[]) {
  return {
    localItems,
    isFlush: false,
    lockItem: undefined,
    pwdHash: 'keyless-pwd-hash',
    setUndefinedTimeToNow: false,
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

describe('ServicePrimeCloudSync bounded uploads', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('rejected snapshot source objects never reach upload, including queued mixed writes', async () => {
    const { service, upload } = buildService();
    const rejected = item('rejected-snapshot');
    rejectPublicAccountSnapshotWrite(rejected);
    await expect(
      service._callApiUploadItems(uploadParams([rejected])),
    ).resolves.toBeUndefined();
    expect(upload).not.toHaveBeenCalled();
    service.uploadItemsToMerge = [rejected, item('allowed')];
    await service._callApiUploadItemsInstantly({ pwdHash: 'keyless-pwd-hash' });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(
      upload.mock.calls[0][0].postData.localData.map((record) => record.key),
    ).toEqual(['allowed']);
  });

  test('uses the existing Keyless auth endpoint sequentially and totals results', async () => {
    const { service, upload } = buildService();
    const localItems = Array.from({ length: 101 }, (_, index) =>
      item(String(index)),
    );
    let active = 0;
    let maxActive = 0;
    upload.mockImplementation(async ({ postData, urlPath }) => {
      active += 1;
      maxActive = Math.max(active, maxActive);
      expect(urlPath).toBe('/prime/v1/sync/upload');
      expect(
        Buffer.byteLength(stringUtils.stableStringify(postData), 'utf8'),
      ).toBeLessThanOrEqual(CLOUD_SYNC_UPLOAD_MAX_BYTES);
      await Promise.resolve();
      active -= 1;
      return { nonce: 1, created: postData.localData.length, updated: 0 };
    });
    await expect(
      service._callApiUploadItems(uploadParams(localItems)),
    ).resolves.toEqual({ nonce: 1, created: 101, updated: 0 });
    expect(
      upload.mock.calls.map(([request]) => request.postData.localData.length),
    ).toEqual([50, 50, 1]);
    expect(maxActive).toBe(1);
    expect(
      upload.mock.calls.flatMap(([request]) =>
        request.postData.localData.map((record) => record.key),
      ),
    ).toEqual(localItems.map((record) => record.id));
    expect(
      upload.mock.calls.every(
        ([request]) =>
          request.postData.pwdHash === 'keyless-pwd-hash' &&
          request.postData.nonce === 0,
      ),
    ).toBe(true);
  });

  test('paces consecutive chunks but not the first request', async () => {
    jest.useFakeTimers();
    const { service, upload } = buildService();
    const startedAt: number[] = [];
    upload.mockImplementation(async ({ postData }) => {
      startedAt.push(Date.now());
      return { nonce: 1, created: postData.localData.length, updated: 0 };
    });
    const start = Date.now();
    const work = service._callApiUploadItems(
      uploadParams(
        Array.from({ length: 101 }, (_, index) => item(String(index))),
      ),
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(startedAt).toEqual([start]);
    await jest.advanceTimersByTimeAsync(199);
    expect(upload).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(201);
    await work;
    expect(startedAt).toEqual([start, start + 200, start + 400]);
    jest.useRealTimers();
  });

  test('generation changes during pacing stop subsequent chunks without a signal', async () => {
    jest.useFakeTimers();
    const { service, upload } = buildService();
    const work = service._callApiUploadItems(
      uploadParams(
        Array.from({ length: 51 }, (_, index) => item(String(index))),
      ),
    );
    const rejection = work.catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(0);
    expect(upload).toHaveBeenCalledTimes(1);
    // Simulate the existing key/space invalidation generation bump.
    Reflect.set(service, 'publicAccountSnapshotImportGeneration', 1);
    await jest.advanceTimersByTimeAsync(200);
    await expect(rejection).resolves.toMatchObject({
      message: expect.stringContaining('cancelled'),
    });
    expect(upload).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('batches legacy uploads through the unchanged endpoint', async () => {
    const { service, upload, post } = buildService(ECloudSyncMode.OnekeyId);
    await service._callApiUploadItems(
      uploadParams(
        Array.from({ length: 51 }, (_, index) => item(String(index))),
      ),
    );
    expect(upload).not.toHaveBeenCalled();
    expect(
      post.mock.calls.map(([path, request]) => [
        path,
        request.localData.length,
      ]),
    ).toEqual([
      ['/prime/v1/sync/upload', 50],
      ['/prime/v1/sync/upload', 1],
    ]);
  });

  test('leaves flush/reset payloads intact, including oversized records', async () => {
    const { service, upload } = buildService();
    const localItems = [
      item('large', 'x'.repeat(CLOUD_SYNC_UPLOAD_MAX_BYTES)),
      ...Array.from({ length: 50 }, (_, index) => item(String(index))),
    ];
    await service._callApiUploadItems({
      ...uploadParams(localItems),
      isFlush: true,
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0].urlPath).toBe('/prime/v1/sync/flush');
    expect(upload.mock.calls[0][0].postData.localData).toHaveLength(51);
    await service._callApiUploadItems({
      ...uploadParams([]),
      isFlush: true,
      pwdHash: '',
    });
    expect(upload.mock.calls[1][0].postData.localData).toEqual([]);
  });

  test('preflights oversized later records before sending and retains the queue', async () => {
    const { service, upload } = buildService();
    const localItems = [
      item('small'),
      item('large', 'x'.repeat(CLOUD_SYNC_UPLOAD_MAX_BYTES)),
    ];
    service.uploadItemsToMerge = localItems;
    await expect(
      service._callApiUploadItemsInstantly({ pwdHash: 'keyless-pwd-hash' }),
    ).rejects.toThrow('Cloud upload item exceeds client budget');
    expect(upload).not.toHaveBeenCalled();
    expect(service.uploadItemsToMerge).toEqual(localItems);
  });

  test('one debounce merges writes by ID before splitting', async () => {
    jest.useFakeTimers();
    const { service, upload } = buildService();
    await service._callApiUploadItemsDebounceMerge({
      localItems: [item('same', 'old')],
      pwdHash: 'keyless-pwd-hash',
    });
    await service._callApiUploadItemsDebounceMerge({
      localItems: [
        item('same', 'new'),
        ...Array.from({ length: 50 }, (_, index) => item(String(index))),
      ],
      pwdHash: 'keyless-pwd-hash',
    });
    await jest.advanceTimersByTimeAsync(999);
    expect(upload).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(upload).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(200);
    expect(
      upload.mock.calls.map(([request]) => request.postData.localData.length),
    ).toEqual([50, 1]);
    expect(upload.mock.calls[0][0].postData.localData[0]).toMatchObject({
      key: 'same',
      data: 'new',
    });
    expect(service.uploadItemsToMerge).toEqual([]);
    service._callApiUploadItemsDebounced.cancel();
  });

  test('failed later batches retain all dirty items for an idempotent retry', async () => {
    const { service, upload } = buildService();
    const localItems = Array.from({ length: 51 }, (_, index) =>
      item(String(index)),
    );
    service.uploadItemsToMerge = localItems;
    upload
      .mockResolvedValueOnce({ nonce: 1, created: 50, updated: 0 })
      .mockRejectedValueOnce(new OneKeyLocalError('offline'));
    await expect(
      service._callApiUploadItemsInstantly({ pwdHash: 'keyless-pwd-hash' }),
    ).rejects.toThrow('offline');
    expect(service.uploadItemsToMerge).toEqual(localItems);
    await service._callApiUploadItemsInstantly({ pwdHash: 'keyless-pwd-hash' });
    expect(upload).toHaveBeenCalledTimes(4);
    expect(service.uploadItemsToMerge).toEqual([]);
    expect(localItems.every((record) => !record.serverUploaded)).toBe(true);
  });

  test('cancelling between batches stops further requests and retains dirty items', async () => {
    const { service, upload } = buildService();
    const localItems = Array.from({ length: 101 }, (_, index) =>
      item(String(index)),
    );
    service.uploadItemsToMerge = localItems;
    upload.mockImplementationOnce(async ({ postData }) => {
      await service.cancelPublicAccountSnapshotImport();
      return { nonce: 1, created: postData.localData.length, updated: 0 };
    });
    await expect(
      service._callApiUploadItemsInstantly({ pwdHash: 'keyless-pwd-hash' }),
    ).rejects.toThrow('Cloud sync was cancelled');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(service.uploadItemsToMerge).toEqual(localItems);
    expect(localItems.every((record) => !record.serverUploaded)).toBe(true);
    await service._callApiUploadItemsInstantly({ pwdHash: 'keyless-pwd-hash' });
    expect(upload).toHaveBeenCalledTimes(4);
    expect(service.uploadItemsToMerge).toEqual([]);
  });

  test('failure cannot overwrite a concurrent newer queued value', async () => {
    const { service, upload } = buildService();
    const network = deferred<ICloudSyncUploadResult>();
    const started = deferred<void>();
    upload.mockImplementationOnce(async () => {
      started.resolve();
      return network.promise;
    });
    service.uploadItemsToMerge = [item('same', 'old'), item('other')];
    const first = service._callApiUploadItemsInstantly({
      pwdHash: 'keyless-pwd-hash',
    });
    await started.promise;
    await service._callApiUploadItemsDebounceMerge({
      localItems: [item('same', 'new')],
      pwdHash: 'keyless-pwd-hash',
    });
    service._callApiUploadItemsDebounced.cancel();
    network.reject(new OneKeyLocalError('offline'));
    await expect(first).rejects.toThrow('offline');
    expect(service.uploadItemsToMerge).toEqual([
      item('same', 'new'),
      item('other'),
    ]);
  });

  test('a hardware debounce from before cancellation cannot reuse the new epoch', async () => {
    jest.useFakeTimers();
    try {
      const { service, upload, updateLastSyncTime } = buildService();
      const pwdHash = 'hw-dek-public-test';
      void service._callApiUploadItemsDebounceMerge({
        localItems: [{ ...item('old'), pwdHash }],
        pwdHash,
      });
      await service.cancelPublicAccountSnapshotImport();
      await jest.advanceTimersByTimeAsync(5000);
      expect(upload).not.toHaveBeenCalled();
      expect(updateLastSyncTime).not.toHaveBeenCalled();
      await service._callApiUploadItemsDebounceMerge({
        localItems: [{ ...item('fresh'), pwdHash }],
        pwdHash,
        noDebounceUpload: true,
      });
      expect(upload).toHaveBeenCalledTimes(1);
      expect(
        upload.mock.calls[0][0].postData.localData.map(({ key }) => key),
      ).toEqual(['fresh']);
    } finally {
      jest.useRealTimers();
    }
  });

  test('ending hardware session rejects late admission and a drain already waiting for the mutex', async () => {
    const { service, upload, getHardwareUploadGeneration } = buildService();
    const pwdHash = 'hw-dek-public-test';
    const started = deferred<void>();
    const release = deferred<ICloudSyncUploadResult>();
    upload.mockImplementationOnce(async () => {
      started.resolve();
      return release.promise;
    });
    const send = (key: string) =>
      service._callApiUploadItemsDebounceMerge({
        localItems: [{ ...item(key), pwdHash }],
        pwdHash,
        noDebounceUpload: true,
      });
    const first = send('in-flight');
    await started.promise;
    const waiting = send('waiting');
    getHardwareUploadGeneration.mockReturnValue(undefined);
    await send('during-end');
    await service.cancelPublicAccountSnapshotImport();
    getHardwareUploadGeneration.mockReturnValue(1);
    const fresh = send('after-reenable');
    release.resolve({ nonce: 1, created: 1, updated: 0 });
    await Promise.all([first, waiting, fresh]);
    expect(
      upload.mock.calls.flatMap(([request]) =>
        request.postData.localData.map(({ key }) => key),
      ),
    ).toEqual(['in-flight', 'after-reenable']);
  });

  test('simultaneous immediate drains never send concurrent batches or lose queued items', async () => {
    const { service, upload } = buildService();
    const network = deferred<ICloudSyncUploadResult>();
    const started = deferred<void>();
    upload.mockImplementationOnce(async () => {
      started.resolve();
      return network.promise;
    });
    service.uploadItemsToMerge = [item('first')];
    const first = service._callApiUploadItemsInstantly({
      pwdHash: 'keyless-pwd-hash',
    });
    await started.promise;
    const second = service._callApiUploadItemsDebounceMerge({
      localItems: [item('second')],
      pwdHash: 'keyless-pwd-hash',
      noDebounceUpload: true,
    });
    expect(upload).toHaveBeenCalledTimes(1);
    network.resolve({ nonce: 1, created: 1, updated: 0 });
    await Promise.all([first, second]);
    expect(
      upload.mock.calls.flatMap(([request]) =>
        request.postData.localData.map((record) => record.key),
      ),
    ).toEqual(['first', 'second']);
    expect(service.uploadItemsToMerge).toEqual([]);
  });
});

describe('future pending Account dispatch safety', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    'same-origin',
    'same-check',
    'paired-upload',
    'all-held',
    'bad-count',
    'test-origin',
    'no-proof',
    'aged',
    'flush',
  ] as const)(
    'holds only positively future live Account bytes without reporting mixed success (%s)',
    async (scenario) => {
      const { service, upload, updateLastSyncTime } = buildService();
      const serverTime = 1_900_000_000_000;
      const wall = jest.spyOn(Date, 'now').mockReturnValue(serverTime);
      const monotonic = jest.spyOn(performance, 'now').mockReturnValue(100);
      const url = '/prime/v1/sync/check';
      const origin = endpointsMap.prod.prime;
      const pwdHash = 'hw-dek-future-proof-fixture';
      const future = {
        ...item('future'),
        pwdHash,
        rawKey: 'Account >> cloud-public-account:v1:fixture',
        dataTime: serverTime + 3_600_000,
      };
      const original = { ...future };
      const ordinary = {
        ...item('ordinary'),
        pwdHash,
        rawKey: future.rawKey,
        dataTime: serverTime - 1000,
      };
      const check = jest
        .spyOn(service, 'apiCheckServerStatusKeyless')
        .mockResolvedValue({
          pwdHash: future.pwdHash,
          response: {
            status: 200,
            statusText: 'OK',
            headers: new AxiosHeaders({
              date: new Date(serverTime).toUTCString(),
            }),
            config: {
              url,
              method: 'post',
              baseURL: origin,
              data: JSON.stringify({ pwdHash: future.pwdHash }),
              headers: new AxiosHeaders(),
            },
            request:
              scenario === 'no-proof' ? {} : { responseURL: origin + url },
            data: {
              code: 0,
              message: '',
              data: {
                pwdHash: future.pwdHash,
                obsoleted: [future.id, ordinary.id],
                diff: [],
                updated: [],
                deleted: [],
                serverTime,
              },
            },
          },
        });
      // Sample first without the upload candidate; the direct path then receives
      // a live newly pending Account from the now-committed local write.
      await service.checkServerStatusWithRequestOptions(
        scenario === 'same-check' ? { localItems: [future] } : {},
      );
      const expected =
        scenario === 'same-check'
          ? { ...original, dataTime: serverTime }
          : original;
      expect(future).toEqual(expected);
      expect(check).toHaveBeenCalledTimes(1);
      if (scenario === 'aged' || scenario === 'same-check') {
        monotonic.mockReturnValue(50_000);
        wall.mockReturnValue(serverTime + 49_900);
      }
      const actualPost = jest.fn();
      upload.mockImplementation(async ({ postData, filterHardwareUpload }) => {
        const data = filterHardwareUpload
          ? filterHardwareUpload(
              scenario === 'test-origin' ? endpointsMap.test.prime : origin,
              pwdHash,
            )
          : postData;
        actualPost(data.localData.map((row) => [row.key, row.dataTimestamp]));
        return {
          nonce: 1,
          created: scenario === 'bad-count' ? 2 : data.localData.length,
          updated: 0,
        };
      });
      const uploading = service._callApiUploadItems({
        ...uploadParams(
          scenario === 'all-held' ? [future] : [future, ordinary],
        ),
        pwdHash,
        isFlush: scenario === 'flush',
        requestOptions:
          scenario === 'paired-upload' ? { timeout: 1000 } : undefined,
      });
      if (scenario === 'bad-count') {
        await expect(uploading).rejects.toMatchObject({ autoToast: false });
        expect(updateLastSyncTime).not.toHaveBeenCalled();
        return;
      }
      const result = await uploading;
      expect(future).toEqual(expected);
      if (scenario === 'all-held') {
        expect(actualPost).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
        expect(updateLastSyncTime).not.toHaveBeenCalled();
        return;
      }
      const held = scenario === 'same-origin';
      expect(actualPost).toHaveBeenCalledWith(
        held
          ? [[ordinary.id, ordinary.dataTime]]
          : [
              [future.id, expected.dataTime],
              [ordinary.id, ordinary.dataTime],
            ],
      );
      expect(result?.created).toBe(held ? 1 : 2);
      expect(updateLastSyncTime).toHaveBeenCalledTimes(held ? 0 : 1);
    },
  );
});
