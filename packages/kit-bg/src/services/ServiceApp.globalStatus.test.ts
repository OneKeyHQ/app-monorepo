/* eslint-disable import/first */

const mockAppStorageGetAllKeys = jest.fn<Promise<readonly string[]>, []>();
const mockAppStorageMultiRemove = jest.fn<Promise<void>, [readonly string[]]>();
const mockClearNativeJotaiStorageForReset = jest.fn<Promise<number>, []>();
const mockGetNativeJotaiStorageEntries = jest.fn<
  Promise<ReadonlyMap<string, unknown> | null>,
  []
>();

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

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    // Keep isJest true so storage singletons resolve their jest-safe lazy
    // variants instead of constructing real IndexedDB-backed instances.
    isJest: true,
    isDesktop: false,
    isNative: true,
    isNativeBackgroundThread: true,
    isWeb: false,
  },
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    getAllKeys: () => mockAppStorageGetAllKeys(),
    multiRemove: (keys: readonly string[]) => mockAppStorageMultiRemove(keys),
  },
  storageHub: {
    $webStorageGlobalStates: undefined,
    $webStorageSimpleDB: undefined,
  },
}));

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../states/jotai/atoms', () => ({
  appIsLocked: { get: jest.fn() },
}));

jest.mock('../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: true })),
  },
}));

jest.mock('../states/jotai/jotaiStorage', () => ({
  clearNativeJotaiStorageForReset: () => mockClearNativeJotaiStorageForReset(),
  getNativeJotaiStorageEntries: () => mockGetNativeJotaiStorageEntries(),
}));

import ServiceApp from './ServiceApp';

describe('ServiceApp native GlobalStatus storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clears the Jotai MMKV owner instead of appStorage', async () => {
    mockClearNativeJotaiStorageForReset.mockResolvedValue(2);
    const service = new ServiceApp({ backgroundApi: {} });

    await expect(service.clearGlobalStatus()).resolves.toEqual({
      success: true,
      clearedKeysCount: 2,
    });
    expect(mockClearNativeJotaiStorageForReset).toHaveBeenCalledTimes(1);
    expect(mockAppStorageGetAllKeys).not.toHaveBeenCalled();
    expect(mockAppStorageMultiRemove).not.toHaveBeenCalled();
  });

  test('reads the first entry from the Jotai MMKV owner', async () => {
    mockGetNativeJotaiStorageEntries.mockResolvedValue(
      new Map<string, unknown>([
        ['g_states_v5:aAtom', { value: true }],
        ['g_states_v5:bAtom', 2],
      ]),
    );
    const service = new ServiceApp({ backgroundApi: {} });

    await expect(service.getGlobalStatusFirstItem()).resolves.toEqual({
      isEmpty: false,
      key: 'g_states_v5:aAtom',
      value: { value: true },
      totalKeys: 2,
    });
    expect(mockGetNativeJotaiStorageEntries).toHaveBeenCalledTimes(1);
    expect(mockAppStorageGetAllKeys).not.toHaveBeenCalled();
  });
});
