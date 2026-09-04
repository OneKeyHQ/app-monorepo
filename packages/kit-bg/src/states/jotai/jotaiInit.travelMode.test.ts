import { createMMKV } from 'react-native-mmkv';

import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { RuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode/runtimeProfile';

const mmkvInstance = createMMKV({ id: 'onekey-jotai-states-travel-test' });
const mockSyncNativeStorageMMKV = jest.fn(async () => undefined);
const legacyStorage = {
  getAllKeys: jest.fn(async () => [] as string[]),
  multiGet: jest.fn(async () => [] as [string, string | null][]),
  multiRemove: jest.fn(async () => undefined),
};

jest.mock(
  '@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance',
  () => ({ __esModule: true, default: mmkvInstance }),
);
jest.mock('@onekeyhq/shared/src/storage/legacyAsyncStorageMigration', () => ({
  getLegacyAsyncStorageForMigration: () => legacyStorage,
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageMigrationModule', () => ({
  NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE: 'complete-v1',
  NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING: 'migrating-v1',
  NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING: 'resetting-v1',
  getNativeStorageMigrationLedger: jest.fn(async () => null),
  setNativeStorageMigrationLedger: jest.fn(async () => undefined),
  setNativeStorageMigrationLedgerComplete: jest.fn(async () => undefined),
  syncNativeStorageMMKV: mockSyncNativeStorageMMKV,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isExtension: false,
    isExtensionUi: false,
    isNative: true,
    isNativeAndroid: true,
    isNativeBackgroundThread: true,
    isNativeIOS: false,
    isNativeMainThread: false,
    isWeb: false,
    isWebDappMode: false,
  },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  storageHub: {
    $webStorageGlobalStates: undefined,
    appStorage: {
      getItem: jest.fn(),
      removeItem: jest.fn(),
      setItem: jest.fn(),
    },
    _mockStorage: {},
  },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorageUtils', () => ({
  __esModule: true,
  default: { canSaveAsObject: () => false },
}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Error: 3, Info: 0 },
    NativeLogger: { write: jest.fn() },
  }),
);

describe('Travel Mode Jotai startup', () => {
  it('hydrates only passcode, lock controls, preferences, and currency reference data', async () => {
    const passwordKey = 'g_states_v5:passwordPersistAtom';
    const manualLockKey = 'g_states_v5:passwordPersistManualLockStateAtom';
    const settingsKey = 'g_states_v5:settingsPersistAtom';
    const currencyKey = 'g_states_v5:currencyPersistAtom';
    const businessKey = 'g_states_v5:addressBookPersistAtom';
    const persistedPasswordState = {
      appLockDuration: 15,
      enablePasswordErrorProtection: true,
      enableSystemIdleLock: false,
      isPasscodeModeFixed: true,
      isPasswordSet: true,
      passwordErrorAttempts: 2,
      passwordErrorProtectionTime: 100,
      passwordMode: 'passcode',
      webAuthCredentialId: 'private-web-auth-id',
    };
    mmkvInstance.set(passwordKey, JSON.stringify(persistedPasswordState));
    mmkvInstance.set(manualLockKey, JSON.stringify({ manualLocking: true }));
    mmkvInstance.set(
      settingsKey,
      JSON.stringify({
        currencyInfo: { id: 'eur', symbol: '€' },
        hapticFeedbackEnabled: false,
        instanceId: 'private-instance-id',
        locale: 'zh-CN',
        sensitiveEncodeKey: 'private-encode-key',
        theme: 'dark',
      }),
    );
    const currencyReferenceState = {
      currencyMap: {
        eur: { id: 'eur', name: 'Euro', type: ['fiat'], unit: '€' },
      },
    };
    mmkvInstance.set(currencyKey, JSON.stringify(currencyReferenceState));
    mmkvInstance.set(businessKey, JSON.stringify({ privateData: true }));

    const originalGetString = mmkvInstance.getString.bind(mmkvInstance);
    const originalSet = mmkvInstance.set.bind(mmkvInstance);
    const physicalReadKeys: string[] = [];
    const physicalWriteKeys: string[] = [];
    jest.spyOn(mmkvInstance, 'getString').mockImplementation((key) => {
      physicalReadKeys.push(key);
      if (
        ![passwordKey, manualLockKey, settingsKey, currencyKey].includes(key)
      ) {
        throw new OneKeyLocalError(
          `Travel Mode read a non-control Jotai key: ${key}`,
        );
      }
      return originalGetString(key);
    });
    jest.spyOn(mmkvInstance, 'set').mockImplementation((key, value) => {
      physicalWriteKeys.push(key);
      if (![passwordKey, manualLockKey, settingsKey].includes(key)) {
        throw new OneKeyLocalError(
          `Travel Mode wrote a non-control Jotai key: ${key}`,
        );
      }
      return originalSet(key, value);
    });
    const getAllKeysSpy = jest
      .spyOn(mmkvInstance, 'getAllKeys')
      .mockImplementation(() => {
        throw new OneKeyLocalError(
          'Travel Mode enumerated the business Jotai namespace',
        );
      });
    const clearAllSpy = jest
      .spyOn(mmkvInstance, 'clearAll')
      .mockImplementation(() => {
        throw new OneKeyLocalError(
          'Travel Mode cleared the business Jotai namespace',
        );
      });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { travelModeManager } =
      require('@onekeyhq/shared/src/travelMode') as typeof import('@onekeyhq/shared/src/travelMode');
    const maskedEnvironment = RuntimeEnvironment.create(
      getTravelModeRuntimeProfile(true),
    );
    jest
      .spyOn(travelModeManager, 'getRuntimeProfile')
      .mockResolvedValue(getTravelModeRuntimeProfile(true));
    jest
      .spyOn(travelModeManager, 'getRuntimeEnvironment')
      .mockResolvedValue(maskedEnvironment);
    jest
      .spyOn(travelModeManager, 'getRuntimeEnvironmentSync')
      .mockReturnValue(maskedEnvironment);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { jotaiInit } =
      require('./jotaiInit') as typeof import('./jotaiInit');
    const atoms = await jotaiInit();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      appIsLocked,
      passwordAtom,
      passwordPersistAtom,
      passwordPersistManualLockStateAtom,
    } = require('./atoms') as typeof import('./atoms');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { jotaiDefaultStore } =
      require('./utils/jotaiDefaultStore') as typeof import('./utils/jotaiDefaultStore');

    await expect(atoms.passwordPersistAtom.get()).resolves.toEqual({
      appLockDuration: 15,
      enablePasswordErrorProtection: false,
      enableSystemIdleLock: false,
      isPasscodeModeFixed: true,
      isPasswordSet: true,
      passwordErrorAttempts: 2,
      passwordErrorProtectionTime: 100,
      passwordMode: 'passcode',
      webAuthCredentialId: '',
    });
    await expect(atoms.passwordAtom.get()).resolves.toEqual(
      expect.objectContaining({ unLock: false }),
    );
    await expect(
      atoms.passwordPersistManualLockStateAtom.get(),
    ).resolves.toEqual({ manualLocking: true });
    expect(jotaiDefaultStore.get(appIsLocked.atom())).toBe(true);

    await Promise.resolve(
      jotaiDefaultStore.set(passwordPersistManualLockStateAtom.atom(), {
        manualLocking: false,
      }),
    );
    await Promise.resolve(
      jotaiDefaultStore.set(passwordPersistAtom.atom(), (value) => ({
        ...value,
        appLockDuration: Number(ELockDuration.Never),
      })),
    );
    await Promise.resolve(
      jotaiDefaultStore.set(passwordAtom.atom(), (value) => ({
        ...value,
        unLock: false,
      })),
    );
    expect(jotaiDefaultStore.get(appIsLocked.atom())).toBe(false);

    await Promise.resolve(
      jotaiDefaultStore.set(passwordPersistManualLockStateAtom.atom(), {
        manualLocking: true,
      }),
    );
    expect(jotaiDefaultStore.get(appIsLocked.atom())).toBe(true);

    await Promise.resolve(
      jotaiDefaultStore.set(passwordPersistManualLockStateAtom.atom(), {
        manualLocking: false,
      }),
    );
    await Promise.resolve(
      jotaiDefaultStore.set(passwordPersistAtom.atom(), (value) => ({
        ...value,
        appLockDuration: 15,
      })),
    );
    expect(jotaiDefaultStore.get(appIsLocked.atom())).toBe(true);

    await Promise.resolve(
      jotaiDefaultStore.set(passwordPersistManualLockStateAtom.atom(), {
        manualLocking: true,
      }),
    );
    await expect(atoms.settingsPersistAtom.get()).resolves.toEqual(
      expect.objectContaining({
        currencyInfo: { id: 'eur', symbol: '€' },
        hapticFeedbackEnabled: false,
        locale: 'zh-CN',
        theme: 'dark',
      }),
    );
    const settingsState = (await atoms.settingsPersistAtom.get()) as {
      instanceId: string;
      sensitiveEncodeKey: string;
    };
    expect(settingsState.instanceId).not.toBe('private-instance-id');
    expect(settingsState.sensitiveEncodeKey).not.toBe('private-encode-key');
    await expect(atoms.currencyPersistAtom.get()).resolves.toEqual(
      currencyReferenceState,
    );
    expect(new Set(physicalReadKeys)).toEqual(
      new Set([passwordKey, manualLockKey, settingsKey, currencyKey]),
    );
    expect(new Set(physicalWriteKeys)).toEqual(
      new Set([passwordKey, manualLockKey, settingsKey]),
    );
    expect(getAllKeysSpy).not.toHaveBeenCalled();
    expect(clearAllSpy).not.toHaveBeenCalled();
    expect(legacyStorage.multiGet).not.toHaveBeenCalled();
    expect(legacyStorage.getAllKeys).not.toHaveBeenCalled();
    expect(originalGetString(businessKey)).toBe(
      JSON.stringify({ privateData: true }),
    );
    expect(JSON.parse(originalGetString(settingsKey) ?? '')).toEqual({
      currencyInfo: { id: 'eur', symbol: '€' },
      hapticFeedbackEnabled: false,
      instanceId: 'private-instance-id',
      locale: 'zh-CN',
      sensitiveEncodeKey: 'private-encode-key',
      theme: 'dark',
    });
    expect(JSON.parse(originalGetString(passwordKey) ?? '')).toEqual(
      persistedPasswordState,
    );
    expect(JSON.parse(originalGetString(manualLockKey) ?? '')).toEqual({
      manualLocking: true,
    });
    expect(mockSyncNativeStorageMMKV).toHaveBeenCalledWith(
      'onekey-jotai-states',
    );
  });
});
