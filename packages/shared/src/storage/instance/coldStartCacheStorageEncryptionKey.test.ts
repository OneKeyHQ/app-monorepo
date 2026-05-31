/* eslint-disable @typescript-eslint/no-require-imports */

const mockNativeModules: Record<string, unknown> = {};

jest.mock('react-native', () => ({
  NativeModules: mockNativeModules,
}));

describe('coldStartCacheStorageEncryptionKey', () => {
  beforeEach(() => {
    jest.resetModules();
    Object.keys(mockNativeModules).forEach((key) => {
      delete mockNativeModules[key];
    });
    delete (globalThis as any)
      .__ONEKEY_COLD_START_CACHE_STORAGE_ENCRYPTION_KEY__;
  });

  it('reads the native per-installation key and memoizes it globally', () => {
    mockNativeModules.OneKeyColdStartCacheKey = {
      getConstants: () => ({ encryptionKey: 'native-key' }),
    };

    const { getColdStartCacheStorageEncryptionKey } =
      require('./coldStartCacheStorageEncryptionKey') as typeof import('./coldStartCacheStorageEncryptionKey');

    expect(getColdStartCacheStorageEncryptionKey()).toBe('native-key');
    expect(
      (globalThis as any).__ONEKEY_COLD_START_CACHE_STORAGE_ENCRYPTION_KEY__,
    ).toBe('native-key');
  });

  it('prefers an already memoized global key', () => {
    (globalThis as any).__ONEKEY_COLD_START_CACHE_STORAGE_ENCRYPTION_KEY__ =
      'global-key';
    mockNativeModules.OneKeyColdStartCacheKey = {
      getConstants: () => ({ encryptionKey: 'native-key' }),
    };

    const { getColdStartCacheStorageEncryptionKey } =
      require('./coldStartCacheStorageEncryptionKey') as typeof import('./coldStartCacheStorageEncryptionKey');

    expect(getColdStartCacheStorageEncryptionKey()).toBe('global-key');
  });
});
