/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMMKV } from 'react-native-mmkv';

import type { JotaiStorageNativeMMKV } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorageNativeMMKV.native';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { INativeStorageRequest } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

const mockMMKV = createMMKV({ id: 'jotai-rebuild-failure-test' });
const mockLegacy = new Map<string, string>();
const mockLegacyRemove = jest.fn(async (keys: string[]) => {
  keys.forEach((key) => mockLegacy.delete(key));
});
const mockSync = jest.fn<Promise<void>, []>(async () => undefined);
const mockLedgerComplete = jest.fn<Promise<void>, []>(async () => undefined);
const mockRestart = jest.fn(async (_options: unknown) => undefined);
const mockHydrate = jest.fn(async () => undefined);
let mockStorage: JotaiStorageNativeMMKV;
const mockStorageCall = jest.fn(async (request: INativeStorageRequest) => {
  if (
    request.scope === 'recovery' &&
    request.operation === 'resetMigrationTarget' &&
    request.target === 'jotai'
  ) {
    await mockStorage.resetAfterMigrationMismatch();
    return;
  }
  throw new OneKeyLocalError('Unexpected storage request');
});

jest.mock('react', () => jest.requireActual<typeof import('react')>('react'));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeBackgroundThread: true },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {},
}));
jest.mock(
  '@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement',
  () => ({ completeTravelModeRuntimeLaunchAcknowledgement: async () => true }),
);
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { bootstrap: { initDeferredStep: jest.fn() } } },
}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Info: 1, Error: 3 },
    NativeLogger: { write: jest.fn() },
  }),
);
jest.mock(
  '@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance',
  () => ({ __esModule: true, default: mockMMKV }),
);
jest.mock('@onekeyhq/shared/src/storage/instance/syncStorageInstance', () =>
  jest.requireActual<
    typeof import('@onekeyhq/shared/src/storage/instance/createMMKVSyncStorage')
  >('@onekeyhq/shared/src/storage/instance/createMMKVSyncStorage'),
);
jest.mock('@onekeyhq/shared/src/storage/legacyAsyncStorageMigration', () => ({
  getLegacyAsyncStorageForMigration: () => ({
    getAllKeys: async () => [...mockLegacy.keys()],
    multiGet: async (keys: string[]) =>
      keys.map((key) => [key, mockLegacy.get(key) ?? null]),
    multiRemove: mockLegacyRemove,
  }),
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageMigrationModule', () => ({
  NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE: 'complete-v1',
  NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING: 'migrating-v1',
  NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING: 'resetting-v1',
  getNativeStorageMigrationLedger: async () => 'complete-v1',
  setNativeStorageMigrationLedgerComplete: () => mockLedgerComplete(),
  syncNativeStorageMMKV: () => mockSync(),
}));
jest.mock('react-native', () => {
  type IProps = {
    children?: import('react').ReactNode;
    testID?: string;
    onPress?: () => void;
  };
  const View = ({ children, testID }: IProps) => (
    <div data-testid={testID}>{children}</div>
  );
  return {
    ScrollView: View,
    View,
    Text: View,
    ActivityIndicator: View,
    Pressable: ({ children, testID, onPress }: IProps) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    StyleSheet: { create: (styles: unknown) => styles },
    useColorScheme: () => 'light',
  };
});
jest.mock('@onekeyhq/kit/src/utils/swrCacheMutationInvalidation', () => ({
  registerSwrCacheMutationInvalidation: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/appRestart', () => ({
  appRestart: (options: unknown) => mockRestart(options),
  EAppRestartMode: { All: 'all' },
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageBridge', () => ({
  callNativeStorage: (request: INativeStorageRequest) =>
    mockStorageCall(request),
}));
jest.mock(
  '@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromNativeStorage',
  () => ({
    hydrateJotaiFromNativeStorage: async () => ({ hydrated: false }),
  }),
);
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { initializeJotaiFromBackground: () => mockHydrate() },
}));
jest.mock('./jotaiMainHydrationGate', () => ({
  runJotaiMainHydration: (initialize: () => Promise<void>) => initialize(),
}));
jest.mock('./bootstrapNativeStorage', () => ({
  bootstrapNativeStorage: () => mockStorage.migrateFromAsyncStorage([], ''),
  hydrateColdStartSnapshotAfterRuntimeLaunch: jest.fn(),
  waitForColdStartCriticalImagesBeforeMount: async () => undefined,
}));
jest.mock('./nativeStorageBootstrapSplash', () => ({
  hideNativeStorageBootstrapSplash: jest.fn(),
}));
jest.mock('../../App', () => ({
  __esModule: true,
  default: () => <div data-testid="business-app" />,
}));

const flush = async () => {
  await act(async () => {
    for (let index = 0; index < 25; index += 1) await Promise.resolve();
  });
};

// Execute the real bg storage reset and main recovery UI. Only the native
// persistence/bridge/restart boundaries are simulated; no wallet store is used.
describe('cold-start Jotai rebuild persistence failure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMMKV.clearAll();
    mockLegacy.clear();
    mockLegacy.set('g_states_v5:aAtom', '"retained-original"');
  });

  it.each(['sync', 'ledger'] as const)(
    'offers a retryable full restart after marker publication and %s failure',
    async (failure) => {
      let NativeStorageBootstrapRoot!: typeof import('./NativeStorageBootstrapRoot').NativeStorageBootstrapRoot;
      let StorageClass!: typeof JotaiStorageNativeMMKV;
      jest.isolateModules(() => {
        StorageClass = (
          require('@onekeyhq/kit-bg/src/states/jotai/jotaiStorageNativeMMKV.native') as typeof import('@onekeyhq/kit-bg/src/states/jotai/jotaiStorageNativeMMKV.native')
        ).JotaiStorageNativeMMKV;
        mockStorage = new StorageClass();
        NativeStorageBootstrapRoot = (
          require('./NativeStorageBootstrapRoot') as typeof import('./NativeStorageBootstrapRoot')
        ).NativeStorageBootstrapRoot;
      });
      render(<NativeStorageBootstrapRoot />);
      await flush();
      expect(screen.queryByTestId('business-app')).toBeNull();
      fireEvent.click(
        screen.getByTestId('native-storage-migration-repair-attempt'),
      );
      await flush();
      fireEvent.click(screen.getByTestId('native-storage-migration-repair'));
      let rejectPersistence: (error: Error) => void = () => {
        throw new OneKeyLocalError('Persistence did not start');
      };
      const persistence = new Promise<void>((_resolve, reject) => {
        rejectPersistence = reject;
      });
      const failingOperation =
        failure === 'sync' ? mockSync : mockLedgerComplete;
      failingOperation.mockImplementationOnce(() => persistence);
      fireEvent.click(
        screen.getByTestId('native-storage-migration-repair-confirm'),
      );
      await flush();
      expect(mockMMKV.getString('__mmkv_migration_v1__')).toBe('1');
      expect(screen.getByTestId('native-storage-repair-progress')).toBeTruthy();
      expect(screen.queryByTestId('native-storage-repair-restart')).toBeNull();
      await act(async () => {
        rejectPersistence(
          new OneKeyLocalError(`${failure} failed after marker`),
        );
      });
      await flush();
      expect(mockStorageCall).toHaveBeenCalledTimes(1);
      expect(mockStorage.isMigrationComplete()).toBe(false);
      await expect(mockStorage.resetAfterMigrationMismatch()).rejects.toThrow(
        'Jotai migration repair is no longer applicable',
      );
      expect(screen.getByText(/Storage repair failed/)).toBeTruthy();
      expect(screen.queryByTestId('business-app')).toBeNull();
      expect(screen.queryByTestId('native-storage-repair-back')).toBeNull();
      expect(
        screen.queryByTestId('native-storage-migration-repair'),
      ).toBeNull();
      expect(mockHydrate).not.toHaveBeenCalled();
      expect(mockLegacy.get('g_states_v5:aAtom')).toBe('"retained-original"');
      expect(mockLegacyRemove).not.toHaveBeenCalled();

      // Restart rejection must leave the exit available without a second reset.
      mockRestart.mockRejectedValueOnce(new OneKeyLocalError('restart failed'));
      fireEvent.click(screen.getByTestId('native-storage-repair-restart'));
      await flush();
      expect(screen.getByText(/The app could not restart/)).toBeTruthy();
      expect(screen.getByTestId('native-storage-repair-restart')).toBeTruthy();
      expect(screen.queryByTestId('business-app')).toBeNull();
      fireEvent.click(screen.getByTestId('native-storage-repair-restart'));
      await flush();
      expect(mockRestart).toHaveBeenCalledTimes(2);
      expect(mockRestart).toHaveBeenLastCalledWith({
        mode: 'all',
        reason: 'storage.migration.incomplete',
      });
      expect(mockStorageCall).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('native-storage-repair-progress')).toBeTruthy();

      // Simulate a new bg heap over retained native data after the fault clears.
      mockStorage = new StorageClass();
      await mockStorage.migrateFromAsyncStorage([], '');
      expect(mockStorage.isMigrationComplete()).toBe(true);
      expect(mockMMKV.getString('__mmkv_legacy_retention_v1__')).toBe(
        'retained-v1',
      );
      expect(mockLegacy.get('g_states_v5:aAtom')).toBe('"retained-original"');
      expect(mockLegacyRemove).not.toHaveBeenCalled();
    },
  );
});
