/* eslint-disable @typescript-eslint/unbound-method -- Jest spies do not use this binding. */
/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    reset: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../dbs/local/localSecretEnvelope', () => ({
  DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF: 'onekey_lse_secure_storage_v1',
  deleteMmkvProfileKeyForLocalSecretEnvelope: jest.fn(),
  localSecretEnvelopeService: {
    clearCapabilityCache: jest.fn(),
  },
}));

jest.mock('../states/jotai/jotaiStorage', () => ({
  clearNativeJotaiStorageForReset: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../migrations/v4ToV5Migration/v4appStorage', () => ({
  v4appStorage: {
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage',
  () => ({
    resetIntercomVisitorStorage: jest.fn(async () => {}),
  }),
);

jest.mock('@onekeyhq/shared/src/storage/instance/syncStorageInstance', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance')
  >('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
  return {
    ...actual,
    coldStartCacheStorage: {
      clearAll: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock(
  '@onekeyhq/shared/src/storage/instance/secureStorageInstance',
  () => ({
    __esModule: true,
    default: {
      removeSecureItem: jest.fn(),
      getSecureItem: jest.fn(),
      setSecureItem: jest.fn(),
      isPersistenceAvailable: jest.fn(),
    },
  }),
);

jest.mock('@onekeyhq/shared/src/storage/SnapshotCache', () => ({
  clearAllSnapshotCaches: jest.fn().mockResolvedValue(undefined),
}));

const mockResetRevoke = jest
  .fn<Promise<string>, [AbortSignal, { simulateTimeout?: boolean }?]>()
  .mockResolvedValue('skipped');
const mockResetAuthErase = jest
  .fn<Promise<void>, []>()
  .mockResolvedValue(undefined);

jest.mock('./recoveryTestFaults', () => ({
  takeRecoveryTestFault: jest.fn().mockResolvedValue(false),
}));

jest.mock('./ServicePrime/primeAuthSessionAccess', () => ({
  beginSupabaseAuthAppReset: () => ({
    revoke: mockResetRevoke,
    erase: mockResetAuthErase,
  }),
}));

import {
  IDBFactory,
  IDBRequest,
  IDBDatabase,
  IDBObjectStore,
  IDBTransaction,
  IDBIndex,
  IDBCursor,
} from 'fake-indexeddb';

import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppRestartMode } from '@onekeyhq/shared/src/modules3rdParty/appRestart/types';
import { resetIntercomVisitorStorage } from '@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import secureStorage from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import { clearAllSnapshotCaches } from '@onekeyhq/shared/src/storage/SnapshotCache';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import localDb from '../dbs/local/localDb';

import {
  readAppResetMarker,
  readAppResetPrivacyCleanup,
} from './appResetState';
import { takeRecoveryTestFault } from './recoveryTestFaults';
import ServiceApp from './ServiceApp';
import { LocalBackupPasswordCache } from './ServiceCloudBackupV2/localBackupPasswordCache';
import { RecoveryCacheErasureError } from './ServiceCloudBackupV2/RecoveryCacheErasureError';
import ServiceCloudBackupV2 from './ServiceCloudBackupV2/ServiceCloudBackupV2';
import { resetIdentityRecoveryStateForTest } from './ServiceIdentityExit/identityLifecycleMutex';
import { biologyAuthUtils } from './ServicePassword/biologyAuthUtils';

afterEach(() => {
  resetUtils.endResetting();
  resetIdentityRecoveryStateForTest('ready');
  jest.useRealTimers();
  mockResetRevoke.mockReset().mockResolvedValue('skipped');
  mockResetAuthErase.mockReset().mockResolvedValue(undefined);
  jest.mocked(takeRecoveryTestFault).mockReset().mockResolvedValue(false);
});

const mockedLocalSecretEnvelopeModule = jest.requireMock(
  '../dbs/local/localSecretEnvelope',
) as {
  deleteMmkvProfileKeyForLocalSecretEnvelope: jest.MockedFunction<
    () => Promise<void>
  >;
  localSecretEnvelopeService: {
    clearCapabilityCache: jest.MockedFunction<() => void>;
  };
};
const mockDeleteMmkvProfileKeyForLocalSecretEnvelope =
  mockedLocalSecretEnvelopeModule.deleteMmkvProfileKeyForLocalSecretEnvelope;
const mockClearLocalSecretEnvelopeCapabilityCache =
  mockedLocalSecretEnvelopeModule.localSecretEnvelopeService
    .clearCapabilityCache;
const mockRemoveSecureItem = (
  jest.requireMock(
    '@onekeyhq/shared/src/storage/instance/secureStorageInstance',
  ) as {
    default: {
      removeSecureItem: jest.MockedFunction<(key: string) => Promise<void>>;
    };
  }
).default.removeSecureItem;

describe('ServiceApp.resetApp', () => {
  const originalIsNative = platformEnv.isNative;

  beforeEach(() => {
    platformEnv.isNative = originalIsNative;
    jest.clearAllMocks();
  });

  afterEach(() => {
    platformEnv.isNative = originalIsNative;
    jest.restoreAllMocks();
  });

  test.each([undefined, false, true])(
    'passes explicit recovery policy %s before wallet cleanup',
    async (preserveBackupRecovery) => {
      const originalIOS = platformEnv.isNativeIOS;
      platformEnv.isNativeIOS = true;
      try {
        const prepareLocalRecoveryForReset = jest
          .fn()
          .mockResolvedValue(undefined);
        const service = new ServiceApp({
          backgroundApi: {
            serviceLiveActivity: { stopForPrivacyTransition: jest.fn() },
            serviceCloudBackupV2: {
              prepareLocalRecoveryForReset,
              finishLocalRecoveryReset: jest.fn(),
            },
            serviceIdentityExit: { prepareIdentityAuthForAppReset: jest.fn() },
            serviceNotification: { unregisterClient: jest.fn() },
          },
        });
        const resetData = jest
          .spyOn(
            service as unknown as { resetData: () => Promise<void> },
            'resetData',
          )
          .mockResolvedValue(undefined);
        jest.spyOn(service, 'restartApp').mockResolvedValue(undefined);
        jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
        await service.resetApp({ preserveBackupRecovery });
        expect(prepareLocalRecoveryForReset).toHaveBeenCalledWith({
          preserve: preserveBackupRecovery ?? false,
        });
        expect(
          prepareLocalRecoveryForReset.mock.invocationCallOrder[0],
        ).toBeLessThan(resetData.mock.invocationCallOrder[0]);
      } finally {
        platformEnv.isNativeIOS = originalIOS;
      }
    },
  );

  test('still wipes wallet data but reports a failed recovery erasure and does not restart', async () => {
    const originalIOS = platformEnv.isNativeIOS;
    platformEnv.isNativeIOS = true;
    try {
      const service = new ServiceApp({
        backgroundApi: {
          serviceLiveActivity: { stopForPrivacyTransition: jest.fn() },
          serviceCloudBackupV2: {
            finishLocalRecoveryReset: jest.fn(),
            prepareLocalRecoveryForReset: jest
              .fn()
              .mockRejectedValue(new RecoveryCacheErasureError()),
          },
          serviceIdentityExit: { prepareIdentityAuthForAppReset: jest.fn() },
          serviceNotification: { unregisterClient: jest.fn() },
        },
      });
      const resetData = jest
        .spyOn(
          service as unknown as { resetData: () => Promise<void> },
          'resetData',
        )
        .mockResolvedValue(undefined);
      const restart = jest
        .spyOn(service, 'restartApp')
        .mockResolvedValue(undefined);
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(service.resetApp()).rejects.toThrow(
        'Recovery cache erasure failed',
      );
      expect(resetData).toHaveBeenCalled();
      expect(restart).not.toHaveBeenCalled();
    } finally {
      platformEnv.isNativeIOS = originalIOS;
    }
  });

  test('still wipes wallet data when Live Activity cleanup fails', async () => {
    const originalIOS = platformEnv.isNativeIOS;
    platformEnv.isNativeIOS = true;
    try {
      const stop = jest.fn().mockRejectedValue(new Error('unavailable'));
      const service = new ServiceApp({
        backgroundApi: {
          serviceLiveActivity: { stopForPrivacyTransition: stop },
          serviceCloudBackupV2: {
            finishLocalRecoveryReset: jest.fn(),
            prepareLocalRecoveryForReset: jest.fn(),
          },
          serviceIdentityExit: { prepareIdentityAuthForAppReset: jest.fn() },
          serviceNotification: { unregisterClient: jest.fn() },
        },
      });
      const resetData = jest
        .spyOn(
          service as unknown as { resetData: () => Promise<void> },
          'resetData',
        )
        .mockResolvedValue(undefined);
      const restart = jest
        .spyOn(service, 'restartApp')
        .mockResolvedValue(undefined);
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(service.resetApp()).rejects.toThrow(
        'Live Activity cleanup failed',
      );
      expect(stop.mock.invocationCallOrder[0]).toBeLessThan(
        resetData.mock.invocationCallOrder[0],
      );
      expect(restart).toHaveBeenCalledWith({
        mode: EAppRestartMode.All,
        reason: 'auth.resetData',
      });
      expect(resetData.mock.invocationCallOrder[0]).toBeLessThan(
        restart.mock.invocationCallOrder[0],
      );
    } finally {
      platformEnv.isNativeIOS = originalIOS;
    }
  });

  test('still wipes wallet data when Live Activity cleanup never completes', async () => {
    const originalIOS = platformEnv.isNativeIOS;
    platformEnv.isNativeIOS = true;
    jest.useFakeTimers();
    try {
      const stop = jest.fn(() => new Promise<void>(() => {}));
      const service = new ServiceApp({
        backgroundApi: {
          serviceLiveActivity: { stopForPrivacyTransition: stop },
          serviceCloudBackupV2: {
            finishLocalRecoveryReset: jest.fn(),
            prepareLocalRecoveryForReset: jest.fn(),
          },
          serviceIdentityExit: { prepareIdentityAuthForAppReset: jest.fn() },
          serviceNotification: { unregisterClient: jest.fn() },
        },
      });
      const resetData = jest
        .spyOn(
          service as unknown as { resetData: () => Promise<void> },
          'resetData',
        )
        .mockResolvedValue(undefined);
      const restart = jest
        .spyOn(service, 'restartApp')
        .mockResolvedValue(undefined);
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      const reset = service.resetApp();
      const resetResult = reset.then(
        () => undefined,
        (error: unknown) => error,
      );
      await jest.advanceTimersByTimeAsync(2999);
      expect(stop).toHaveBeenCalledTimes(1);
      expect(resetData).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await expect(resetResult).resolves.toEqual(
        expect.objectContaining({ message: 'Live Activity cleanup failed' }),
      );
      expect(resetData).toHaveBeenCalledTimes(1);
      expect(restart).toHaveBeenCalledWith({
        mode: EAppRestartMode.All,
        reason: 'auth.resetData',
      });
      expect(resetData.mock.invocationCallOrder[0]).toBeLessThan(
        restart.mock.invocationCallOrder[0],
      );
    } finally {
      jest.useRealTimers();
      platformEnv.isNativeIOS = originalIOS;
    }
  });

  test.each(['recovery', 'wallet', 'restart'])(
    'keeps the reset barrier closed after a %s failure',
    async (stage) => {
      const order: string[] = [];
      const prepare = jest.fn(async () => {
        order.push('prepare');
        if (stage === 'recovery') throw new OneKeyLocalError('unavailable');
      });
      const finish = jest.fn(async () => {
        order.push('release');
      });
      const service = new ServiceApp({
        backgroundApi: {
          serviceCloudBackupV2: {
            prepareLocalRecoveryForReset: prepare,
            finishLocalRecoveryReset: finish,
          },
          serviceIdentityExit: { prepareIdentityAuthForAppReset: jest.fn() },
          serviceNotification: { unregisterClient: jest.fn() },
        },
      });
      const resetData = jest
        .spyOn(
          service as unknown as { resetData: () => Promise<void> },
          'resetData',
        )
        .mockImplementation(async () => {
          order.push('wallet-wipe');
          if (stage === 'wallet')
            throw new OneKeyLocalError('wallet unavailable');
        });
      const restart = jest
        .spyOn(service, 'restartApp')
        .mockImplementation(async () => {
          order.push('restart');
          if (stage === 'restart') throw new OneKeyLocalError('restart failed');
        });
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(service.resetApp()).rejects.toThrow();
      expect(finish).not.toHaveBeenCalled();
      expect(resetUtils.getIsResetting()).toBe(true);
      expect(resetData).toHaveBeenCalledTimes(stage === 'recovery' ? 0 : 1);
      expect(restart).toHaveBeenCalledTimes(stage === 'restart' ? 1 : 0);
    },
  );

  test('coalesces overlapping resets and keeps a failed lifecycle isolated', async () => {
    let release: (() => void) | undefined;
    let announce: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      announce = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prepare = jest.fn();
    const finish = jest.fn();
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: {
          prepareLocalRecoveryForReset: prepare,
          finishLocalRecoveryReset: finish,
        },
        serviceIdentityExit: { prepareIdentityAuthForAppReset: jest.fn() },
        serviceNotification: { unregisterClient: jest.fn() },
      },
    });
    jest
      .spyOn(
        service as unknown as { resetData: () => Promise<void> },
        'resetData',
      )
      .mockImplementation(async () => {
        announce?.();
        await pending;
        throw new OneKeyLocalError('wipe failed');
      });
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const first = service.resetApp();
    await started;
    const second = service.resetApp();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(finish).not.toHaveBeenCalled();
    const results = Promise.allSettled([first, second]);
    release?.();
    expect((await results).map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(finish).not.toHaveBeenCalled();
    expect(resetUtils.getIsResetting()).toBe(true);
  });

  test('waits for real cloud-service import barrier before ServiceApp wipes wallets', async () => {
    const order: string[] = [];
    let announce: (() => void) | undefined;
    let release: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      announce = resolve;
    });
    const writing = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transfer = {
      isImportTaskActive: jest.fn(async () => true),
      getSelectedTransferData: jest.fn(async () => ({
        wallets: [],
        importedAccounts: [],
        watchingAccounts: [],
      })),
      initImportProgress: jest.fn(),
      resetImportProgress: jest.fn(),
      completeImportProgress: jest.fn(),
      startImport: jest.fn(async () => {
        announce?.();
        await writing;
        order.push('last-wallet-write');
        return { success: true, taskUUID: 'synthetic-task', errorsInfo: [] };
      }),
    };
    jest
      .spyOn(ServiceCloudBackupV2.prototype, 'init')
      .mockResolvedValue(undefined);
    const cloud = new ServiceCloudBackupV2({
      backgroundApi: { servicePrimeTransfer: transfer },
    });
    jest.spyOn(cloud, 'restorePreparePrivateData').mockResolvedValue({
      credentials: {},
      decryptedCredentials: {},
      importedAccounts: {},
      watchingAccounts: {},
      wallets: {},
    });
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: cloud,
        serviceIdentityExit: { prepareIdentityAuthForAppReset: jest.fn() },
        serviceNotification: { unregisterClient: jest.fn() },
      },
    });
    const resetData = jest
      .spyOn(
        service as unknown as { resetData: () => Promise<void> },
        'resetData',
      )
      .mockImplementation(async () => {
        order.push('wallet-wipe');
      });
    jest.spyOn(service, 'restartApp').mockResolvedValue(undefined);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const restoring = cloud.restore({
      taskUUID: 'synthetic-task',
      password: 'synthetic-password',
      payload: {
        privateDataEncrypted: 'synthetic-encrypted-data',
        publicData: {
          dataTime: 1,
          totalWalletsCount: 0,
          totalAccountsCount: 0,
          walletDetails: [],
        },
        appVersion: 'test',
        isEmptyData: false,
        isWatchingOnly: true,
      },
    });
    await started;
    const resetting = service.resetApp();
    expect(resetData).not.toHaveBeenCalled();
    release?.();
    await Promise.all([restoring, resetting]);
    expect(order).toEqual(['last-wallet-write', 'wallet-wipe']);
    expect(transfer.completeImportProgress).not.toHaveBeenCalled();
  });

  test('destroys both native LSE keys during App Reset', async () => {
    platformEnv.isNative = true;
    mockDeleteMmkvProfileKeyForLocalSecretEnvelope.mockResolvedValue(undefined);
    mockRemoveSecureItem.mockResolvedValue(undefined);
    const service = new ServiceApp({ backgroundApi: {} as never });

    await (
      service as unknown as {
        resetNativeLocalSecretEnvelopeKeys: () => Promise<void>;
      }
    ).resetNativeLocalSecretEnvelopeKeys();

    expect(
      mockDeleteMmkvProfileKeyForLocalSecretEnvelope,
    ).toHaveBeenCalledTimes(1);
    expect(mockRemoveSecureItem).toHaveBeenCalledWith(
      'onekey_lse_secure_storage_v1',
    );
    expect(mockClearLocalSecretEnvelopeCapabilityCache).toHaveBeenCalledTimes(
      1,
    );
  });

  test('attempts secure-storage erasure when MMKV erasure fails', async () => {
    platformEnv.isNative = true;
    mockDeleteMmkvProfileKeyForLocalSecretEnvelope.mockRejectedValue(
      new Error('MMKV unavailable'),
    );
    mockRemoveSecureItem.mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new ServiceApp({ backgroundApi: {} as never });

    await expect(
      (
        service as unknown as {
          resetNativeLocalSecretEnvelopeKeys: () => Promise<void>;
        }
      ).resetNativeLocalSecretEnvelopeKeys(),
    ).rejects.toThrow('Native wallet encryption key erasure failed');

    expect(mockRemoveSecureItem).toHaveBeenCalledTimes(1);
    expect(mockClearLocalSecretEnvelopeCapabilityCache).toHaveBeenCalledTimes(
      1,
    );
  });

  test('finishes local reset while remote revocation and notification requests never settle', async () => {
    jest.useFakeTimers();
    mockResetRevoke.mockImplementation(() => new Promise(() => {}));
    const unregisterClient = jest.fn(() => new Promise(() => {}));
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: { prepareLocalRecoveryForReset: jest.fn() },
        serviceNotification: { unregisterClient },
      },
    });
    const resetData = jest
      .spyOn(
        service as unknown as { resetData: () => Promise<void> },
        'resetData',
      )
      .mockResolvedValue(undefined);
    const restartApp = jest
      .spyOn(service, 'restartApp')
      .mockResolvedValue(undefined);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await service.resetApp();

    expect(mockResetAuthErase).toHaveBeenCalledTimes(1);
    expect(resetData).toHaveBeenCalledTimes(1);
    expect(restartApp).toHaveBeenCalledWith({
      mode: EAppRestartMode.All,
      reason: 'auth.resetData',
    });
    const [signal] = mockResetRevoke.mock.calls[0];
    expect(unregisterClient).toHaveBeenCalledWith({ signal });
    expect(signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(signal.aborted).toBe(true);
  });

  test('shows a developer-only fault marker and continues local reset when the simulation is armed', async () => {
    jest.useFakeTimers();
    const takeFault = jest
      .mocked(takeRecoveryTestFault)
      .mockResolvedValueOnce(true);
    mockResetRevoke.mockImplementation(
      (signal, options) =>
        new Promise<string>((resolve) => {
          expect(options).toEqual({ simulateTimeout: true });
          signal.addEventListener('abort', () => resolve('skipped'), {
            once: true,
          });
        }),
    );
    const emit = jest.spyOn(appEventBus, 'emit');
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: { prepareLocalRecoveryForReset: jest.fn() },
        serviceNotification: { unregisterClient: jest.fn() },
      },
    });
    const resetData = jest
      .spyOn(
        service as unknown as { resetData: () => Promise<void> },
        'resetData',
      )
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'restartApp').mockResolvedValue(undefined);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await service.resetApp();
    expect(takeFault).toHaveBeenCalledWith('resetRemoteTimeout');
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.ShowToast,
      expect.objectContaining({
        method: 'error',
        title: '开发者模拟：远程撤销请求挂起',
      }),
    );
    expect(resetData).toHaveBeenCalledTimes(1);
    const [signal] = mockResetRevoke.mock.calls[0];
    expect(signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(signal.aborted).toBe(true);
  });

  test('stops after an unresolved local drain and joins it on retry', async () => {
    jest.useFakeTimers();
    let releaseDrain: (() => void) | undefined;
    const prepareLocalRecoveryForReset = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseDrain = resolve;
        }),
    );
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: { prepareLocalRecoveryForReset },
        serviceNotification: { unregisterClient: jest.fn() },
      },
    });
    const resetData = jest
      .spyOn(
        service as unknown as { resetData: () => Promise<void> },
        'resetData',
      )
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'restartApp').mockResolvedValue(undefined);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await Promise.all([
      expect(service.resetApp()).rejects.toThrow('drain recovery'),
      jest.advanceTimersByTimeAsync(30_000),
    ]);
    expect(resetData).not.toHaveBeenCalled();
    expect(resetUtils.getIsResetting()).toBe(true);

    const retry = service.resetApp();
    await jest.advanceTimersByTimeAsync(0);
    expect(prepareLocalRecoveryForReset).toHaveBeenCalledTimes(1);
    releaseDrain?.();
    await retry;
    expect(resetData).toHaveBeenCalledTimes(1);
  });

  test('resumes an interrupted cleanup from its durable marker before normal startup', async () => {
    const globals = {
      indexedDB: new IDBFactory(),
      IDBRequest,
      IDBDatabase,
      IDBObjectStore,
      IDBTransaction,
      IDBIndex,
      IDBCursor,
    };
    const descriptors = Object.getOwnPropertyDescriptors(globalThis);
    Object.assign(globalThis, globals);
    try {
      const prepare = jest.fn();
      const makeService = () =>
        new ServiceApp({
          backgroundApi: {
            serviceCloudBackupV2: { prepareLocalRecoveryForReset: prepare },
            serviceNotification: { unregisterClient: jest.fn() },
          },
        });
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
      const interrupted = makeService();
      jest
        .spyOn(
          interrupted as unknown as { resetData: () => Promise<void> },
          'resetData',
        )
        .mockRejectedValue(new Error('synthetic interruption'));
      await expect(
        interrupted.resetApp({ preserveBackupRecovery: true }),
      ).rejects.toThrow('synthetic interruption');
      await expect(readAppResetMarker()).resolves.toMatchObject({
        preserveBackupRecovery: true,
      });

      const cold = makeService();
      const clean = jest
        .spyOn(
          cold as unknown as { resetData: () => Promise<void> },
          'resetData',
        )
        .mockResolvedValue(undefined);
      const restart = jest
        .spyOn(cold, 'restartApp')
        .mockResolvedValue(undefined);
      await expect(cold.resumeInterruptedAppReset()).resolves.toBe(true);
      expect(prepare).toHaveBeenLastCalledWith({ preserve: true });
      expect(clean).toHaveBeenCalledTimes(1);
      expect(restart).toHaveBeenCalledTimes(1);
      expect(mockResetRevoke).toHaveBeenCalledTimes(1);
      await expect(readAppResetMarker()).resolves.toBeUndefined();
    } finally {
      for (const key of Object.keys(globals)) {
        if (descriptors[key]) {
          Object.defineProperty(globalThis, key, descriptors[key]);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      }
    }
  });

  test('clears renderer-owned IndexedDBs after Desktop reload even with a held connection', async () => {
    const globals = {
      indexedDB: new IDBFactory(),
      IDBRequest,
      IDBDatabase,
      IDBObjectStore,
      IDBTransaction,
      IDBIndex,
      IDBCursor,
    };
    const descriptors = Object.getOwnPropertyDescriptors(globalThis);
    const wasDesktop = platformEnv.isDesktop;
    Object.assign(globalThis, globals);
    platformEnv.isDesktop = true;
    const databaseName = 'desktop-held-third-party';
    const store = 'records';
    const openRequest = indexedDB.open(databaseName);
    openRequest.onupgradeneeded = () => {
      openRequest.result.createObjectStore(store).put('before-reset', 'key');
    };
    const heldConnection = await new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
    try {
      const backgroundApi = {
        serviceCloudBackupV2: { prepareLocalRecoveryForReset: jest.fn() },
        serviceNotification: { unregisterClient: jest.fn() },
      };
      const old = new ServiceApp({ backgroundApi });
      const resetData = jest
        .spyOn(
          old as unknown as { resetData: () => Promise<void> },
          'resetData',
        )
        .mockResolvedValue(undefined);
      const restart = jest
        .spyOn(old, 'restartApp')
        .mockResolvedValue(undefined);
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

      await old.resetApp();
      expect(resetData).toHaveBeenCalledTimes(1);
      expect(restart).toHaveBeenCalledTimes(1);
      await expect(readAppResetMarker()).resolves.toMatchObject({
        desktopIndexedDBCleanup: true,
      });
      expect((await indexedDB.databases()).map(({ name }) => name)).toContain(
        databaseName,
      );

      // A sibling renderer might still hold the database after reload.
      resetUtils.endResetting();
      const fresh = new ServiceApp({ backgroundApi });
      const restartFresh = jest
        .spyOn(fresh, 'restartApp')
        .mockResolvedValue(undefined);
      await expect(fresh.resumeInterruptedAppReset()).resolves.toBe(false);
      expect(restartFresh).not.toHaveBeenCalled();
      expect(
        backgroundApi.serviceCloudBackupV2.prepareLocalRecoveryForReset,
      ).toHaveBeenCalledTimes(1);
      const count = heldConnection
        .transaction(store)
        .objectStore(store)
        .count();
      await expect(
        new Promise<number>((resolve, reject) => {
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => reject(count.error);
        }),
      ).resolves.toBe(0);
      await expect(readAppResetMarker()).resolves.toBeUndefined();
    } finally {
      heldConnection.close();
      platformEnv.isDesktop = wasDesktop;
      for (const key of Object.keys(globals)) {
        if (descriptors[key]) {
          Object.defineProperty(globalThis, key, descriptors[key]);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      }
    }
  });

  test.each(['WALLET_CONNECT_V2_INDEXED_DB', 'sentry-offline', 'future-sdk'])(
    'clears %s without waiting for a held connection or blocking new opens',
    async (name) => {
      const indexedDB = new IDBFactory();
      const descriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'indexedDB',
      );
      const wasDesktop = platformEnv.isDesktop;
      const store = 'keyvaluestorage';
      const open = indexedDB.open(name);
      open.onupgradeneeded = () => {
        open.result.createObjectStore(store).put('test-session', 'session');
      };
      const held = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      Object.assign(globalThis, { indexedDB });
      platformEnv.isDesktop = false;

      try {
        const deletion = jest.spyOn(indexedDB, 'deleteDatabase');
        const log = jest.fn();
        const makeService = () =>
          new ServiceApp({ backgroundApi: {} }) as unknown as {
            clearRemainingBrowserData: (logger: typeof log) => Promise<void>;
          };
        await makeService().clearRemainingBrowserData(log);

        expect(log).toHaveBeenCalledWith(expect.any(String), 'cleared', {
          detail: name,
        });
        expect(deletion).not.toHaveBeenCalled();
        const reopened = indexedDB.open(name);
        const second = await new Promise<IDBDatabase>((resolve, reject) => {
          reopened.onsuccess = () => resolve(reopened.result);
          reopened.onerror = () => reject(reopened.error);
        });
        try {
          const count = second.transaction(store).objectStore(store).count();
          await expect(
            new Promise<number>((resolve, reject) => {
              count.onsuccess = () => resolve(count.result);
              count.onerror = () => reject(count.error);
            }),
          ).resolves.toBe(0);
        } finally {
          second.close();
        }

        const clearStore = IDBObjectStore.prototype.clear;
        const clear = jest.spyOn(IDBObjectStore.prototype, 'clear');
        clear.mockImplementationOnce(function (this: IDBObjectStore) {
          const clearRequest = clearStore.call(this);
          this.transaction.abort();
          return clearRequest;
        });
        try {
          await expect(
            makeService().clearRemainingBrowserData(log),
          ).rejects.toThrow(`${name} clear aborted`);
          expect(deletion).not.toHaveBeenCalled();
        } finally {
          clear.mockRestore();
        }
      } finally {
        held.close();
        platformEnv.isDesktop = wasDesktop;
        if (descriptor) {
          Object.defineProperty(globalThis, 'indexedDB', descriptor);
        } else {
          Reflect.deleteProperty(globalThis, 'indexedDB');
        }
      }
    },
  );

  test('does not restart after a storage reset failure', async () => {
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: {
          prepareLocalRecoveryForReset: jest.fn(),
          finishLocalRecoveryReset: jest.fn(),
        },
        serviceIdentityExit: {
          prepareIdentityAuthForAppReset: jest
            .fn()
            .mockResolvedValue(undefined),
        },
        serviceNotification: {
          unregisterClient: jest.fn().mockResolvedValue(undefined),
        },
      },
    });
    jest
      .spyOn(
        service as unknown as {
          resetData: () => Promise<void>;
        },
        'resetData',
      )
      .mockRejectedValue(new Error('jotai reset failed'));
    const restartApp = jest
      .spyOn(service, 'restartApp')
      .mockResolvedValue(undefined);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await expect(service.resetApp()).rejects.toThrow('jotai reset failed');

    expect(resetUtils.getIsResetting()).toBe(true);
    expect(restartApp).not.toHaveBeenCalled();
  });

  test('continues wallet erasure when support Keychain cleanup fails', async () => {
    platformEnv.isNative = true;
    const service = new ServiceApp({
      backgroundApi: {
        serviceLogger: { stopPersistenceForReset: jest.fn(async () => {}) },
        servicePrivacyChain: {
          dropAllLocalWalletData: jest.fn(async () => []),
        },
      },
    });
    jest
      .mocked(resetIntercomVisitorStorage)
      .mockRejectedValueOnce(new OneKeyLocalError('Keychain unavailable'));
    mockDeleteMmkvProfileKeyForLocalSecretEnvelope.mockResolvedValue(undefined);
    const clear = jest.spyOn(appStorage, 'clear').mockResolvedValue(undefined);
    jest.spyOn(appStorage.syncStorage, 'clearAll').mockResolvedValue(undefined);
    jest.spyOn(biologyAuthUtils, 'deletePassword').mockResolvedValue(undefined);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const resetLocalDb = jest.spyOn(localDb, 'reset');

    await expect(
      (service as unknown as { resetData: () => Promise<void> }).resetData(),
    ).resolves.toBeUndefined();
    expect(resetIntercomVisitorStorage).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(resetIntercomVisitorStorage).mock.invocationCallOrder[0],
    ).toBeLessThan(clear.mock.invocationCallOrder[0]);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(resetLocalDb).toHaveBeenCalledTimes(1);
  });

  test.each(['appStorage', 'biometricStorage'] as const)(
    'continues later cleanup and skips the deleted Realm on retry after %s fails',
    async (stage) => {
      platformEnv.isNative = true;
      let walletDatabaseDeleted = false;
      const resetLocalDb = jest
        .spyOn(localDb, 'reset')
        .mockImplementation(async () => {
          walletDatabaseDeleted = true;
        });
      const eraseKeylessStorageForAppReset = jest.fn(async () => {
        if (walletDatabaseDeleted) {
          throw new OneKeyLocalError('Realm is closed');
        }
      });
      const checkIfV4DbExist = jest.fn().mockResolvedValue(false);
      const stopPersistenceForReset = jest.fn().mockResolvedValue(undefined);
      const service = new ServiceApp({
        backgroundApi: {
          serviceCloudBackupV2: { prepareLocalRecoveryForReset: jest.fn() },
          servicePrivacyChain: {
            dropAllLocalWalletData: jest.fn().mockResolvedValue([]),
          },
          serviceKeylessWallet: { eraseKeylessStorageForAppReset },
          serviceV4Migration: { checkIfV4DbExist },
          serviceLogger: { stopPersistenceForReset },
          serviceNotification: { unregisterClient: jest.fn() },
        },
      });
      mockDeleteMmkvProfileKeyForLocalSecretEnvelope.mockResolvedValue(
        undefined,
      );
      const clear = jest
        .spyOn(appStorage, 'clear')
        .mockResolvedValue(undefined);
      const clearSyncStorage = jest
        .spyOn(appStorage.syncStorage, 'clearAll')
        .mockResolvedValue(undefined);
      const deletePassword = jest
        .spyOn(biologyAuthUtils, 'deletePassword')
        .mockResolvedValue(undefined);
      const failingCleanup = stage === 'appStorage' ? clear : deletePassword;
      failingCleanup.mockRejectedValueOnce(new Error('Storage unavailable'));
      const restartApp = jest
        .spyOn(service, 'restartApp')
        .mockResolvedValue(undefined);

      await expect(service.resetApp()).rejects.toThrow(stage);
      expect(resetUtils.getIsResetting()).toBe(true);
      expect(checkIfV4DbExist).toHaveBeenCalledTimes(1);
      expect(resetLocalDb).toHaveBeenCalledTimes(1);
      expect(restartApp).not.toHaveBeenCalled();

      await expect(service.resetApp()).resolves.toBeUndefined();

      expect(failingCleanup).toHaveBeenCalledTimes(2);
      expect(eraseKeylessStorageForAppReset).toHaveBeenCalledTimes(1);
      expect(checkIfV4DbExist).toHaveBeenCalledTimes(1);
      expect(clearSyncStorage).toHaveBeenCalledTimes(1);
      expect(
        mockDeleteMmkvProfileKeyForLocalSecretEnvelope,
      ).toHaveBeenCalledTimes(1);
      expect(resetLocalDb).toHaveBeenCalledTimes(1);
      expect(stopPersistenceForReset).toHaveBeenCalledTimes(1);
      expect(restartApp).toHaveBeenCalledTimes(1);
    },
  );

  test('continues independent cleanup and preserves the wallet list if Keyless erasure fails', async () => {
    platformEnv.isNative = true;
    const eraseKeylessStorageForAppReset = jest
      .fn()
      .mockRejectedValueOnce(new Error('Secure storage unavailable'))
      .mockResolvedValue(undefined);
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: { prepareLocalRecoveryForReset: jest.fn() },
        servicePrivacyChain: {
          dropAllLocalWalletData: jest.fn().mockResolvedValue([]),
        },
        serviceKeylessWallet: { eraseKeylessStorageForAppReset },
        serviceLogger: {
          stopPersistenceForReset: jest.fn().mockResolvedValue(undefined),
        },
        serviceNotification: { unregisterClient: jest.fn() },
      },
    });
    mockDeleteMmkvProfileKeyForLocalSecretEnvelope.mockResolvedValue(undefined);
    jest.spyOn(appStorage, 'clear').mockResolvedValue(undefined);
    jest.spyOn(appStorage.syncStorage, 'clearAll').mockResolvedValue(undefined);
    const deletePassword = jest
      .spyOn(biologyAuthUtils, 'deletePassword')
      .mockResolvedValue(undefined);
    const restartApp = jest
      .spyOn(service, 'restartApp')
      .mockResolvedValue(undefined);

    await expect(service.resetApp()).rejects.toThrow('keylessStorage');
    expect(deletePassword).toHaveBeenCalledTimes(1);
    expect(localDb.reset).not.toHaveBeenCalled();
    expect(clearAllSnapshotCaches).toHaveBeenCalledTimes(1);
    expect(restartApp).not.toHaveBeenCalled();

    await expect(service.resetApp()).resolves.toBeUndefined();
    expect(eraseKeylessStorageForAppReset).toHaveBeenCalledTimes(2);
    expect(deletePassword).toHaveBeenCalledTimes(1);
    expect(localDb.reset).toHaveBeenCalledTimes(1);
    expect(clearAllSnapshotCaches).toHaveBeenCalledTimes(2);
    expect(restartApp).toHaveBeenCalledTimes(1);
  });
});

describe.each([true, false])(
  'preserved recovery failures with preserve=%s',
  (preserve) => {
    const originalNative = platformEnv.isNative;
    const originalIOS = platformEnv.isNativeIOS;
    const manifestKey = 'com.onekey.backup_v2.biometric_password.manifest';
    const erasureKey = 'com.onekey.backup_v2.biometric_password.erasure';
    const keyRef = `com.onekey.backup_v2.biometric_password.key.${'a'.repeat(64)}`;
    const validManifest = JSON.stringify({
      entries: { scope: { keyRef, ciphertext: 'synthetic-ciphertext' } },
    });
    const secure = jest.mocked(secureStorage);
    let storage: Map<string, string>;
    let cache: LocalBackupPasswordCache;
    let service: ServiceApp;
    let restart: jest.SpyInstance;
    let wipe: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      platformEnv.isNative = true;
      platformEnv.isNativeIOS = true;
      storage = new Map([
        [manifestKey, validManifest],
        [keyRef, 'synthetic-protected-key'],
      ]);
      secure.isPersistenceAvailable?.mockReturnValue(true);
      secure.getSecureItem.mockImplementation(
        async (key) => storage.get(key) ?? null,
      );
      secure.setSecureItem.mockImplementation(async (key, value) => {
        storage.set(key, value);
      });
      secure.removeSecureItem.mockImplementation(async (key) => {
        storage.delete(key);
      });
      cache = new LocalBackupPasswordCache();
      service = new ServiceApp({
        backgroundApi: {
          serviceLiveActivity: { stopForPrivacyTransition: jest.fn() },
          serviceCloudBackupV2: {
            prepareLocalRecoveryForReset: (options: { preserve: boolean }) =>
              cache.prepareForReset(options),
            finishLocalRecoveryReset: async () => {
              cache.finishReset();
            },
          },
          serviceIdentityExit: { prepareIdentityAuthForAppReset: jest.fn() },
          serviceNotification: { unregisterClient: jest.fn() },
        },
      });
      wipe = jest
        .spyOn(
          service as unknown as { resetData: () => Promise<void> },
          'resetData',
        )
        .mockResolvedValue(undefined);
      restart = jest.spyOn(service, 'restartApp').mockResolvedValue(undefined);
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
      platformEnv.isNative = originalNative;
      platformEnv.isNativeIOS = originalIOS;
      jest.restoreAllMocks();
    });

    test.each([
      'corrupt JSON',
      'invalid schema',
      'native manifest read',
      'native reads',
    ])(
      'handles %s without changing ordinary preservation into erasure',
      async (failure) => {
        if (failure === 'corrupt JSON') storage.set(manifestKey, '{broken');
        if (failure === 'invalid schema')
          storage.set(
            manifestKey,
            JSON.stringify({
              entries: {
                scope: { keyRef, ciphertext: 'still-retained' },
                bad: {},
              },
            }),
          );
        if (failure.startsWith('native'))
          secure.getSecureItem.mockImplementation(async (key) => {
            if (key === manifestKey || failure === 'native reads')
              throw new OneKeyLocalError('temporarily unavailable');
            return storage.get(key) ?? null;
          });
        const before = [...storage];
        const resetting = service.resetApp({
          preserveBackupRecovery: preserve,
        });
        if (preserve) {
          await expect(resetting).resolves.toBeUndefined();
          expect(restart).toHaveBeenCalledTimes(1);
          expect([...storage]).toEqual(before);
          expect(secure.setSecureItem).not.toHaveBeenCalled();
          expect(secure.removeSecureItem).not.toHaveBeenCalled();
        } else {
          await expect(resetting).rejects.toThrow(
            'Recovery cache erasure failed',
          );
          expect(restart).not.toHaveBeenCalled();
          expect(storage.get(erasureKey)).toBe('1');
          expect(storage.get(manifestKey)).toBe(before[0][1]);
        }
        expect(wipe).toHaveBeenCalledTimes(1);
      },
    );

    test.each([
      'marker with corrupt JSON',
      'marker with invalid schema',
      'marker with read failure',
      'tombstone with invalid schema',
      'tombstone with marker read failure',
    ])(
      'does not restart after known pending erase fails: %s',
      async (pending) => {
        if (pending.startsWith('marker')) storage.set(erasureKey, '1');
        if (pending.includes('corrupt JSON'))
          storage.set(manifestKey, '{broken');
        if (pending.includes('invalid schema'))
          storage.set(
            manifestKey,
            JSON.stringify({
              erasing: pending.startsWith('tombstone'),
              entries: { bad: {} },
            }),
          );
        if (pending === 'marker with read failure')
          secure.getSecureItem.mockImplementation(async (key) => {
            if (key === manifestKey) throw new OneKeyLocalError('read failed');
            return storage.get(key) ?? null;
          });
        if (pending === 'tombstone with marker read failure') {
          storage.set(
            manifestKey,
            JSON.stringify({ erasing: true, entries: { scope: { keyRef } } }),
          );
          secure.getSecureItem.mockImplementation(async (key) => {
            if (key === erasureKey) throw new OneKeyLocalError('read failed');
            return storage.get(key) ?? null;
          });
        }
        await expect(
          service.resetApp({ preserveBackupRecovery: preserve }),
        ).rejects.toThrow('Recovery cache erasure failed');
        expect(wipe).toHaveBeenCalledTimes(1);
        expect(restart).not.toHaveBeenCalled();
        expect(storage.get(erasureKey)).toBe('1');
        expect(storage.has(manifestKey)).toBe(true);
      },
    );

    test('does not forget erasure observed by an earlier cache read when storage later becomes unreadable', async () => {
      storage.set(erasureKey, '1');
      expect(
        await cache.get({
          providerType: ECloudBackupProviderType.iCloud,
          accountId: 'synthetic-account',
          recordId: 'synthetic-record',
        }),
      ).toBeUndefined();
      secure.getSecureItem.mockRejectedValue(
        new OneKeyLocalError('temporarily unavailable'),
      );
      await expect(
        service.resetApp({ preserveBackupRecovery: preserve }),
      ).rejects.toThrow('Recovery cache erasure failed');
      expect(wipe).toHaveBeenCalledTimes(1);
      expect(restart).not.toHaveBeenCalled();
      expect(storage.get(erasureKey)).toBe('1');
    });

    test('preserves unknown intent during a transient read failure and honors it on the next cold reset', async () => {
      storage.set(erasureKey, '1');
      const before = [...storage];
      secure.getSecureItem.mockRejectedValue(
        new OneKeyLocalError('temporarily unavailable'),
      );
      if (preserve) {
        await service.resetApp({ preserveBackupRecovery: true });
        expect(restart).toHaveBeenCalledTimes(1);
        expect([...storage]).toEqual(before);
        expect(secure.setSecureItem).not.toHaveBeenCalled();
        expect(secure.removeSecureItem).not.toHaveBeenCalled();
      } else {
        await expect(service.resetApp()).rejects.toThrow(
          'Recovery cache erasure failed',
        );
        expect(restart).not.toHaveBeenCalled();
      }
      cache = new LocalBackupPasswordCache();
      secure.getSecureItem.mockImplementation(
        async (key) => storage.get(key) ?? null,
      );
      await service.resetApp({ preserveBackupRecovery: preserve });
      expect(storage.size).toBe(0);
      expect(restart).toHaveBeenCalledTimes(preserve ? 2 : 1);
    });

    test.each(['marker', 'tombstone'])(
      'completes readable pending %s before restart',
      async (pending) => {
        if (pending === 'marker') storage.set(erasureKey, '1');
        else
          storage.set(
            manifestKey,
            JSON.stringify({ erasing: true, entries: { scope: { keyRef } } }),
          );
        await service.resetApp({ preserveBackupRecovery: preserve });
        expect(storage.size).toBe(0);
        expect(wipe).toHaveBeenCalledTimes(1);
        expect(restart).toHaveBeenCalledTimes(1);
        expect(wipe.mock.invocationCallOrder[0]).toBeLessThan(
          restart.mock.invocationCallOrder[0],
        );
      },
    );
  },
);
describe('ServiceApp privacy database reset ordering', () => {
  const globals = {
    indexedDB: new IDBFactory(),
    IDBRequest,
    IDBDatabase,
    IDBObjectStore,
    IDBTransaction,
    IDBIndex,
    IDBCursor,
  };
  const descriptors = Object.getOwnPropertyDescriptors(globalThis);

  beforeEach(() => {
    Object.assign(globalThis, { ...globals, indexedDB: new IDBFactory() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of Object.keys(globals)) {
      if (descriptors[key]) {
        Object.defineProperty(globalThis, key, descriptors[key]);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }
  });

  it.each([
    ['throws before identifying failed networks', null],
    ['identifies failed networks', ['xmr--0']],
  ])(
    'keeps the privacy cleanup marker if the sweep %s',
    async (_label, networkIds) => {
      const clear = jest
        .spyOn(appStorage, 'clear')
        .mockImplementation(async () => {
          await expect(readAppResetPrivacyCleanup()).resolves.toMatchObject({
            networkIds,
          });
        });
      jest
        .spyOn(appStorage.syncStorage, 'clearAll')
        .mockResolvedValue(undefined);
      jest
        .spyOn(biologyAuthUtils, 'deletePassword')
        .mockResolvedValue(undefined);
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const dropAllLocalWalletData = jest.fn();
      if (networkIds) {
        dropAllLocalWalletData.mockResolvedValue(networkIds);
      } else {
        dropAllLocalWalletData.mockRejectedValue(
          new Error('privacy database erase failed'),
        );
      }
      const service = new ServiceApp({
        backgroundApi: {
          serviceLogger: {
            stopPersistenceForReset: jest.fn().mockResolvedValue(undefined),
          },
          servicePrivacyChain: { dropAllLocalWalletData },
        },
      });

      resetUtils.startResetting();
      await (
        service as unknown as { resetData: () => Promise<void> }
      ).resetData();

      expect(dropAllLocalWalletData).toHaveBeenCalledTimes(1);
      expect(clear).toHaveBeenCalledTimes(1);
      await expect(readAppResetPrivacyCleanup()).resolves.toMatchObject({
        networkIds,
      });
    },
  );

  it('retains host storage if the failed wipe cannot be journaled', async () => {
    const clear = jest.spyOn(appStorage, 'clear').mockResolvedValue(undefined);
    jest.spyOn(globalThis.indexedDB, 'open').mockImplementationOnce(() => {
      throw new OneKeyLocalError('Reset control storage unavailable');
    });
    const service = new ServiceApp({
      backgroundApi: {
        serviceLogger: { stopPersistenceForReset: jest.fn() },
        servicePrivacyChain: {
          dropAllLocalWalletData: jest.fn().mockResolvedValue(['xmr--0']),
        },
      },
    });

    await expect(
      (service as unknown as { resetData: () => Promise<void> }).resetData(),
    ).rejects.toThrow('privacyChainRetry');
    expect(clear).not.toHaveBeenCalled();
  });

  it('clears workbox-expiration records and static-assets cache without blocking on a held Service Worker connection', async () => {
    const indexedDB = new IDBFactory();
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    const cachesDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'caches',
    );
    const deleteCache = jest.fn().mockResolvedValue(true);
    const keys = jest.fn().mockResolvedValue(['static-assets', 'runtime-v2']);
    const wasDesktop = platformEnv.isDesktop;
    const name = 'workbox-expiration';
    const store = 'cache-entries';
    const open = indexedDB.open(name);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(store).put({ timestamp: 1 }, 'asset-url');
    };
    const held = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    Object.assign(globalThis, {
      indexedDB,
      caches: { keys, delete: deleteCache },
    });
    platformEnv.isDesktop = false;

    try {
      const deletion = jest.spyOn(indexedDB, 'deleteDatabase');
      const log = jest.fn();
      const service = new ServiceApp({ backgroundApi: {} });
      await (
        service as unknown as {
          clearRemainingBrowserData: (logger: typeof log) => Promise<void>;
        }
      ).clearRemainingBrowserData(log);

      expect(keys).toHaveBeenCalledTimes(1);
      expect(deleteCache).toHaveBeenCalledWith('static-assets');
      expect(deleteCache).toHaveBeenCalledWith('runtime-v2');
      expect(log).toHaveBeenCalledWith(
        'workboxExpirationIndexedDB',
        'cleared',
        {
          detail: name,
        },
      );
      expect(deletion).not.toHaveBeenCalled();
      const count = held.transaction(store).objectStore(store).count();
      await expect(
        new Promise<number>((resolve, reject) => {
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => reject(count.error);
        }),
      ).resolves.toBe(0);
    } finally {
      held.close();
      platformEnv.isDesktop = wasDesktop;
      if (descriptor) {
        Object.defineProperty(globalThis, 'indexedDB', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'indexedDB');
      }
      if (cachesDescriptor) {
        Object.defineProperty(globalThis, 'caches', cachesDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'caches');
      }
    }
  });

  it('clears all Cache Storage even without a Workbox database', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    const keys = jest.fn().mockResolvedValue(['future-cache', 'another-cache']);
    const deleteCache = jest.fn().mockResolvedValue(true);
    Object.assign(globalThis, { caches: { keys, delete: deleteCache } });

    try {
      const log = jest.fn();
      const service = new ServiceApp({ backgroundApi: {} }) as unknown as {
        clearRemainingBrowserData: (logger: typeof log) => Promise<void>;
      };
      await service.clearRemainingBrowserData(log);
      expect(deleteCache.mock.calls).toEqual([
        ['future-cache'],
        ['another-cache'],
      ]);
      expect(log).toHaveBeenCalledWith('cacheStorage', 'cleared');

      deleteCache.mockReset();
      deleteCache
        .mockRejectedValueOnce(new Error('blocked'))
        .mockResolvedValueOnce(true);
      await expect(
        service.clearRemainingBrowserData(log),
      ).resolves.toBeUndefined();
      expect(deleteCache).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalledWith('cacheStorage', 'clear_failed', {
        detail: 'future-cache: blocked',
      });
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'caches', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'caches');
      }
    }
  });

  it('does not wait for a stalled cache sweep or delete after a late enumeration', async () => {
    jest.useFakeTimers();
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    let resolveNames: (names: string[]) => void = () => {};
    const keys = jest.fn(
      () =>
        new Promise<string[]>((resolve) => {
          resolveNames = resolve;
        }),
    );
    const deleteCache = jest.fn(() => new Promise<boolean>(() => {}));
    Object.assign(globalThis, { caches: { keys, delete: deleteCache } });

    try {
      const log = jest.fn();
      const service = new ServiceApp({ backgroundApi: {} }) as unknown as {
        clearBrowserCacheStorage: (logger: typeof log) => Promise<void>;
      };
      const stalledEnumeration = service.clearBrowserCacheStorage(log);
      await jest.advanceTimersByTimeAsync(1_000);
      await expect(stalledEnumeration).resolves.toBeUndefined();
      resolveNames(['new-cache']);
      await jest.advanceTimersByTimeAsync(0);
      expect(deleteCache).not.toHaveBeenCalled();

      keys.mockResolvedValueOnce(['old-cache']);
      const stalledDeletion = service.clearBrowserCacheStorage(log);
      await jest.advanceTimersByTimeAsync(1_000);
      await expect(stalledDeletion).resolves.toBeUndefined();
      expect(deleteCache).toHaveBeenCalledWith('old-cache');
      expect(log).toHaveBeenCalledWith('cacheStorage', 'timeout', {
        deadlineMs: 1_000,
      });
    } finally {
      jest.useRealTimers();
      if (descriptor) {
        Object.defineProperty(globalThis, 'caches', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'caches');
      }
    }
  });

  it('marks ServiceLogger reset failure when resetApp fails and resets flag on retry', async () => {
    const beginResetAttempt = jest.fn();
    const markResetFailed = jest.fn();
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: {
          prepareLocalRecoveryForReset: jest
            .fn()
            .mockRejectedValueOnce(new Error('storage busy'))
            .mockResolvedValueOnce(undefined),
        },
        serviceNotification: { unregisterClient: jest.fn() },
        serviceLogger: {
          beginResetAttempt,
          markResetFailed,
          stopPersistenceForReset: jest.fn().mockResolvedValue(undefined),
        },
        servicePrivacyChain: {
          dropAllLocalWalletData: jest.fn().mockResolvedValue([]),
        },
      },
    });
    jest.spyOn(service, 'restartApp').mockResolvedValue(undefined);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await expect(service.resetApp()).rejects.toThrow('storage busy');
    expect(beginResetAttempt).toHaveBeenCalledTimes(1);
    expect(markResetFailed).toHaveBeenCalledTimes(1);
  });

  it('formats multi-stage resetData failures without double-wrapping stage envelopes', async () => {
    jest.spyOn(appStorage, 'clear').mockResolvedValue(undefined);
    jest.spyOn(appStorage.syncStorage, 'clearAll').mockResolvedValue(undefined);
    jest.spyOn(biologyAuthUtils, 'deletePassword').mockResolvedValue(undefined);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const snapshotErr = new Error('Internal error.');
    snapshotErr.name = 'UnknownError';
    jest.mocked(clearAllSnapshotCaches).mockRejectedValueOnce(snapshotErr);
    jest
      .mocked(localDb.reset)
      .mockRejectedValueOnce(new Error('Database locked.'));

    const service = new ServiceApp({
      backgroundApi: {
        serviceLogger: {
          stopPersistenceForReset: jest.fn().mockResolvedValue(undefined),
        },
      },
    });

    await expect(
      (service as unknown as { resetData: () => Promise<void> }).resetData(),
    ).rejects.toThrow(
      'App reset could not complete snapshotCaches (UnknownError: Internal error), walletDatabase (Database locked). Retry Reset App.',
    );
  });

  it('formats recoveryDrain failure without double-wrapping the stage message', async () => {
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: {
          prepareLocalRecoveryForReset: jest
            .fn()
            .mockRejectedValue(new Error('backup lock busy.')),
        },
        serviceNotification: { unregisterClient: jest.fn() },
      },
    });
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.resetApp()).rejects.toThrow(
      'App reset could not drain recovery tasks: backup lock busy. Retry Reset App.',
    );
  });
});
