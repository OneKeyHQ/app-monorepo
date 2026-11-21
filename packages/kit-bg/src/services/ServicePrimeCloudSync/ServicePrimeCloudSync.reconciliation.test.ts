import { EDeviceType } from '@onekeyfe/hd-shared';
import { Semaphore } from 'async-mutex';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { cloneDeep } from 'lodash';

import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import {
  EPrimeCloudSyncDataType,
  PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME,
} from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import '@onekeyhq/shared/src/request/axiosInterceptor';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCheckServerStatusResult,
  ICloudSyncCredential,
  ICloudSyncServerItem,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import simpleDb from '../../dbs/simple/simpleDb';
import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';

import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import keylessCloudSyncUtils from './keylessCloudSyncUtils';
import {
  getPublicAccountSnapshotId,
  publicAccountSnapshotToAccount,
} from './publicAccountSnapshot';
import { publicAccountTestSnapshot } from './publicAccountSnapshot.test-utils';
import ServicePrimeCloudSync from './ServicePrimeCloudSync';

import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../dbs/local/types';
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

jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({
  ...jest.requireActual<object>('@onekeyhq/shared/src/request/Interceptor'),
  getRequestHeaders: async () => ({}),
}));

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
  CloudSyncFlowManagerWallet: jest.fn(() => ({
    canUploadPendingWalletName: jest.fn(async () => true),
  })),
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getAllSyncItems: jest.fn(),
    getPendingCloudAccountHandoffs: jest.fn(async () => []),
    storePendingCloudAccountHandoffs: jest.fn(async () => undefined),
    getAllAccounts: jest.fn(),
    getAllDevices: jest.fn(),
    getRecordsByIds: jest.fn(),
    readWalletNameUploadRetrySources: jest.fn(),
    addAndUpdateSyncItems: jest.fn(),
    removeCloudSyncPoolItems: jest.fn(),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    cloudSyncAccountIssues: {
      getRawData: jest.fn(async () => null),
      updateIssues: jest.fn(),
    },
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
    decryptSyncItem: jest.fn(),
    canLocalItemSyncToScene: jest.fn(),
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
  default: {
    ...jest.requireActual<typeof import('./keylessCloudSyncUtils')>(
      './keylessCloudSyncUtils',
    ).default,
    isKeylessPwdHash: () => false,
  },
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
  let hardwareOperationGeneration = 0;
  const cancelHardwareCloudKeyOperation = jest.fn(async () => {
    hardwareOperationGeneration += 1;
    return true;
  });
  const isLocked = jest.fn(async () => false);
  const runWithCloudSyncKeyLock = jest.fn((operation: () => Promise<unknown>) =>
    sourceMutex.runExclusive(operation),
  );
  const readLocalCredential = jest.fn<
    ReturnType<ServicePrimeCloudSync['getSyncCredentialSafe']>,
    []
  >(async () => undefined);
  const service = new ServicePrimeCloudSync({
    backgroundApi: {
      localDb,
      serviceApp: { isAppLocked: isLocked },
      serviceKeylessCloudSync: {
        runWithCloudSyncKeyLock,
        getLocalMutationSyncCredential: readLocalCredential,
        getHardwareWalletRetryOrigin: async () => endpointsMap.prod.prime,
        getHardwareUploadGeneration: () =>
          keyGeneration + hardwareOperationGeneration,
        getCloudAccountImportGeneration: () =>
          keyGeneration + hardwareOperationGeneration,
        getKeylessWalletSelectionGeneration: () => keyGeneration,
        cancelHardwareCloudKeyOperation,
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
    .mockImplementation(async ({ items, fn, preserveExisting }) => {
      const staged = new Map(
        Array.from(pool, ([key, value]) => [key, cloneDeep(value)]),
      );
      for (const row of items) {
        const previous = staged.get(row.id);
        if (
          !previous ||
          (!preserveExisting?.(previous) &&
            (row.dataTime ?? 0) >= (previous.dataTime ?? 0))
        )
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
    readLocalCredential,
    cancelHardwareCloudKeyOperation,
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
    jest.spyOn(localDb, 'getAllAccounts').mockResolvedValue({ accounts: [] });
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

  test.each([
    ['software', false],
    ['hardware', true],
  ] as const)(
    'manual %s reports only an attributable whole-run error',
    async (_kind, hardware) => {
      const h = harness();
      jest
        .spyOn(h.service, 'resolveInitLocalSyncItemsPassword')
        .mockResolvedValue('fixture');
      jest
        .spyOn(h.service, 'resolvePasswordOnlyIfHdXfpMissing')
        .mockResolvedValue('fixture');
      jest
        .spyOn(h.service, 'prepareLocalSyncWallets')
        .mockResolvedValue(undefined);
      jest.spyOn(h.service, 'initLocalSyncItemsDB').mockResolvedValue({
        allWallets: [],
        allDevices: undefined,
        allAccounts: [],
        allIndexedAccounts: [],
      });
      const invoke = () =>
        h.service.syncNowKeylessWithResult({
          callerName: 'Manual fixture',
          askPasswordOnlyIfHdXfpMissing: hardware,
          bypassRetryBackoff: true,
        });
      const accountIssues = (pending: number, added: number) => ({
        needsUpdate: 0,
        pending,
        conflicts: 0,
        rejected: 0,
        added,
        unchanged: 0,
      });
      h.check.mockResolvedValue(reply({ reconciliation: undefined }));
      h.replay.mockImplementationOnce(async () => {
        h.patchConfig({ publicAccountSnapshotStatus: accountIssues(1, 1) });
      });
      await expect(invoke()).resolves.toBe('local-deferred');
      expect(h.config().publicAccountSnapshotStatus).toMatchObject({
        pending: 1,
        added: 1,
      });
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'partial',
      });
      h.replay.mockImplementationOnce(async () => {
        h.patchConfig({ publicAccountSnapshotStatus: accountIssues(1, 0) });
      });
      await expect(invoke()).resolves.toBe('local-deferred');

      h.replay.mockImplementationOnce(async () => {
        h.patchConfig({ publicAccountSnapshotStatus: accountIssues(0, 0) });
      });
      await expect(invoke()).resolves.toBe('completed');

      jest
        .spyOn(requestHelper, 'checkIsOneKeyDomain')
        .mockImplementation(async (url) => url === endpointsMap.prod.prime);
      const failRequest = (path: string, status?: number) =>
        axios
          .create({
            baseURL: endpointsMap.prod.prime,
            adapter: async (config) => {
              throw new AxiosError(
                status === undefined ? 'Network Error' : 'Synthetic HTTP error',
                status === undefined ? AxiosError.ERR_NETWORK : undefined,
                config,
                undefined,
                status === undefined
                  ? undefined
                  : {
                      status,
                      statusText: '',
                      headers: new AxiosHeaders(),
                      config,
                      data: {},
                    },
              );
            },
          })
          .post(path);
      for (const [status, outcome] of [
        [403, 'sync-blocked'],
        [502, 'server-unavailable'],
      ] as const) {
        // Walk the real response interceptor before the manual runner receives
        // the failure. The custom adapter never makes a network request.
        const failure: unknown = await failRequest(
          '/prime/v1/sync/check',
          status,
        ).catch((error: unknown) => error);
        expect(failure).toMatchObject({ httpStatusCode: status });
        expect(failure).not.toHaveProperty('response');
        h.check.mockRejectedValue(failure);
        const failed = invoke();
        await Promise.all([
          expect(failed).resolves.toBe(outcome),
          jest.advanceTimersByTimeAsync(3000),
        ]);
      }

      h.check.mockResolvedValue(
        reply({
          obsoleted: ['synthetic-pending-upload'],
          reconciliation: undefined,
        }),
      );
      const uploadError: unknown = await failRequest(
        '/prime/v1/sync/upload',
      ).catch((error: unknown) => error);
      expect(uploadError).toMatchObject({
        className: EOneKeyErrorClassNames.AxiosNetworkError,
      });
      expect(uploadError).not.toHaveProperty('code', 'ERR_NETWORK');
      jest
        .spyOn(h.service, '_callApiUploadItems')
        .mockRejectedValue(uploadError);
      await expect(invoke()).resolves.toBe('network-unavailable');

      const auth = Object.assign(
        new OneKeyLocalError('Synthetic auth rejection'),
        {
          response: { status: 401 },
        },
      );
      h.check.mockRejectedValue(auth);
      await Promise.all([
        expect(invoke()).resolves.toBe('session-unavailable'),
        jest.advanceTimersByTimeAsync(3000),
      ]);

      h.check.mockImplementationOnce(async () => {
        h.changeSource();
        return reply({ reconciliation: undefined });
      });
      await expect(invoke()).resolves.toBe('cancelled');
      const prepare = jest.spyOn(h.service, 'prepareLocalSyncWallets');
      const checks = h.check.mock.calls.length;
      prepare.mockImplementationOnce(async () => {
        h.changeSource();
      });
      await expect(invoke()).resolves.toBe('cancelled');
      expect(h.check.mock.calls).toHaveLength(checks);

      h.patchConfig({
        currentCloudSyncKeylessWalletId: 'selected-software-wallet',
      });
      const readKey = jest.spyOn(h.service, 'getSyncCredentialSafe');
      readKey.mockResolvedValueOnce(undefined);
      await expect(invoke()).resolves.toBe('software-key-unavailable');
      h.patchConfig({ isCloudSyncEnabledKeyless: false });
      await expect(invoke()).resolves.toBe('incomplete');
    },
  );

  test.each([true, false])(
    'withholds divergent unsent Wallet rows on a legacy full check while preserving siblings (%s)',
    async (includeSibling) => {
      const scope = 'hw-dek-verified-fixture';
      const old: IDBCloudSyncItem = {
        id: 'old-name',
        dataType: EPrimeCloudSyncDataType.Wallet,
        data: 'old-validated-wallet',
        dataTime: 100,
        rawKey: 'old-synthetic',
        rawData: '',
        pwdHash: scope,
        serverUploaded: false,
        localSceneUpdated: false,
        isDeleted: false,
      };
      const sibling: IDBCloudSyncItem = {
        ...old,
        id: 'new-name',
        data: 'new-explicit-wallet',
      };
      const initialPool = new Map([[old.id, old]]);
      if (includeSibling) initialPool.set(sibling.id, sibling);
      const h = harness(0, { initialPool });
      const selected = {
        masterPasswordUUID: scope,
        primeAccountSalt: '',
        securityPasswordR1: '',
      };
      jest
        .spyOn(h.service, 'getSyncCredentialSafe')
        .mockResolvedValue(selected);
      h.readLocalCredential.mockResolvedValue(selected);
      jest
        .spyOn(h.service.syncManagers.wallet, 'canUploadPendingWalletName')
        .mockImplementation(async ({ item }) => item.id !== old.id);
      h.check.mockResolvedValue(
        reply({
          reconciliation: undefined,
          pwdHash: scope,
          obsoleted: [...initialPool.keys()],
        }),
      );
      const upload = jest
        .spyOn(h.service, '_callApiUploadItems')
        .mockResolvedValue({
          nonce: 0,
          created: 1,
          updated: 0,
        });
      await expect(h.run()).resolves.toBe(true);
      expect(h.check).toHaveBeenCalledTimes(1);
      if (includeSibling)
        expect(upload).toHaveBeenCalledWith(
          expect.objectContaining({ localItems: [sibling] }),
        );
      else expect(upload).not.toHaveBeenCalled();
      expect(h.pool.get(old.id)).toEqual(old);
      expect(h.updateLastSyncTime).not.toHaveBeenCalled();
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'complete',
        unfinished: false,
        nextRetryAt: undefined,
        uploaded: includeSibling ? 1 : 0,
      });

      upload.mockClear();
      await h.service.startServerSyncFlowForItems({
        localItems: [...initialPool.values()],
        noDebounceUpload: true,
      });
      if (includeSibling)
        expect(upload).toHaveBeenCalledWith(
          expect.objectContaining({
            localItems: [sibling],
            skipLastSyncTime: true,
          }),
        );
      else expect(upload).not.toHaveBeenCalled();
      expect(h.pool.get(old.id)).toEqual(old);

      upload.mockClear();
      h.service.uploadItemsToMerge = [...initialPool.values()];
      await h.service._callApiUploadItemsInstantly({ pwdHash: scope });
      if (includeSibling)
        expect(upload).toHaveBeenCalledWith(
          expect.objectContaining({
            localItems: [sibling],
            skipLastSyncTime: true,
          }),
        );
      else expect(upload).not.toHaveBeenCalled();
      expect(h.pool.get(old.id)).toEqual(old);
    },
  );

  test.each(['credential', 'wallet'] as const)(
    'direct Wallet verification has one deadline and sends healthy sibling despite stalled %s',
    async (stalled) => {
      const h = harness();
      const scope = 'hw-dek-timeout-fixture';
      const selected = {
        masterPasswordUUID: scope,
        primeAccountSalt: '',
        securityPasswordR1: '',
      };
      const resolveCredential = deferred<typeof selected>();
      const resolveWallet = deferred<boolean>();
      const read = h.readLocalCredential;
      if (stalled === 'credential')
        read.mockImplementationOnce(async () => resolveCredential.promise);
      else read.mockResolvedValue(selected);
      const verify = jest.spyOn(
        h.service.syncManagers.wallet,
        'canUploadPendingWalletName',
      );
      if (stalled === 'wallet')
        verify.mockImplementation(async ({ item }) =>
          item.id === 'timely-wallet' ? true : resolveWallet.promise,
        );
      jest.spyOn(h.service, 'getCloudSyncDataTime').mockResolvedValue(200);
      const network = jest
        .spyOn(h.service, 'apiUploadItemsKeyless')
        .mockResolvedValue({ nonce: 1, created: 1, updated: 0 });
      const healthy: IDBCloudSyncItem = {
        id: 'healthy-account',
        dataType: EPrimeCloudSyncDataType.Account,
        data: 'healthy-fixture-box',
        dataTime: 100,
        rawKey: 'healthy-fixture-key',
        rawData: '',
        pwdHash: scope,
        serverUploaded: false,
        localSceneUpdated: false,
        isDeleted: false,
      };
      const walletRows: IDBCloudSyncItem[] = Array.from(
        { length: 12 },
        (_, index) => ({
          ...healthy,
          id: `held-wallet-${index}`,
          dataType: EPrimeCloudSyncDataType.Wallet,
        }),
      );
      const goodWallet: IDBCloudSyncItem = {
        ...healthy,
        id: 'timely-wallet',
        dataType: EPrimeCloudSyncDataType.Wallet,
      };
      for (const row of [goodWallet, ...walletRows, healthy])
        h.pool.set(row.id, row);
      h.service.uploadItemsToMerge = [goodWallet, ...walletRows, healthy];
      const work = h.service._callApiUploadItemsInstantly({ pwdHash: scope });
      await jest.advanceTimersByTimeAsync(1499);
      expect(network).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await work;
      expect(network).toHaveBeenCalledTimes(1);
      expect(network).toHaveBeenCalledWith(
        expect.objectContaining({
          postData: expect.objectContaining({
            localData: [
              ...(stalled === 'wallet'
                ? [expect.objectContaining({ key: goodWallet.id })]
                : []),
              expect.objectContaining({ key: healthy.id }),
            ],
          }),
        }),
      );
      expect(h.updateLastSyncTime).not.toHaveBeenCalled();
      expect(h.pool.get(walletRows[0].id)).toEqual(walletRows[0]);
      resolveCredential.resolve(selected);
      resolveWallet.resolve(true);
      await jest.advanceTimersByTimeAsync(0);
      expect(verify).toHaveBeenCalledTimes(stalled === 'wallet' ? 9 : 0);
      expect(network).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    'available',
    'conflict',
    'missing-credential',
    'renewed-session',
    'changed-origin',
    'canonical-changed',
    'same-name-new-avatar',
    'same-device-new-model',
    'same-device-new-vendor',
    'switched',
    'disabled',
    'already-sent',
    'newer-during-read',
    'clock-corrected',
    'clock-corrected-out-of-order',
    'clock-corrected-unrecorded',
    'clock-corrected-contested-reject',
    'clock-corrected-contested-timeout',
    'second-timeout',
  ])(
    'one-shot Wallet timeout retry respects current authority: %s',
    async (scenario) => {
      const scope = 'hw-dek-wallet-retry-fixture';
      const wallet: IDBCloudSyncItem = {
        id: 'pending-wallet',
        dataType: EPrimeCloudSyncDataType.Wallet,
        data: 'pending-wallet-box',
        dataTime: 100,
        rawKey: '',
        rawData: '',
        pwdHash: scope,
        serverUploaded: false,
        localSceneUpdated: true,
        isDeleted: false,
      };
      const h = harness(0, { initialPool: new Map([[wallet.id, wallet]]) });
      const selected: ICloudSyncCredential = {
        masterPasswordUUID: scope,
        primeAccountSalt: '',
        securityPasswordR1: '',
        keylessCredential: {
          keylessWalletId: 'hardware-source',
          pwdHash: scope,
          encryptionKey: 'public-fixture-credential',
          signingPublicKey: '',
          signingPrivateKey: '',
          source: {
            type: 'hardware',
            credentialId: 'hardware-source',
            derivationVersion: 1,
            deviceName: 'Test device',
            deviceType: EDeviceType.Pro,
          },
          hardwareSession: {
            deviceKeyJwk: { kty: 'EC', crv: 'P-256', x: '', y: '', d: '' },
            sessionId: 'synthetic-session',
            accessToken: 'synthetic-access',
            accessTokenExpiresAt: 0,
            refreshToken: 'synthetic-refresh',
            dekId: 'current-fixture-dek',
          },
        },
      };
      const changedDevice =
        scenario === 'same-device-new-model' ||
        scenario === 'same-device-new-vendor';
      const physical: IDBDevice | undefined = changedDevice
        ? {
            id: 'verified-device',
            name: 'Test device',
            features: '{}',
            connectId: 'public-fixture-connect',
            uuid: 'public-fixture-uuid',
            deviceId: 'public-fixture-device',
            deviceType: EDeviceType.Pro,
            settingsRaw: '{}',
            createdAt: 1,
            updatedAt: 1,
          }
        : undefined;
      const canonical: IDBWallet = {
        id: physical ? 'hw-1' : 'hd-1',
        type: physical ? 'hw' : 'hd',
        associatedDevice: physical?.id,
        name: 'Saved local name',
        hash: 'public-wallet-hash',
        nextIds: {},
        accounts: [],
        backuped: true,
        walletNo: 1,
      };
      const firstRead = deferred<boolean>();
      const retryRead = deferred<boolean>();
      h.readLocalCredential.mockResolvedValue(selected);
      const verify = jest.spyOn(
        h.service.syncManagers.wallet,
        'canUploadPendingWalletName',
      );
      verify.mockImplementation(async ({ onVerifiedWallet }) => {
        const verified =
          scenario === 'newer-during-read' || scenario === 'second-timeout'
            ? await retryRead.promise
            : true;
        if (verified) onVerifiedWallet?.(canonical, physical);
        return verified;
      });
      jest
        .spyOn(localDb, 'readWalletNameUploadRetrySources')
        .mockImplementation(async ({ itemIds }) => {
          let canonicalAtDispatch = canonical;
          if (scenario === 'canonical-changed')
            canonicalAtDispatch = {
              ...canonical,
              name: 'Newer unbound local name',
            };
          if (scenario === 'same-name-new-avatar')
            canonicalAtDispatch = { ...canonical, avatar: '{"img":"bear"}' };
          let deviceAtDispatch = physical;
          if (physical && scenario === 'same-device-new-model')
            deviceAtDispatch = { ...physical, deviceType: EDeviceType.Classic };
          if (physical && scenario === 'same-device-new-vendor')
            deviceAtDispatch = {
              ...physical,
              settingsRaw: '{"vendor":"trezor"}',
            };
          return {
            items: itemIds.map((id) => h.pool.get(id)),
            wallets: [canonicalAtDispatch],
            devices: deviceAtDispatch ? [deviceAtDispatch] : [],
          };
        });
      if (scenario === 'missing-credential')
        h.readLocalCredential.mockResolvedValueOnce(undefined);
      else if (scenario === 'conflict') verify.mockResolvedValueOnce(false);
      else verify.mockReturnValueOnce(firstRead.promise);
      const wire = jest.fn();
      const api = jest
        .spyOn(h.service, 'apiUploadItemsKeyless')
        .mockImplementation(async ({ postData, prepareWalletRetry }) => {
          const actual = selected.keylessCredential;
          if (!actual?.hardwareSession)
            throw new OneKeyLocalError('Missing test session');
          const send = await prepareWalletRetry?.(
            scenario === 'renewed-session'
              ? {
                  ...actual,
                  hardwareSession: {
                    ...actual.hardwareSession,
                    sessionId: 'replacement-session',
                  },
                }
              : actual,
            scenario === 'changed-origin'
              ? endpointsMap.test.prime
              : endpointsMap.prod.prime,
          );
          if (prepareWalletRetry && !send)
            throw new OneKeyLocalError({
              message: 'Declined retry fixture',
              autoToast: false,
            });
          wire(send ? send() : postData);
          return { nonce: 1, created: 1, updated: 0 };
        });
      h.service.uploadItemsToMerge = [wallet];
      const direct = h.service._callApiUploadItemsInstantly({ pwdHash: scope });
      await jest.advanceTimersByTimeAsync(1500);
      await direct;
      firstRead.resolve(true);
      expect(wire).not.toHaveBeenCalled();
      const corrected = {
        ...wallet,
        data: 'clock-corrected-box',
        dataTime: 99,
      };
      const sibling = { ...wallet, id: 'healthy-sibling-wallet' };
      const contestedReadFails = scenario.startsWith(
        'clock-corrected-contested',
      );
      if (scenario.startsWith('clock-corrected')) {
        const queued =
          scenario === 'clock-corrected-unrecorded'
            ? { ...corrected, data: 'not-persisted-box' }
            : corrected;
        const schedule = (item: IDBCloudSyncItem) =>
          h.service['scheduleWalletUploadReadRetry']({
            items: [item],
            pwdHash: scope,
            origin: endpointsMap.prod.prime,
            isCurrent: () => true,
          });
        h.pool.set(wallet.id, corrected);
        schedule(queued);
        if (scenario === 'clock-corrected-out-of-order') schedule(wallet);
        if (contestedReadFails) {
          schedule(sibling);
          h.pool.set(sibling.id, sibling);
          h.getRecords.mockImplementation(async ({ ids }) => {
            if (ids.includes(wallet.id)) {
              if (scenario === 'clock-corrected-contested-reject')
                throw new OneKeyLocalError('Contested Wallet read unavailable');
              await deferred<boolean>().promise;
            }
            return { records: ids.map((id) => h.pool.get(id)) };
          });
        }
      }
      if (scenario === 'switched') h.changeSource();
      if (scenario === 'disabled')
        jest
          .spyOn(h.service, 'getActiveSyncMode')
          .mockResolvedValue(ECloudSyncMode.None);
      if (scenario === 'already-sent')
        h.pool.set(wallet.id, { ...wallet, serverUploaded: true });

      await jest.advanceTimersByTimeAsync(1000);
      const newer = { ...wallet, data: 'new-avatar-box', dataTime: 101 };
      if (scenario === 'newer-during-read') {
        expect(verify).toHaveBeenCalledTimes(2);
        h.pool.set(wallet.id, newer);
        h.service.uploadItemsToMerge = [newer];
        retryRead.resolve(true);
      }
      await jest.advanceTimersByTimeAsync(1500);
      retryRead.resolve(true);
      await jest.advanceTimersByTimeAsync(60_000);
      expect(api).toHaveBeenCalledTimes(
        [
          'conflict',
          'missing-credential',
          'switched',
          'disabled',
          'clock-corrected-unrecorded',
        ].includes(scenario)
          ? 0
          : 1,
      );
      if (
        scenario === 'available' ||
        scenario === 'clock-corrected' ||
        scenario === 'clock-corrected-out-of-order' ||
        contestedReadFails
      ) {
        let expected: IDBCloudSyncItem = corrected;
        if (contestedReadFails) expected = sibling;
        if (scenario === 'available') expected = wallet;
        expect(wire).toHaveBeenCalledWith(
          expect.objectContaining({
            localData: [
              expect.objectContaining({
                key: expected.id,
                data: expected.data,
                dataTimestamp: expected.dataTime,
              }),
            ],
          }),
        );
        expect(wire).toHaveBeenCalledTimes(1);
      } else expect(wire).not.toHaveBeenCalled();
      expect(h.service.uploadItemsToMerge).toEqual(
        scenario === 'newer-during-read' ? [newer] : [],
      );
      expect(h.updateLastSyncTime).not.toHaveBeenCalled();
      expect(h.check).not.toHaveBeenCalled();
    },
  );

  test('manual sync uploads missing hardware snapshots without adding a selector scan', async () => {
    const h = harness();
    const snapshot = publicAccountTestSnapshot();
    const hardwareAccount = publicAccountSnapshotToAccount(
      snapshot,
      'hw-local',
    );
    const softwareAccount = publicAccountSnapshotToAccount(
      snapshot,
      'hd-local',
    );
    const getAccounts = jest
      .spyOn(localDb, 'getAllAccounts')
      .mockResolvedValue({
        accounts: [hardwareAccount, softwareAccount],
      });
    jest.spyOn(localDb, 'getAllDevices').mockResolvedValue({ devices: [] });
    const recovered: IDBCloudSyncItem = {
      id: 'recovered-account',
      dataType: EPrimeCloudSyncDataType.Account,
      data: 'synthetic-public-snapshot-ciphertext',
      dataTime: PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME,
      rawKey: '',
      rawData: '',
      pwdHash: 'public-root-space',
      isDeleted: false,
      localSceneUpdated: true,
      serverUploaded: false,
    };
    const build = jest.fn(async () => [recovered]);
    h.service.syncManagers.account.buildInitSyncDBItems = build;
    await h.service.startServerSyncFlowSilently({
      callerName: 'AccountManagerStacks onMounted',
    });
    expect(getAccounts).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    h.check.mockImplementationOnce(async ({ localItems = [] }) =>
      reply({
        obsoleted: localItems.map((item) => item.id),
        reconciliation: undefined,
      }),
    );
    const upload = jest
      .spyOn(h.service, '_callApiUploadItems')
      .mockResolvedValue({ nonce: 0, created: 1, updated: 0 });
    await expect(
      h.service.startServerSyncFlowSilently({ forceSync: true }),
    ).resolves.toBe(true);

    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        dbRecords: [hardwareAccount],
        initDataTime: PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME,
      }),
    );
    expect(h.writePool).toHaveBeenCalledWith(
      expect.objectContaining({ skipUpdate: true }),
    );
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ localItems: [recovered] }),
    );
    expect(h.replay).toHaveBeenCalledWith(
      expect.objectContaining({ forceSync: true }),
    );
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

  test.each(['waiting', 'blocked'] as const)(
    'leaving the Cloud page preserves a %s retry when the source is unchanged',
    async (status) => {
      const h = harness(status === 'waiting' ? 4500 : 0);
      if (status === 'blocked') {
        jest
          .spyOn(h.service, 'fillingSyncItemsMissingDataFromRawData')
          .mockRejectedValueOnce(
            new OneKeyLocalError('Temporary local processing failure'),
          );
        await expect(h.run()).rejects.toThrow(
          'Temporary local processing failure',
        );
      } else await expect(h.run()).resolves.toBe(false);
      const state = h.config().cloudSyncReconciliation;
      expect(state?.status).toBe(status);
      if (!state?.nextRetryAt)
        throw new OneKeyLocalError('Missing retry deadline');
      const checksBeforeRetry = h.check.mock.calls.length;

      // The Cloud page cleanup cancels device prompts even when none is open.
      await h.cancelHardwareCloudKeyOperation();
      await jest.advanceTimersByTimeAsync(state.nextRetryAt - Date.now());

      expect(h.check).toHaveBeenCalledTimes(checksBeforeRetry + 1);
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'complete',
        unfinished: false,
      });
    },
  );

  test.each(['source', 'space', 'cancel'] as const)(
    'a scheduled retry stays cancelled after a %s change',
    async (change) => {
      const h = harness(4500);
      await h.run();
      const checksBeforeRetry = h.check.mock.calls.length;
      if (change === 'source') h.changeSource();
      else if (change === 'cancel')
        await h.service.cancelPublicAccountSnapshotImport();
      else
        jest.spyOn(h.service, 'getSyncCredentialSafe').mockResolvedValue({
          masterPasswordUUID: 'other-space',
          primeAccountSalt: 'public-fixture',
          securityPasswordR1: 'unused-test-only',
        });

      await jest.advanceTimersByTimeAsync(1000);

      expect(h.check).toHaveBeenCalledTimes(checksBeforeRetry);
    },
  );

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

  test.each(['startup', 'unlock', 'network', 'foreground', 'manual'] as const)(
    'completed reconciliation checks fresh remote additions and deletions on %s',
    async (reason) => {
      const h = harness();
      await h.run();
      expect(h.config().cloudSyncReconciliation?.status).toBe('complete');
      const added = { ...serverItem(0), dataTimestamp: 1000 };
      h.remote.push(added);
      await h.service.resumeCloudSyncReconciliation({ reason });
      expect(h.check).toHaveBeenCalledTimes(2);
      expect(h.pool.get(added.key)).toMatchObject({
        isDeleted: false,
        serverUploaded: true,
        dataTime: added.dataTimestamp,
      });
      h.remote[0] = {
        ...added,
        isDeleted: true,
        dataTimestamp: added.dataTimestamp + 1,
      };
      await h.service.resumeCloudSyncReconciliation({ reason });
      expect(h.check).toHaveBeenCalledTimes(3);
      expect(h.pool.get(added.key)).toMatchObject({
        isDeleted: true,
        serverUploaded: true,
        dataTime: added.dataTimestamp + 1,
      });
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'complete',
        unfinished: false,
      });
      expect(h.check).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          reconciliation: expect.objectContaining({
            version: 1,
            maxItems: 500,
          }),
        }),
      );
    },
  );

  test.each(['startup', 'unlock', 'network', 'foreground', 'manual'] as const)(
    'persistent local pending does not hide later remote changes on %s',
    async (reason) => {
      const h = harness(1);
      await h.run();
      const pending = h.remote[0];
      const row = h.pool.get(pending.key);
      const state = h.config().cloudSyncReconciliation;
      if (!row || !state) throw new OneKeyLocalError('Missing test state');
      row.localSceneUpdated = false;
      h.patchConfig({
        cloudSyncReconciliation: { ...state, status: 'partial' },
        publicAccountSnapshotStatus: {
          needsUpdate: 0,
          pending: 1,
          conflicts: 0,
          rejected: 0,
          added: 0,
          unchanged: 0,
        },
      });
      h.writePool.mockClear();
      const added = serverItem(1);
      const addedTimestamp = added.dataTimestamp;
      if (addedTimestamp === undefined)
        throw new OneKeyLocalError('Missing fixture timestamp');
      h.remote.push(added);
      await h.service.resumeCloudSyncReconciliation({ reason });
      expect(h.pool.get(added.key)?.isDeleted).toBe(false);
      h.remote[1] = {
        ...added,
        isDeleted: true,
        dataTimestamp: addedTimestamp + 1,
      };
      await h.service.resumeCloudSyncReconciliation({ reason });
      expect(h.pool.get(added.key)).toMatchObject({
        isDeleted: true,
        dataTime: addedTimestamp + 1,
      });
      await h.service.resumeCloudSyncReconciliation({ reason });
      expect(h.check).toHaveBeenCalledTimes(4);
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'partial',
        unfinished: false,
      });
      expect(h.pool.get(pending.key)?.localSceneUpdated).toBe(false);
      // The pending payload remains in each summary, so it is not downloaded
      // again merely because scene application cannot yet finish.
      expect(h.writePool).toHaveBeenCalledTimes(2);
      for (const [request, options] of h.check.mock.calls.slice(1)) {
        expect(request.localItems).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: pending.key }),
          ]),
        );
        expect(options).toMatchObject({
          reconciliation: { version: 1, maxItems: 500 },
        });
      }
      for (const [write] of h.writePool.mock.calls)
        expect(write.items.map((item) => item.id)).toEqual([added.key]);
    },
  );

  test.each(['source', 'selected-space', 'cancel'] as const)(
    'partial wake does not check remotely after %s changes during replay',
    async (change) => {
      const h = harness();
      await h.run();
      const state = h.config().cloudSyncReconciliation;
      if (!state) throw new OneKeyLocalError('Missing test state');
      h.patchConfig({
        cloudSyncReconciliation: { ...state, status: 'partial' },
      });
      h.replay.mockImplementationOnce(async () => {
        if (change === 'source') h.changeSource();
        else if (change === 'cancel')
          await h.service.cancelPublicAccountSnapshotImport();
        else
          jest.spyOn(h.service, 'getSyncCredentialSafe').mockResolvedValue({
            masterPasswordUUID: 'other-space',
            primeAccountSalt: 'public-fixture',
            securityPasswordR1: 'unused-test-only',
          });
      });
      await h.service.resumeCloudSyncReconciliation({ reason: 'foreground' });
      expect(h.check).toHaveBeenCalledTimes(1);
    },
  );

  test('partial automatic wakes respect backoff while manual retry compares immediately', async () => {
    const h = harness();
    await h.run();
    const state = h.config().cloudSyncReconciliation;
    if (!state) throw new OneKeyLocalError('Missing test state');
    h.patchConfig({
      cloudSyncReconciliation: {
        ...state,
        status: 'partial',
        nextRetryAt: Date.now() + 30_000,
      },
    });
    h.replay.mockClear();
    for (const reason of [
      'startup',
      'unlock',
      'network',
      'foreground',
      'timer',
    ] as const)
      await h.service.resumeCloudSyncReconciliation({ reason });
    expect(h.replay).not.toHaveBeenCalled();
    expect(h.check).toHaveBeenCalledTimes(1);
    await h.service.resumeCloudSyncReconciliation({ reason: 'manual' });
    expect(h.replay).toHaveBeenCalledTimes(2);
    expect(h.check).toHaveBeenCalledTimes(2);
  });

  test('concurrent partial wakes share replay and the bounded comparison', async () => {
    const h = harness();
    await h.run();
    const state = h.config().cloudSyncReconciliation;
    if (!state) throw new OneKeyLocalError('Missing test state');
    h.patchConfig({ cloudSyncReconciliation: { ...state, status: 'partial' } });
    h.replay.mockClear();
    const entered = deferred<void>();
    const release = deferred<void>();
    h.replay.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
    });
    const wakes = (['foreground', 'network', 'manual'] as const).map((reason) =>
      h.service.resumeCloudSyncReconciliation({ reason }),
    );
    await entered.promise;
    expect(h.replay).toHaveBeenCalledTimes(1);
    release.resolve();
    await Promise.all(wakes);
    expect(h.replay).toHaveBeenCalledTimes(2);
    expect(h.check).toHaveBeenCalledTimes(2);
  });

  test('a stale timer does not restart a completed reconciliation', async () => {
    const h = harness();
    await h.run();
    h.remote.push(serverItem(0));
    await h.service.resumeCloudSyncReconciliation({ reason: 'timer' });
    expect(h.check).toHaveBeenCalledTimes(1);
  });

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
    expect(h.check).toHaveBeenCalledTimes(2);
    expect(h.pool.get(row.key)?.serverUploaded).toBe(false);
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

  test('a legacy full check applies every record, replays scenes and reports completion', async () => {
    const h = harness(700);
    h.check.mockResolvedValue(
      reply({ diff: h.remote, reconciliation: undefined }),
    );
    await expect(h.run()).resolves.toBe(true);
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(h.pool.size).toBe(700);
    expect(h.committedBatches.every((size) => size <= 50)).toBe(true);
    expect(h.replay).toHaveBeenCalledTimes(1);
    expect(h.updateLastSyncTime).toHaveBeenCalled();
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      reason: 'finished',
      unfinished: false,
      requests: 1,
      applied: 700,
    });
    await jest.advanceTimersByTimeAsync(120_000);
    expect(h.check).toHaveBeenCalledTimes(1);
  });

  test.each([
    'no-hardware-session',
    'verified-newer',
    'wrong-ciphertext-key',
    'withheld-hung-proof',
  ] as const)(
    'handles a same-ID Account without interrupting a sibling: %s',
    async (mode) => {
      const builder = jest.requireActual<
        typeof import('./cloudSyncItemBuilder')
      >('./cloudSyncItemBuilder').default;
      const keyless = jest.requireActual<
        typeof import('./keylessCloudSyncUtils')
      >('./keylessCloudSyncUtils').default;
      jest
        .spyOn(keylessCloudSyncUtils, 'isKeylessPwdHash')
        .mockImplementation((pwdHash) => keyless.isKeylessPwdHash(pwdHash));

      function credential(
        generation: string,
        keyByte: string,
      ): ICloudSyncCredential {
        const pwdHash = `${HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX}${generation}`;
        return {
          masterPasswordUUID: pwdHash,
          primeAccountSalt: '',
          securityPasswordR1: '',
          keylessCredential: {
            keylessWalletId: '-synthetic-hardware-only',
            signingPrivateKey: '',
            signingPublicKey: '',
            pwdHash,
            encryptionKey: keyByte.repeat(32),
          },
        };
      }

      const active = credential('active', '12');
      const source = {
        type: 'hardware' as const,
        credentialId: '-synthetic-hardware-only',
        derivationVersion: 1 as const,
        deviceName: 'Synthetic',
        deviceType: EDeviceType.Pro,
      };
      if (mode !== 'no-hardware-session' && active.keylessCredential) {
        active.keylessCredential.source = source;
        active.keylessCredential.hardwareSession = {
          deviceKeyJwk: { kty: 'EC', crv: 'P-256', x: '', y: '', d: '' },
          accessToken: 'synthetic',
          accessTokenExpiresAt: 0,
          refreshToken: 'synthetic',
          sessionId: 'synthetic',
          dekId: 'synthetic',
        };
      }
      const foreign = credential('a'.repeat(64), '34');
      async function buildAccount(
        index: number,
        syncCredential: ICloudSyncCredential,
        dataTime: number,
      ) {
        const snapshot = publicAccountTestSnapshot(index);
        const accountId = getPublicAccountSnapshotId(snapshot);
        const rawKey = `Account >> ${accountId}`;
        const row = await builder.buildSyncItemFromRawDataJson({
          key: sha512ProSync({ data: rawKey }),
          rawDataJson: {
            dataType: EPrimeCloudSyncDataType.Account,
            rawKey,
            payload: {
              accountId,
              name: snapshot.account.name,
              publicAccountSnapshot: snapshot,
            },
          },
          syncCredential,
          dataTime,
        });
        const { rawDataJson } = await builder.decryptSyncItem({
          item: { ...row, rawData: '' },
          syncCredential,
        });
        expect(rawDataJson).toMatchObject({ rawKey });
        if (!row.data)
          throw new OneKeyLocalError('Expected encrypted Account fixture');
        return { ...row, data: row.data };
      }

      const old = await buildAccount(0, foreign, Date.now() - 20);
      const collided = await buildAccount(0, active, Date.now() - 10);
      const sibling = await buildAccount(1, active, Date.now() - 5);
      expect(collided.id).toBe(old.id);
      expect(collided.data).not.toBe(old.data);
      expect(sibling.id).not.toBe(old.id);
      const preserved = {
        ...old,
        rawData: '',
        serverUploaded: true,
        localSceneUpdated: true,
      };
      const h = harness(0, {
        initialPool: new Map([[old.id, preserved]]),
        initialConfig: {
          isCloudSyncEnabled: false,
          isCloudSyncEnabledKeyless: true,
          cloudSyncAccountApplyVersion: 2,
          ...(mode !== 'no-hardware-session'
            ? { hardwareCloudSyncKeySource: source }
            : {}),
        },
      });
      const enteredProof = deferred<void>();
      const releaseProof = deferred<void>();
      if (mode !== 'no-hardware-session') {
        jest
          .spyOn(cloudSyncItemBuilder, 'decryptSyncItem')
          .mockImplementation(async (params) => {
            if (
              mode === 'withheld-hung-proof' &&
              params.item.id === collided.id
            ) {
              enteredProof.resolve();
              await releaseProof.promise;
            }
            return builder.decryptSyncItem(params);
          });
      }
      jest.spyOn(h.service, 'getSyncCredentialSafe').mockResolvedValue(active);
      h.readLocalCredential.mockResolvedValue(active);
      const remote = [collided, sibling].map(
        (row): ICloudSyncServerItem => ({
          key: row.id,
          data:
            mode === 'wrong-ciphertext-key' && row.id === collided.id
              ? old.data
              : row.data,
          dataTimestamp: row.dataTime,
          dataType: EPrimeCloudSyncDataType.Account,
          isDeleted: false,
          pwdHash: row.pwdHash,
        }),
      );
      // The deployed response has no reconciliation envelope. The simulated
      // server returns only the records absent from the client's exact summary.
      h.check.mockImplementation(async ({ localItems = [] }) =>
        reply({
          reconciliation: undefined,
          pwdHash: active.masterPasswordUUID,
          diff: remote.filter(
            (row) =>
              !localItems.some(
                (local) =>
                  local.id === row.key && local.dataTime === row.dataTimestamp,
              ),
          ),
        }),
      );
      const upload = jest
        .spyOn(h.service, '_callApiUploadItems')
        .mockRejectedValue(
          new OneKeyLocalError('Unexpected upload in download fixture'),
        );

      const run = h.run();
      if (mode === 'withheld-hung-proof') {
        await enteredProof.promise;
        expect(h.sourceMutex.isLocked()).toBe(false);
        await jest.advanceTimersByTimeAsync(1500);
      }
      await expect(run).resolves.toBe(true);
      if (mode === 'withheld-hung-proof') {
        releaseProof.resolve();
        await jest.advanceTimersByTimeAsync(0);
      }
      expect(h.check).toHaveBeenCalledTimes(1);
      expect(h.check.mock.calls[0][0].localItems).toEqual([]);
      expect(h.pool.get(old.id)).toEqual(preserved);
      expect(h.pool.get(sibling.id)).toMatchObject({
        data: sibling.data,
        pwdHash: sibling.pwdHash,
      });
      expect(
        h.scene.mock.calls.flatMap(([params]) =>
          params.items.map(({ id }) => id),
        ),
      ).toEqual(
        mode === 'verified-newer' ? [sibling.id, old.id] : [sibling.id],
      );
      if (mode === 'verified-newer') {
        expect(
          h.scene.mock.calls
            .find(([params]) =>
              params.items.some((item) => item.id === old.id),
            )?.[0]
            .foreignAccountsByWireId?.get(old.id),
        ).toEqual(preserved);
        expect(
          jest.spyOn(localDb, 'storePendingCloudAccountHandoffs'),
        ).not.toHaveBeenCalled();
        return;
      }
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'complete',
        reason: 'finished',
        requests: 1,
        applied: 1,
        uploaded: 0,
      });

      if (mode === 'withheld-hung-proof') return;

      h.scene.mockClear();
      await expect(h.run()).resolves.toBe(true);
      expect(h.check).toHaveBeenCalledTimes(2);
      expect(h.check.mock.calls[1][0].localItems?.map(({ id }) => id)).toEqual([
        sibling.id,
      ]);
      expect(h.pool.get(old.id)).toEqual(preserved);
      expect(h.scene.mock.calls.flatMap(([params]) => params.items)).toEqual(
        [],
      );
      expect(upload).not.toHaveBeenCalled();
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'complete',
        reason: 'finished',
        requests: 1,
        applied: 0,
        uploaded: 0,
      });
    },
  );

  test('downloads the payload again when a local account item only has matching metadata', async () => {
    const h = harness(1);
    const remote = h.remote[0];
    h.pool.set(remote.key, {
      id: remote.key,
      data: undefined,
      dataTime: remote.dataTimestamp,
      dataType: remote.dataType,
      pwdHash: remote.pwdHash,
      rawKey: '',
      rawData: '',
      isDeleted: false,
      localSceneUpdated: true,
      serverUploaded: true,
    });

    await expect(h.run()).resolves.toBe(true);

    expect(h.check.mock.calls[0][0].localItems).toEqual([]);
    expect(h.pool.get(remote.key)).toMatchObject({
      data: remote.data,
      dataTime: remote.dataTimestamp,
      localSceneUpdated: false,
    });
    expect(h.scene).toHaveBeenCalled();
  });

  test('startup recovers a persisted backend-unverified state through its retry timer', async () => {
    const h = harness();
    h.check.mockResolvedValue(reply({ reconciliation: undefined }));
    h.patchConfig({
      cloudSyncReconciliation: {
        version: 1,
        spaceId: 'public-root-space',
        status: 'blocked',
        reason: 'backend-unverified',
        unfinished: true,
        failures: 0,
        requests: 1,
        rounds: 1,
        received: 0,
        applied: 0,
        uploaded: 0,
        nextRetryAt: Date.now() + 60_000,
        updatedAt: Date.now(),
      },
    });
    await h.service.resumeCloudSyncReconciliation({ reason: 'startup' });
    expect(h.check).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      reason: 'finished',
      unfinished: false,
    });
  });

  test.each([400, 422])(
    'strict legacy status %s falls back once without capability and completes the full response',
    async (status) => {
      const h = harness(700);
      h.check.mockImplementationOnce(async () => {
        throw Object.assign(new OneKeyLocalError('Synthetic strict backend'), {
          response: { status },
        });
      });
      await expect(h.run()).resolves.toBe(true);
      expect(h.check).toHaveBeenCalledTimes(2);
      expect(h.check.mock.calls[0][1]?.reconciliation).toBeDefined();
      expect(h.check.mock.calls[1][1]?.reconciliation).toBeUndefined();
      expect(h.check.mock.calls[1][1]?.signal).toBe(
        h.check.mock.calls[0][1]?.signal,
      );
      expect(h.pool.size).toBe(700);
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'complete',
        reason: 'finished',
        unfinished: false,
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

  test('legacy checks complete local mutations without starting a polling loop', async () => {
    const h = harness();
    h.check.mockResolvedValue({ ...reply(), reconciliation: undefined });
    await h.run();
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      unfinished: false,
    });
    for (let index = 0; index < 3; index += 1)
      await h.service.startServerSyncFlowSilently({ localMutation: true });
    expect(h.check).toHaveBeenCalledTimes(4);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(h.check).toHaveBeenCalledTimes(4);
  });

  test('a short receipt from a batched account write schedules a full HTTP retry', async () => {
    const h = harness();
    const server = serverItem(1);
    const local: IDBCloudSyncItem = {
      id: server.key,
      data: server.data,
      dataTime: server.dataTimestamp,
      dataType: server.dataType,
      pwdHash: server.pwdHash,
      isDeleted: false,
      rawKey: '',
      rawData: '',
      localSceneUpdated: true,
      serverUploaded: false,
    };
    h.pool.set(local.id, local);
    h.check.mockResolvedValue(
      reply({ obsoleted: [local.id], reconciliation: undefined }),
    );
    const upload = jest
      .spyOn(h.service, '_callApiUploadItems')
      .mockResolvedValueOnce({ nonce: 0, created: 0, updated: 0 })
      .mockResolvedValueOnce({ nonce: 1, created: 1, updated: 0 });
    await h.service.startServerSyncFlowForItems({ localItems: [local] });

    await jest.advanceTimersByTimeAsync(1000);
    expect(upload).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(h.check.mock.calls[1][0]).toMatchObject({ isFullDBChecking: true });
    expect(h.config().cloudSyncReconciliation?.status).toBe('complete');

    const newVersion = { ...local, dataTime: (local.dataTime ?? 0) + 1 };
    const other = { ...local, id: 'next-account' };
    await h.service.startServerSyncFlowForItems({
      localItems: [other],
    });
    h.check.mockResolvedValue(reply({ reconciliation: undefined }));
    await jest.advanceTimersByTimeAsync(1000);
    expect(h.check.mock.calls[2][0].localItems).toEqual([other]);

    await h.service.startServerSyncFlowForItems({ localItems: [newVersion] });
    await h.run();
    await jest.advanceTimersByTimeAsync(1000);
    expect(h.check.mock.calls[4][0].localItems).toEqual([newVersion]);
  });

  test('an automatic retry retains the manual forced replay after a short receipt', async () => {
    const h = harness();
    await h.run();
    h.replay.mockClear();
    const server = serverItem(1);
    h.pool.set(server.key, {
      id: server.key,
      data: server.data,
      dataTime: server.dataTimestamp,
      dataType: server.dataType,
      pwdHash: server.pwdHash,
      isDeleted: false,
      rawKey: '',
      rawData: '',
      localSceneUpdated: true,
      serverUploaded: false,
    });
    h.check.mockResolvedValueOnce(
      reply({ obsoleted: [server.key], reconciliation: undefined }),
    );
    jest
      .spyOn(h.service, '_callApiUploadItems')
      .mockResolvedValueOnce({ nonce: 0, created: 0, updated: 0 });
    await expect(
      h.service.startServerSyncFlowSilently({
        forceSync: true,
        bypassRetryBackoff: true,
      }),
    ).resolves.toBe(false);
    expect(h.replay).not.toHaveBeenCalled();
    expect(h.config().cloudSyncReconciliation?.forceSceneReplay).toBe(true);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(h.replay).toHaveBeenCalledWith(
      expect.objectContaining({ forceSync: true }),
    );
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      unfinished: false,
    });
    expect(
      h.config().cloudSyncReconciliation?.forceSceneReplay,
    ).toBeUndefined();
  });

  test.each(['locked', 'offline'] as const)(
    'a %s local retry waits for recovery without sending or dropping pending work',
    async (blocked) => {
      const h = harness();
      h.check.mockResolvedValue({ ...reply(), reconciliation: undefined });
      h.check.mockResolvedValueOnce(reply({ diff: [serverItem(0)] }));
      jest
        .spyOn(h.service, 'saveServerSyncItemsToLocal')
        .mockResolvedValueOnce(undefined);
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
      h.check.mockResolvedValueOnce(reply({ diff: [serverItem(0)] }));
      jest
        .spyOn(h.service, 'saveServerSyncItemsToLocal')
        .mockResolvedValueOnce(undefined);
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

  test('no-progress cooldown survives automatic triggers and later retries without a permanent gate', async () => {
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
    for (const reason of [
      'startup',
      'unlock',
      'foreground',
      'network',
    ] as const)
      await h.service.resumeCloudSyncReconciliation({ reason });
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

  test('manual retry immediately completes a previously blocked reconciliation', async () => {
    const h = harness();
    h.check.mockResolvedValueOnce(reply({ diff: [serverItem(0)] }));
    h.writePool.mockImplementationOnce(async ({ fn }) => {
      await fn?.();
    });
    await h.run();
    expect(h.config().cloudSyncReconciliation?.nextRetryAt).toBeGreaterThan(
      Date.now(),
    );
    await h.service.resumeCloudSyncReconciliation({ reason: 'manual' });
    expect(h.check).toHaveBeenCalledTimes(2);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      unfinished: false,
      requests: 2,
    });
  });

  test('manual retry bypasses persisted backoff and failed retry re-arms automatic backoff', async () => {
    const h = harness();
    h.check.mockResolvedValue(reply({ diff: [serverItem(0)] }));
    h.writePool.mockImplementation(async ({ fn }) => {
      await fn?.();
    });
    await h.run();
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(h.config().cloudSyncReconciliation?.nextRetryAt).toBe(
      Date.now() + 30_000,
    );

    await h.service.resumeCloudSyncReconciliation({ reason: 'manual' });
    expect(h.check).toHaveBeenCalledTimes(2);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'blocked',
      reason: 'no-progress',
      failures: 2,
      nextRetryAt: Date.now() + 60_000,
    });
    await h.service.resumeCloudSyncReconciliation({ reason: 'network' });
    await jest.advanceTimersByTimeAsync(30_000);
    expect(h.check).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(h.check).toHaveBeenCalledTimes(3);
  });

  test('explicit manual bypass retries immediately while automatic forceSync remains backed off', async () => {
    const h = harness();
    h.check.mockResolvedValueOnce(reply({ diff: [serverItem(0)] }));
    h.writePool.mockImplementationOnce(async ({ fn }) => {
      await fn?.();
    });
    await h.run();
    expect(h.config().cloudSyncReconciliation?.nextRetryAt).toBeGreaterThan(
      Date.now(),
    );
    await h.run();
    expect(h.check).toHaveBeenCalledTimes(1);
    await h.service.startServerSyncFlowSilently({ forceSync: true });
    expect(h.check).toHaveBeenCalledTimes(1);
    await h.service.startServerSyncFlow({
      forceSync: true,
      bypassRetryBackoff: true,
    });
    expect(h.check).toHaveBeenCalledTimes(2);
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      unfinished: false,
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
    const removePoolItems = jest
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
    expect(removePoolItems).toHaveBeenCalledWith({
      keys: ['wallet-delete-0'],
      expectedItems: [
        expect.objectContaining({ id: 'wallet-delete-0', isDeleted: true }),
      ],
    });
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

  test('a downloaded future format remains in the summary without downloading its payload again', async () => {
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
    expect(h.check).toHaveBeenCalledTimes(requests + 1);
    expect(h.writePool).toHaveBeenCalledTimes(1);
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

  test('a timer replays local pending issues without a new network check', async () => {
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
    await h.service.resumeCloudSyncReconciliation({ reason: 'timer' });
    expect(h.replay).toHaveBeenCalledTimes(1);
    expect(h.check).not.toHaveBeenCalled();
    expect(h.config().cloudSyncReconciliation).toMatchObject({
      status: 'complete',
      unfinished: false,
      requests: 4,
    });
  });

  test.each(['wallet-ready', 'foreground'] as const)(
    'replays downloaded accounts on %s while offline and status is complete',
    async (reason) => {
      const h = harness();
      await h.run();
      h.check.mockClear();
      const server = serverItem(1);
      const downloaded: IDBCloudSyncItem = {
        id: server.key,
        data: server.data,
        dataTime: server.dataTimestamp,
        dataType: server.dataType,
        pwdHash: server.pwdHash,
        isDeleted: false,
        rawKey: '',
        rawData: '',
        localSceneUpdated: false,
        serverUploaded: true,
      };
      h.pool.set(downloaded.id, downloaded);
      h.pool.set('other-space', {
        ...downloaded,
        id: 'other-space',
        pwdHash: 'different-space',
      });
      await h.service.setCloudSyncNetworkReachable(false);

      await h.service.resumeCloudSyncReconciliation({ reason });

      expect(h.scene).toHaveBeenCalledWith(
        expect.objectContaining({ items: [downloaded] }),
      );
      expect(h.check).not.toHaveBeenCalled();
    },
  );

  test.each(['foreground', 'network', 'manual'] as const)(
    'pending push after completion is replayed on %s when dependencies recover',
    async (reason) => {
      const h = harness();
      await h.run();
      expect(h.config().cloudSyncReconciliation?.status).toBe('complete');
      const requests = h.check.mock.calls.length;
      const counts = {
        needsUpdate: 0,
        pending: 1,
        conflicts: 0,
        rejected: 0,
        added: 0,
        unchanged: 0,
      };
      jest
        .mocked(simpleDb.cloudSyncAccountIssues.updateIssues)
        .mockResolvedValue(counts);
      const credential = await h.service.getSyncCredentialSafe();
      if (!credential) throw new OneKeyLocalError('Missing test credential');
      // Exercise the production publisher, not the harness's isolated mock.
      await ServicePrimeCloudSync.prototype.publishPublicAccountSnapshotStatus.call(
        h.service,
        { syncCredential: credential, updates: [], counts },
      );
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        status: 'partial',
        unfinished: false,
      });
      h.replay.mockClear();
      h.replay.mockImplementationOnce(async () => {
        expect(h.sourceMutex.isLocked()).toBe(true);
        h.patchConfig({
          publicAccountSnapshotStatus: { ...counts, pending: 0, added: 1 },
        });
      });
      await h.service.resumeCloudSyncReconciliation({ reason });
      expect(h.replay).toHaveBeenCalledTimes(2);
      expect(h.check).toHaveBeenCalledTimes(requests + 1);
      expect(h.config().cloudSyncReconciliation?.status).toBe('complete');
    },
  );

  test.each([
    { spaceId: 'other-space', status: 'complete' as const, unfinished: false },
    {
      spaceId: 'public-root-space',
      status: 'blocked' as const,
      unfinished: true,
    },
  ])(
    'pending publication preserves unrelated or unfinished state %o',
    async (state) => {
      const h = harness();
      await h.run();
      const completed = h.config().cloudSyncReconciliation;
      if (!completed) throw new OneKeyLocalError('Missing test reconciliation');
      const existing = { ...completed, ...state };
      h.patchConfig({ cloudSyncReconciliation: existing });
      const counts = {
        needsUpdate: 0,
        pending: 1,
        conflicts: 0,
        rejected: 0,
        added: 0,
        unchanged: 0,
      };
      jest
        .mocked(simpleDb.cloudSyncAccountIssues.updateIssues)
        .mockResolvedValue(counts);
      const credential = await h.service.getSyncCredentialSafe();
      if (!credential) throw new OneKeyLocalError('Missing test credential');
      await ServicePrimeCloudSync.prototype.publishPublicAccountSnapshotStatus.call(
        h.service,
        { syncCredential: credential, updates: [], counts },
      );
      expect(h.config().cloudSyncReconciliation).toEqual(existing);
    },
  );

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

  test.each([
    'generation',
    'space',
    'failure-updater',
    'failure-updater-space',
    'after-failure-write',
    'after-failure-space',
    'unchanged',
  ])('failure retry publication is source-scoped through %s', async (phase) => {
    const h = harness();
    const schedule = jest
      .spyOn(
        h.service as unknown as {
          scheduleReconciliation: (time: number) => void;
        },
        'scheduleReconciliation',
      )
      .mockImplementation(() => undefined);
    let expected: IPrimeCloudSyncPersistAtomData | undefined;
    const switchSpace = () => {
      const baseline = h.config().cloudSyncReconciliation;
      if (!baseline)
        throw new OneKeyLocalError('Missing reconciliation baseline');
      h.patchConfig({
        cloudSyncReconciliation: {
          ...baseline,
          spaceId: 'new-selected-space',
          status: 'complete',
          unfinished: false,
        },
      });
      expected = cloneDeep(h.config());
    };
    jest
      .spyOn(h.service, 'fillingSyncItemsMissingDataFromRawData')
      .mockImplementationOnce(async () => {
        expected = cloneDeep(h.config());
        if (phase === 'generation') h.changeSource();
        if (phase === 'space') switchSpace();
        if (
          [
            'failure-updater',
            'failure-updater-space',
            'after-failure-write',
            'after-failure-space',
          ].includes(phase)
        ) {
          const persist = h.setConfig.getMockImplementation();
          if (!persist) throw new OneKeyLocalError('Missing atom setter');
          h.setConfig.mockImplementationOnce(async (update) => {
            if (
              phase === 'failure-updater' ||
              phase === 'failure-updater-space'
            ) {
              if (phase === 'failure-updater') h.changeSource();
              switchSpace();
            }
            await persist(update);
            if (
              phase === 'after-failure-write' ||
              phase === 'after-failure-space'
            ) {
              if (phase === 'after-failure-write') h.changeSource();
              switchSpace();
            }
          });
        }
        throw new OneKeyLocalError('Injected local processing failure');
      });
    await expect(h.run()).rejects.toThrow('Injected local processing failure');
    if (phase === 'unchanged') {
      expect(h.config().cloudSyncReconciliation).toMatchObject({
        spaceId: 'public-root-space',
        status: 'blocked',
        reason: 'local-processing',
        failures: 1,
      });
      expect(schedule).toHaveBeenCalledTimes(1);
    } else {
      expect(h.config()).toEqual(expected);
      expect(schedule).not.toHaveBeenCalled();
    }
  });

  test.each(['generation', 'space'])(
    'a completed old run cannot publish over a %s change during the result updater',
    async (phase) => {
      const h = harness();
      let expected: IPrimeCloudSyncPersistAtomData | undefined;
      h.replay.mockImplementationOnce(async () => {
        const persist = h.setConfig.getMockImplementation();
        if (!persist) throw new OneKeyLocalError('Missing atom setter');
        h.setConfig.mockImplementationOnce(async (update) => {
          if (phase === 'generation') h.changeSource();
          const baseline = h.config().cloudSyncReconciliation;
          if (!baseline)
            throw new OneKeyLocalError('Missing reconciliation baseline');
          h.patchConfig({
            cloudSyncReconciliation: {
              ...baseline,
              spaceId:
                phase === 'space' ? 'new-selected-space' : baseline.spaceId,
              status: 'waiting',
              nextRetryAt: 123,
              unfinished: true,
            },
          });
          expected = cloneDeep(h.config());
          await persist(update);
        });
      });
      await h.run();
      expect(h.config()).toEqual(expected);
      expect(h.updateLastSyncTime).not.toHaveBeenCalled();
    },
  );
});
