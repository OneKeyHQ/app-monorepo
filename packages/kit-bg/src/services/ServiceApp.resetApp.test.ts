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
    },
  }),
);

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EAppRestartMode } from '@onekeyhq/shared/src/modules3rdParty/appRestart/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import localDb from '../dbs/local/localDb';

import ServiceApp from './ServiceApp';
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

  describe('Binance deposit session keys', () => {
    function createResetHarness({ purgeFails }: { purgeFails: boolean }) {
      platformEnv.isNative = true;
      const order: string[] = [];
      const purge = jest.fn<Promise<void>, []>(async () => {
        order.push('purge:start');
        await Promise.resolve();
        if (purgeFails) {
          throw new OneKeyLocalError('purge failed');
        }
        order.push('purge:end');
      });
      const service = new ServiceApp({
        backgroundApi: {
          serviceIdentityExit: {
            prepareIdentityAuthForAppReset: jest
              .fn()
              .mockResolvedValue(undefined),
          },
          serviceNotification: {
            unregisterClient: jest.fn().mockResolvedValue(undefined),
          },
          serviceBinanceDeposit: { purgeAllSessionKeysForReset: purge },
        },
      });
      jest.spyOn(appStorage, 'clear').mockImplementation(() => {
        order.push('appStorage.clear');
        return Promise.resolve();
      });
      jest
        .spyOn(appStorage.syncStorage, 'clearAll')
        .mockResolvedValue(undefined);
      jest
        .spyOn(biologyAuthUtils, 'deletePassword')
        .mockResolvedValue(undefined);
      const resetLocalDb = jest.spyOn(localDb, 'reset');
      const restartApp = jest
        .spyOn(service, 'restartApp')
        .mockResolvedValue(undefined);
      jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      return { service, order, purge, resetLocalDb, restartApp };
    }

    test('are purged before the storage that indexes them is cleared', async () => {
      const harness = createResetHarness({ purgeFails: false });

      await harness.service.resetApp();

      expect(harness.purge).toHaveBeenCalledTimes(1);
      expect(harness.order).toEqual([
        'purge:start',
        'purge:end',
        'appStorage.clear',
      ]);
      expect(harness.restartApp).toHaveBeenCalledTimes(1);
    });

    test('do not stop the reset when their cleanup fails', async () => {
      const harness = createResetHarness({ purgeFails: true });

      await expect(harness.service.resetApp()).resolves.toBeUndefined();

      expect(harness.order).toEqual(['purge:start', 'appStorage.clear']);
      expect(harness.resetLocalDb).toHaveBeenCalledTimes(1);
      expect(harness.restartApp).toHaveBeenCalledTimes(1);
    });
  });
});
