const mockNativeModule: {
  reloadMMKV?: jest.Mock;
  getMMKVFileDiagnostics?: jest.Mock;
} = {};
let mockIsBackground = true;

jest.mock('react-native', () => ({
  NativeModules: { OneKeyNativeStorageMigration: mockNativeModule },
}));
jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeBackgroundThread() {
      return mockIsBackground;
    },
  },
}));

function loadModule() {
  return require('./nativeStorageMigrationModule') as typeof import('./nativeStorageMigrationModule');
}

describe('native storage repair capabilities', () => {
  beforeEach(() => {
    jest.resetModules();
    mockIsBackground = true;
    delete mockNativeModule.reloadMMKV;
    delete mockNativeModule.getMMKVFileDiagnostics;
  });

  it('keeps the JS recovery flow compatible with older native packages', async () => {
    const module = loadModule();
    await expect(
      module.reloadNativeStorageMMKV('onekey-app-storage-v1'),
    ).resolves.toBe(false);
    await expect(
      module.getNativeStorageFileDiagnostics('onekey-app-storage-v1'),
    ).resolves.toBeUndefined();
  });

  it('uses available native diagnostics and propagates native reload failures', async () => {
    mockNativeModule.reloadMMKV = jest
      .fn()
      .mockRejectedValue(new Error('reload failed'));
    mockNativeModule.getMMKVFileDiagnostics = jest.fn().mockResolvedValue({
      dataExists: true,
      dataBytes: 4096,
      dataReadable: true,
      crcExists: false,
      crcBytes: 0,
      crcReadable: false,
      availableBytes: 1024,
    });
    const module = loadModule();
    await expect(
      module.getNativeStorageFileDiagnostics('onekey-app-storage-v1'),
    ).resolves.toEqual(expect.objectContaining({ crcExists: false }));
    await expect(
      module.reloadNativeStorageMMKV('onekey-app-storage-v1'),
    ).rejects.toThrow('reload failed');
    expect(mockNativeModule.reloadMMKV).toHaveBeenCalledWith(
      'onekey-app-storage-v1',
    );
  });

  it('does not permit the UI runtime to mutate a shared native MMKV instance', async () => {
    mockIsBackground = false;
    mockNativeModule.reloadMMKV = jest.fn();
    await expect(
      loadModule().reloadNativeStorageMMKV('onekey-app-storage-v1'),
    ).rejects.toThrow('restricted to the native background runtime');
    expect(mockNativeModule.reloadMMKV).not.toHaveBeenCalled();
  });
});
