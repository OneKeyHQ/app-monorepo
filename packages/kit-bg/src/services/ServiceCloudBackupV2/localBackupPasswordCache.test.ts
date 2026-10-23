/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { webcrypto } from 'crypto';

import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import secureStorage from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';

import { LocalBackupPasswordCache } from './localBackupPasswordCache';

jest.mock(
  '@onekeyhq/shared/src/storage/instance/secureStorageInstance',
  () => ({
    __esModule: true,
    default: {
      isPersistenceAvailable: jest.fn(),
      getSecureItem: jest.fn(),
      setSecureItem: jest.fn(),
      removeSecureItem: jest.fn(),
      getSecureItemWithBiometrics: jest.fn(),
      setSecureItemWithBiometrics: jest.fn(),
      supportSecureStorageWithBiometrics: jest.fn(),
    },
  }),
);

const MANIFEST = 'com.onekey.backup_v2.biometric_password.manifest';
const ERASURE = 'com.onekey.backup_v2.biometric_password.erasure';

describe.each([
  ECloudBackupProviderType.iCloud,
  ECloudBackupProviderType.GoogleDrive,
])('%s biometric recovery', (providerType) => {
  const originalIOS = platformEnv.isNativeIOS;
  const originalAndroid = platformEnv.isNativeAndroid;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const metadata = new Map<string, string>();
  const keys = new Map<string, string>();
  const secure = jest.mocked(secureStorage);
  const scope = {
    providerType,
    accountId: 'synthetic-account',
    recordId: 'backup-a',
  };
  const second = { ...scope, recordId: 'backup-b' };
  let cache: LocalBackupPasswordCache;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
    platformEnv.isNativeIOS = providerType === ECloudBackupProviderType.iCloud;
    platformEnv.isNativeAndroid =
      providerType === ECloudBackupProviderType.GoogleDrive;
    metadata.clear();
    keys.clear();
    jest.resetAllMocks();
    cache = new LocalBackupPasswordCache();
    secure.isPersistenceAvailable?.mockReturnValue(true);
    secure.supportSecureStorageWithBiometrics?.mockResolvedValue(true);
    secure.getSecureItem.mockImplementation(
      async (key) => metadata.get(key) ?? null,
    );
    secure.setSecureItem.mockImplementation(async (key, value) => {
      metadata.set(key, value);
    });
    secure.getSecureItemWithBiometrics?.mockImplementation(
      async (key) => keys.get(key) ?? null,
    );
    secure.setSecureItemWithBiometrics.mockImplementation(
      async (key, value) => {
        keys.set(key, value);
      },
    );
    secure.removeSecureItem.mockImplementation(async (key) => {
      keys.delete(key);
      metadata.delete(key);
    });
  });
  afterEach(() => {
    platformEnv.isNativeIOS = originalIOS;
    platformEnv.isNativeAndroid = originalAndroid;
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  });

  async function saveTwo() {
    await cache.set({ ...scope, password: 'synthetic-first-password' });
    await cache.set({ ...second, password: 'synthetic-second-password' });
  }

  it('retains two independently protected passwords through normal reset and a cold instance', async () => {
    await saveTwo();
    expect(keys.size).toBe(2);
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    for (const [ref, key, options] of secure.setSecureItemWithBiometrics.mock
      .calls) {
      expect(options).toEqual({
        keychainService: ref,
        authenticationPrompt: expect.any(String),
      });
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(metadata.get(MANIFEST)).not.toContain(key);
    }
    expect(metadata.get(MANIFEST)).not.toContain('synthetic-first-password');
    const before = metadata.get(MANIFEST);
    await cache.prepareForReset({ preserve: true });
    expect(await cache.get(scope)).toBeUndefined();
    await cache.set({ ...scope, password: 'cannot-write-during-reset' });
    expect(metadata.get(MANIFEST)).toBe(before);
    cache = new LocalBackupPasswordCache();
    expect(await cache.get(scope)).toBe('synthetic-first-password');
    expect(await cache.get(second)).toBe('synthetic-second-password');
    expect(await cache.get(scope)).toBe('synthetic-first-password');
    expect(secure.getSecureItemWithBiometrics).toHaveBeenCalledTimes(3);
    expect(
      secure.setSecureItem.mock.calls.every(([key]) => key === MANIFEST),
    ).toBe(true);
  });

  it.each(['cancelled', 'denied', 'failed', 'locked'])(
    'falls back on %s without replacing keys or modifying any entry',
    async (reason) => {
      await saveTwo();
      const before = metadata.get(MANIFEST);
      const beforeKeys = [...keys];
      secure.getSecureItemWithBiometrics?.mockRejectedValueOnce(
        new Error(reason),
      );
      expect(await cache.get(scope)).toBeUndefined();
      await cache.set({ ...scope, password: 'verified-manual-password' });
      expect(metadata.get(MANIFEST)).toBe(before);
      expect([...keys]).toEqual(beforeKeys);
      expect(await cache.get(scope)).toBe('synthetic-first-password');
      expect(await cache.get(second)).toBe('synthetic-second-password');
    },
  );

  it.each(['no hardware', 'not enrolled', 'weak biometrics'])(
    'stores nothing with %s, including after manual verification',
    async () => {
      secure.supportSecureStorageWithBiometrics?.mockResolvedValue(false);
      await saveTwo();
      expect(await cache.get(scope)).toBeUndefined();
      expect(metadata.size).toBe(0);
      expect(keys.size).toBe(0);
      expect(secure.setSecureItem).not.toHaveBeenCalled();
      expect(secure.setSecureItemWithBiometrics).not.toHaveBeenCalled();
    },
  );

  it('keeps a missing/invalidated key paired and leaves other backups recoverable', async () => {
    await saveTwo();
    keys.delete([...keys.keys()][0]);
    expect(await cache.get(scope)).toBeUndefined();
    await cache.set({ ...scope, password: 'verified-password' });
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(2);
    expect(await cache.get(second)).toBe('synthetic-second-password');
  });

  it('isolates accounts and authenticates the complete scope as AAD', async () => {
    await saveTwo();
    const other = { ...scope, accountId: 'another-account' };
    expect(await cache.get(other)).toBeUndefined();
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    await cache.set({ ...other, password: 'another-password' });
    expect(await cache.get(other)).toBe('another-password');
    const manifest = JSON.parse(metadata.get(MANIFEST) ?? '') as {
      entries: Record<string, { keyRef: string; ciphertext: string }>;
    };
    const entries = Object.keys(manifest.entries);
    const source = entries.find(
      (entry) =>
        entry.includes('backup-a') && entry.includes('synthetic-account'),
    ) as string;
    const target = entries.find((entry) =>
      entry.includes('another-account'),
    ) as string;
    manifest.entries[target] = manifest.entries[source];
    metadata.set(MANIFEST, JSON.stringify(manifest));
    expect(await cache.get(other)).toBeUndefined();
    expect(await cache.get(scope)).toBe('synthetic-first-password');
  });

  it('falls back on corrupt ciphertext without affecting another backup', async () => {
    await saveTwo();
    const manifest = JSON.parse(metadata.get(MANIFEST) ?? '') as {
      entries: Record<string, { keyRef: string; ciphertext: string }>;
    };
    const target = Object.keys(manifest.entries).find((entry) =>
      entry.includes('backup-a'),
    ) as string;
    manifest.entries[target].ciphertext = 'invalid-ciphertext';
    metadata.set(MANIFEST, JSON.stringify(manifest));
    expect(await cache.get(scope)).toBeUndefined();
    expect(await cache.get(second)).toBe('synthetic-second-password');
    expect(keys.size).toBe(2);
  });

  it('does not authenticate or find another provider with matching account and record IDs', async () => {
    await saveTwo();
    const otherProvider =
      providerType === ECloudBackupProviderType.iCloud
        ? ECloudBackupProviderType.GoogleDrive
        : ECloudBackupProviderType.iCloud;
    platformEnv.isNativeIOS = otherProvider === ECloudBackupProviderType.iCloud;
    platformEnv.isNativeAndroid =
      otherProvider === ECloudBackupProviderType.GoogleDrive;
    expect(
      await cache.get({ ...scope, providerType: otherProvider }),
    ).toBeUndefined();
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
  });

  it('keeps previous backups when creation is interrupted before ciphertext commit', async () => {
    await cache.set({ ...second, password: 'synthetic-second-password' });
    secure.setSecureItem
      .mockImplementationOnce(async (key, value) => {
        metadata.set(key, value);
      })
      .mockRejectedValueOnce(new Error('Disk full'));
    await cache.set({ ...scope, password: 'synthetic-first-password' });
    cache = new LocalBackupPasswordCache();
    expect(await cache.get(scope)).toBeUndefined();
    expect(await cache.get(second)).toBe('synthetic-second-password');
    await cache.prepareForReset({ preserve: false });
    expect(keys.size).toBe(0);
  });

  it('does not probe, replace or delete corrupt metadata', async () => {
    await saveTwo();
    metadata.set(MANIFEST, '{broken');
    expect(await cache.get(scope)).toBeUndefined();
    await cache.set({ ...second, password: 'verified' });
    expect(metadata.get(MANIFEST)).toBe('{broken');
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    expect(keys.size).toBe(2);
  });

  it('leaves an interrupted/declined creation unavailable and erasable without read-back', async () => {
    secure.setSecureItemWithBiometrics.mockRejectedValueOnce(
      new Error('cancelled'),
    );
    await cache.set({ ...scope, password: 'synthetic-password' });
    expect(await cache.get(scope)).toBeUndefined();
    await cache.set({ ...scope, password: 'verified-manual-password' });
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(1);
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    await cache.prepareForReset({ preserve: false });
    expect(metadata.size).toBe(0);
  });

  it('retains a tombstone across interrupted security erasure and retries without authentication', async () => {
    await saveTwo();
    secure.removeSecureItem.mockRejectedValueOnce(new Error('unavailable'));
    await expect(cache.prepareForReset({ preserve: false })).rejects.toThrow(
      'Recovery cache erasure failed',
    );
    cache = new LocalBackupPasswordCache();
    expect(await cache.get(scope)).toBeUndefined();
    await cache.set({ ...second, password: 'verified' });
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(2);
    await cache.prepareForReset({ preserve: false });
    expect(keys.size).toBe(0);
    expect(metadata.size).toBe(0);
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'finishes interrupted erasure on a cold reset with preserve=%s',
    async (preserve) => {
      await saveTwo();
      secure.removeSecureItem.mockRejectedValueOnce(new Error('interrupted'));
      await expect(
        cache.prepareForReset({ preserve: false }),
      ).rejects.toThrow();
      cache = new LocalBackupPasswordCache();
      await cache.prepareForReset({ preserve });
      expect(keys.size).toBe(0);
      expect(metadata.size).toBe(0);
      expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
      cache.finishReset();
      await cache.set({ ...scope, password: 'synthetic-new-password' });
      expect(await cache.get(scope)).toBe('synthetic-new-password');
    },
  );

  it('denies cold recovery when the manifest tombstone and a protected key deletion both fail', async () => {
    await saveTwo();
    secure.setSecureItem.mockImplementation(async (key, value) => {
      if (key === MANIFEST) throw new OneKeyLocalError('manifest write failed');
      metadata.set(key, value);
    });
    secure.removeSecureItem.mockRejectedValueOnce(
      new Error('key delete failed'),
    );
    await expect(cache.prepareForReset({ preserve: false })).rejects.toThrow(
      'Recovery cache erasure failed',
    );
    expect(keys.size).toBe(1);
    cache = new LocalBackupPasswordCache();
    expect(await cache.get(scope)).toBeUndefined();
    expect(await cache.get(second)).toBeUndefined();
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    secure.setSecureItem.mockImplementation(async (key, value) => {
      metadata.set(key, value);
    });
    await cache.prepareForReset({ preserve: true });
    expect(keys.size).toBe(0);
    expect(metadata.size).toBe(0);
  });

  it('retries intent cleanup after interruption following manifest deletion', async () => {
    await saveTwo();
    secure.removeSecureItem.mockImplementation(async (key) => {
      if (key === ERASURE) throw new OneKeyLocalError('interrupted');
      keys.delete(key);
      metadata.delete(key);
    });
    await expect(cache.prepareForReset({ preserve: false })).rejects.toThrow();
    expect(keys.size).toBe(0);
    expect(metadata.has(MANIFEST)).toBe(false);
    expect(metadata.get(ERASURE)).toBe('1');
    cache = new LocalBackupPasswordCache();
    await cache.set({ ...scope, password: 'must-not-enroll-during-erasure' });
    expect(keys.size).toBe(0);
    secure.removeSecureItem.mockImplementation(async (key) => {
      keys.delete(key);
      metadata.delete(key);
    });
    await cache.prepareForReset({ preserve: true });
    expect(metadata.size).toBe(0);
  });

  it('reports simultaneous marker and key failure, blocks this runtime and retries on preserve reset', async () => {
    await saveTwo();
    const before = metadata.get(MANIFEST);
    secure.setSecureItem.mockRejectedValue(new Error('write failed'));
    secure.removeSecureItem.mockRejectedValueOnce(new Error('delete failed'));
    await expect(cache.prepareForReset({ preserve: false })).rejects.toThrow(
      'Recovery cache erasure failed',
    );
    expect(metadata.get(MANIFEST)).toBe(before);
    expect(keys.size).toBe(1);
    cache.finishReset();
    expect(await cache.get(scope)).toBeUndefined();
    await cache.set({ ...scope, password: 'must-not-replace' });
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(2);
    // No durable deny state exists when every attempt to persist it fails.
    // A cold process still requires successful biometrics for the surviving key.
    const cold = new LocalBackupPasswordCache();
    secure.getSecureItemWithBiometrics?.mockRejectedValueOnce(
      new Error('authentication required'),
    );
    expect(await cold.get(scope)).toBeUndefined();
    expect(await cold.get(scope)).toBe('synthetic-first-password');
    expect(await cold.get(second)).toBeUndefined();
    secure.setSecureItem.mockImplementation(async (key, value) => {
      metadata.set(key, value);
    });
    await cache.prepareForReset({ preserve: true });
    expect(keys.size).toBe(0);
    expect(metadata.size).toBe(0);
  });

  it('reports a no-op manifest deletion and retains the deny state for a retry', async () => {
    await saveTwo();
    secure.removeSecureItem.mockImplementation(async (key) => {
      keys.delete(key);
    });
    await expect(cache.prepareForReset({ preserve: false })).rejects.toThrow();
    cache.finishReset();
    expect(await cache.get(scope)).toBeUndefined();
    expect(metadata.get(MANIFEST)).toContain('"erasing":true');
  });

  it('serializes concurrent creation without losing either backup', async () => {
    await Promise.all([
      cache.set({ ...scope, password: 'synthetic-first-password' }),
      cache.set({ ...second, password: 'synthetic-second-password' }),
      cache.set({ ...scope, password: 'must-not-replace-first' }),
    ]);
    expect(keys.size).toBe(2);
    expect(await cache.get(scope)).toBe('synthetic-first-password');
    expect(await cache.get(second)).toBe('synthetic-second-password');
  });

  it('attempts every key erasure even if persisting the tombstone fails', async () => {
    await saveTwo();
    secure.setSecureItem.mockRejectedValueOnce(new Error('write unavailable'));
    await expect(cache.prepareForReset({ preserve: false })).rejects.toThrow(
      'Recovery cache erasure failed',
    );
    expect(keys.size).toBe(0);
    cache = new LocalBackupPasswordCache();
    expect(await cache.get(scope)).toBeUndefined();
    await cache.prepareForReset({ preserve: false });
    expect(metadata.size).toBe(0);
  });

  it('does not delete another record key when metadata references are corrupted', async () => {
    await saveTwo();
    const manifest = JSON.parse(metadata.get(MANIFEST) ?? '') as {
      entries: Record<string, { keyRef: string; ciphertext: string }>;
    };
    const firstKey = Object.keys(manifest.entries).find((entry) =>
      entry.includes('backup-a'),
    ) as string;
    const secondKey = Object.keys(manifest.entries).find((entry) =>
      entry.includes('backup-b'),
    ) as string;
    manifest.entries[firstKey].keyRef = manifest.entries[secondKey].keyRef;
    metadata.set(MANIFEST, JSON.stringify(manifest));
    await expect(cache.remove(scope)).rejects.toThrow();
    expect(secure.removeSecureItem).not.toHaveBeenCalled();
    expect(await cache.get(second)).toBe('synthetic-second-password');
  });

  it('keeps a failed erasure retryable across cold start without changing another backup', async () => {
    await saveTwo();
    secure.removeSecureItem.mockRejectedValueOnce(
      new Error('synthetic native failure'),
    );
    await expect(cache.remove(scope)).rejects.toThrow(
      'Recovery cache removal failed',
    );
    cache = new LocalBackupPasswordCache();
    expect(await cache.get(second)).toBe('synthetic-second-password');
    await cache.remove(scope);
    expect(await cache.get(scope)).toBeUndefined();
    expect(await cache.get(second)).toBe('synthetic-second-password');
  });

  it('removes only the requested backup', async () => {
    await saveTwo();
    await cache.remove(scope);
    expect(await cache.get(scope)).toBeUndefined();
    expect(await cache.get(second)).toBe('synthetic-second-password');
  });

  it('does not enable caching outside native mobile or without a record', async () => {
    await cache.set({ ...scope, recordId: undefined, password: 'synthetic' });
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeAndroid = false;
    await saveTwo();
    expect(await cache.get(scope)).toBeUndefined();
    expect(secure.setSecureItem).not.toHaveBeenCalled();
    expect(secure.setSecureItemWithBiometrics).not.toHaveBeenCalled();
  });
});
