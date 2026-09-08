import { OneKeyLocalError } from '../errors';
import {
  EAppSyncStorageKeys,
  EDevSettingSyncStorageKeys,
} from '../storage/syncStorageKeys';

import { RuntimeEnvironment } from './runtimeEnvironment';
import { getTravelModeRuntimeProfile } from './runtimeProfile';

const mockCreateMMKV = jest.fn(() => {
  throw new OneKeyLocalError('A physical MMKV backend was constructed');
});

const maskedEnvironment = RuntimeEnvironment.create(
  getTravelModeRuntimeProfile(true),
);

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isExtensionBackgroundServiceWorker: false,
    isNative: true,
    isNativeBackgroundThread: true,
    isWeb: false,
  },
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: mockCreateMMKV,
}));

jest.mock('./index', () => ({
  travelModeManager: {
    getBootstrapControlValue: async () =>
      JSON.stringify({
        enabled: true,
        verifyString: '|VS|opaque',
        version: 1,
      }),
    getRuntimeEnvironment: async () => maskedEnvironment,
    getRuntimeEnvironmentSync: () => maskedEnvironment,
  },
}));

describe('masked native runtime startup', () => {
  beforeEach(() => {
    mockCreateMMKV.mockClear();
  });

  it('loads actual storage entry points without constructing physical backends', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { syncStorage, coldStartCacheStorage } =
      require('../storage/instance/syncStorageInstance') as typeof import('../storage/instance/syncStorageInstance');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { devSettingSyncStorage } =
      require('../storage/instance/devSettingSyncStorageInstance') as typeof import('../storage/instance/devSettingSyncStorageInstance');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const secureStorage = require('../storage/instance/secureStorageInstance')
      .default as typeof import('../storage/instance/secureStorageInstance').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildAppStorageFactory } =
      require('../storage/appStorageBuildFactory') as typeof import('../storage/appStorageBuildFactory');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      executeNativeStorageRequest,
      prepareNativeStorageForBackgroundStartup,
    } =
      require('../storage/nativeStorageExecutor') as typeof import('../storage/nativeStorageExecutor');

    expect(
      syncStorage.getString(EAppSyncStorageKeys.perf_switch),
    ).toBeUndefined();
    expect(coldStartCacheStorage.getAllKeys()).toEqual([]);
    expect(
      devSettingSyncStorage.getBoolean(
        EDevSettingSyncStorageKeys.onekey_native_network_throttle_enabled,
      ),
    ).toBeUndefined();
    await expect(
      secureStorage.getSecureItem('business-key'),
    ).resolves.toBeNull();

    const physicalGetItem = jest.fn();
    const physicalSetItem = jest.fn();
    const physicalAppStorage = {
      clear: jest.fn(),
      flushGetRequests: jest.fn(),
      getAllKeys: jest.fn(),
      getItem: physicalGetItem,
      mergeItem: jest.fn(),
      multiGet: jest.fn(),
      multiMerge: jest.fn(),
      multiRemove: jest.fn(),
      multiSet: jest.fn(),
      removeItem: jest.fn(),
      setItem: physicalSetItem,
    };
    const appStorage = buildAppStorageFactory(physicalAppStorage);
    await expect(appStorage.getItem('business-key')).resolves.toBeNull();
    await expect(
      appStorage.setItem('business-key', 'value'),
    ).resolves.toBeUndefined();

    await expect(
      prepareNativeStorageForBackgroundStartup(),
    ).resolves.toBeUndefined();
    await expect(
      executeNativeStorageRequest({
        operation: 'getItem',
        scope: 'asyncStorage',
        key: 'business-key',
      }),
    ).resolves.toBeNull();

    expect(mockCreateMMKV).not.toHaveBeenCalled();
    expect(physicalGetItem).not.toHaveBeenCalled();
    expect(physicalSetItem).not.toHaveBeenCalled();
  });
});
