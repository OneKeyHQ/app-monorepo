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

import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EAppRestartMode } from '@onekeyhq/shared/src/modules3rdParty/appRestart/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import secureStorage from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import localDb from '../dbs/local/localDb';

import ServiceApp from './ServiceApp';
import { LocalBackupPasswordCache } from './ServiceCloudBackupV2/localBackupPasswordCache';
import ServiceCloudBackupV2 from './ServiceCloudBackupV2/ServiceCloudBackupV2';
import { biologyAuthUtils } from './ServicePassword/biologyAuthUtils';

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
          serviceCloudBackupV2: {
            finishLocalRecoveryReset: jest.fn(),
            prepareLocalRecoveryForReset: jest
              .fn()
              .mockRejectedValue(new Error('unavailable')),
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

  test.each(['recovery', 'wallet', 'early', 'restart'])(
    'releases recovery lifecycle after a %s failure, following wallet cleanup when reached',
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
      jest.spyOn(timerUtils, 'wait').mockImplementation(async () => {
        if (stage === 'early') throw new OneKeyLocalError('interrupted');
      });
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(service.resetApp()).rejects.toThrow();
      expect(finish).toHaveBeenCalledTimes(1);
      expect(order.at(-1)).toBe('release');
      expect(resetData).toHaveBeenCalledTimes(stage === 'early' ? 0 : 1);
      expect(restart).toHaveBeenCalledTimes(stage === 'restart' ? 1 : 0);
    },
  );

  test('serializes overlapping resets so one failure cannot reopen another reset lifecycle', async () => {
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
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(finish).toHaveBeenCalledTimes(2);
    expect(finish.mock.invocationCallOrder[0]).toBeLessThan(
      prepare.mock.invocationCallOrder[1],
    );
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

    await (
      service as unknown as {
        resetNativeLocalSecretEnvelopeKeys: () => Promise<void>;
      }
    ).resetNativeLocalSecretEnvelopeKeys();

    expect(mockRemoveSecureItem).toHaveBeenCalledTimes(1);
    expect(mockClearLocalSecretEnvelopeCapabilityCache).toHaveBeenCalledTimes(
      1,
    );
  });

  test('continues the last-resort reset when identity cleanup fails', async () => {
    const prepareIdentityAuthForAppReset = jest
      .fn()
      .mockRejectedValue(new Error('identity recovery failed'));
    const service = new ServiceApp({
      backgroundApi: {
        serviceCloudBackupV2: {
          prepareLocalRecoveryForReset: jest.fn(),
          finishLocalRecoveryReset: jest.fn(),
        },
        serviceIdentityExit: {
          prepareIdentityAuthForAppReset,
        },
        serviceNotification: {
          unregisterClient: jest.fn().mockResolvedValue(undefined),
        },
      },
    });
    const resetData = jest
      .spyOn(
        service as unknown as {
          resetData: () => Promise<void>;
        },
        'resetData',
      )
      .mockResolvedValue(undefined);
    const restartApp = jest
      .spyOn(service, 'restartApp')
      .mockResolvedValue(undefined);
    const startResetting = jest.spyOn(resetUtils, 'startResetting');
    const endResetting = jest.spyOn(resetUtils, 'endResetting');
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await service.resetApp();

    expect(prepareIdentityAuthForAppReset).toHaveBeenCalledTimes(1);
    expect(startResetting).toHaveBeenCalledTimes(1);
    expect(resetData).toHaveBeenCalledTimes(1);
    expect(endResetting).toHaveBeenCalledTimes(1);
    expect(restartApp).toHaveBeenCalledWith({
      mode: EAppRestartMode.All,
      reason: 'auth.resetData',
    });
  });

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
    const endResetting = jest.spyOn(resetUtils, 'endResetting');
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await expect(service.resetApp()).rejects.toThrow('jotai reset failed');

    expect(endResetting).toHaveBeenCalledTimes(1);
    expect(restartApp).not.toHaveBeenCalled();
  });

  test('cleans security-critical storage before rejecting a native AppStorage clear failure', async () => {
    platformEnv.isNative = true;
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
    const clearError = new Error('AppStorage recovery failed');
    const clear = jest.spyOn(appStorage, 'clear').mockRejectedValue(clearError);
    const clearSyncStorage = jest
      .spyOn(appStorage.syncStorage, 'clearAll')
      .mockResolvedValue(undefined);
    const deletePassword = jest
      .spyOn(biologyAuthUtils, 'deletePassword')
      .mockResolvedValue(undefined);
    const resetLocalDb = jest.spyOn(localDb, 'reset');
    const restartApp = jest
      .spyOn(service, 'restartApp')
      .mockResolvedValue(undefined);
    const endResetting = jest.spyOn(resetUtils, 'endResetting');
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.resetApp()).rejects.toBe(clearError);
    expect(resetUtils.getIsResetting()).toBe(false);
    await expect(service.resetApp()).rejects.toBe(clearError);

    expect(clear).toHaveBeenCalledTimes(2);
    expect(endResetting).toHaveBeenCalledTimes(2);
    expect(resetUtils.getIsResetting()).toBe(false);
    expect(clearSyncStorage).toHaveBeenCalledTimes(2);
    expect(deletePassword).toHaveBeenCalledTimes(2);
    expect(
      mockDeleteMmkvProfileKeyForLocalSecretEnvelope,
    ).toHaveBeenCalledTimes(2);
    expect(resetLocalDb).toHaveBeenCalledTimes(2);
    expect(restartApp).not.toHaveBeenCalled();
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
