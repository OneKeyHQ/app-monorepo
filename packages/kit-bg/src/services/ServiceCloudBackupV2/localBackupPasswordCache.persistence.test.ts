/* eslint-disable @typescript-eslint/unbound-method -- Jest spies do not use this binding. */
import { webcrypto } from 'crypto';

import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import secureStorage from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import { RuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode/runtimeProfile';

import { LocalBackupPasswordCache } from './localBackupPasswordCache';

let mockMasked = false;
const mockMetadata = new Map<string, string>();
const mockKeys = new Map<string, string>();
const mockNative = {
  getSecureItem: jest.fn(async (key: string) => mockMetadata.get(key) ?? null),
  setSecureItem: jest.fn(async (key: string, value: string) => {
    mockMetadata.set(key, value);
  }),
  removeSecureItem: jest.fn(async (key: string) => {
    mockMetadata.delete(key);
    mockKeys.delete(key);
  }),
  getSecureItemWithBiometrics: jest.fn(
    async (key: string) => mockKeys.get(key) ?? null,
  ),
  setSecureItemWithBiometrics: jest.fn(async (key: string, value: string) => {
    mockKeys.set(key, value);
  }),
  supportSecureStorageWithBiometrics: jest.fn(async () => true),
};

jest.mock('@onekeyhq/shared/src/storage/secureStorage', () => ({
  __esModule: true,
  default: mockNative,
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () =>
      RuntimeEnvironment.create(getTravelModeRuntimeProfile(mockMasked)),
  },
}));

// Exercise the actual storage facade and its real masked read/no-op write policy.
// This direct cache test does not establish reachability through command policy.
describe('recovery erasure through the Travel Mode persistence facade', () => {
  const originalIOS = platformEnv.isNativeIOS;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const scope = {
    providerType: ECloudBackupProviderType.iCloud,
    accountId: 'synthetic-account',
    recordId: 'synthetic-record',
  };
  beforeEach(() => {
    platformEnv.isNativeIOS = true;
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
    mockMasked = false;
    mockMetadata.clear();
    mockKeys.clear();
    jest.clearAllMocks();
  });
  afterEach(() => {
    platformEnv.isNativeIOS = originalIOS;
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  });

  it.each([false, true])(
    'rejects masked reset preserve=%s without touching real credentials, then retries in standard mode',
    async (preserve) => {
      const cache = new LocalBackupPasswordCache();
      await cache.set({ ...scope, password: 'synthetic-password' });
      expect(mockKeys.size).toBe(1);
      const before = [...mockMetadata];
      mockMasked = true;
      expect(secureStorage.isPersistenceAvailable?.()).toBe(false);
      expect(await secureStorage.getSecureItem(before[0][0])).toBeNull();
      await secureStorage.setSecureItem(before[0][0], 'masked-no-op');
      await secureStorage.removeSecureItem(before[0][0]);
      await expect(cache.prepareForReset({ preserve })).rejects.toThrow(
        'Recovery cache erasure failed',
      );
      expect([...mockMetadata]).toEqual(before);
      expect(mockKeys.size).toBe(1);
      expect(mockNative.removeSecureItem).not.toHaveBeenCalled();
      cache.finishReset();
      mockMasked = false;
      // Security intent is retained in memory even though masking prevented a marker.
      await cache.prepareForReset({ preserve: !preserve });
      expect(mockKeys.size).toBe(0);
      expect(mockMetadata.size).toBe(0);
      expect(mockNative.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    },
  );

  it('detects masking entered while a real manifest read was pending', async () => {
    const cache = new LocalBackupPasswordCache();
    await cache.set({ ...scope, password: 'synthetic-password' });
    mockNative.getSecureItem.mockImplementationOnce(async (key) => {
      mockMasked = true;
      return mockMetadata.get(key) ?? null;
    });
    await expect(cache.prepareForReset({ preserve: false })).rejects.toThrow(
      'Recovery cache erasure failed',
    );
    expect(mockKeys.size).toBe(1);
    expect(mockNative.removeSecureItem).not.toHaveBeenCalled();
    mockMasked = false;
    await cache.prepareForReset({ preserve: true });
    expect(mockKeys.size).toBe(0);
  });
});
