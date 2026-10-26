const mockSet = jest.fn();
const mockGetBoolean = jest.fn(() => true);
const mockRemove = jest.fn();
const mockClearAll = jest.fn();
const mockIsMaskingDataSync = jest.fn(() => false);

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionBackgroundServiceWorker: false,
    isNative: false,
    isNativeBackgroundThread: false,
  },
}));

jest.mock('../../travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      persistence: {
        runSync: <T>({
          operation,
          onBlocked,
        }: {
          operation: () => T;
          onBlocked: () => T;
        }) => (mockIsMaskingDataSync() ? onBlocked() : operation()),
      },
    }),
  },
}));

jest.mock('./mmkvDevSettingStorageInstance', () => ({
  __esModule: true,
  default: {
    set: mockSet,
    getBoolean: mockGetBoolean,
    remove: mockRemove,
    clearAll: mockClearAll,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EDevSettingSyncStorageKeys } =
  require('../syncStorageKeys') as typeof import('../syncStorageKeys');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { devSettingSyncStorage } =
  require('./devSettingSyncStorageInstance') as typeof import('./devSettingSyncStorageInstance');

const testKey = EDevSettingSyncStorageKeys.onekey_developer_mode_enabled;

describe('devSettingSyncStorage Travel Mode masking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMaskingDataSync.mockReturnValue(false);
  });

  it('uses the physical dev-settings store while Travel Mode is inactive', () => {
    void devSettingSyncStorage.set(testKey, true);

    expect(devSettingSyncStorage.getBoolean(testKey)).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(testKey, true);
    expect(mockGetBoolean).toHaveBeenCalledWith(testKey);
  });

  it('hides values and silently skips mutations while Travel Mode is active', () => {
    mockIsMaskingDataSync.mockReturnValue(true);

    expect(devSettingSyncStorage.getBoolean(testKey)).toBeUndefined();
    void devSettingSyncStorage.set(testKey, false);
    void devSettingSyncStorage.delete(testKey);
    void devSettingSyncStorage.clearAll();

    expect(mockGetBoolean).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockClearAll).not.toHaveBeenCalled();
  });
});
