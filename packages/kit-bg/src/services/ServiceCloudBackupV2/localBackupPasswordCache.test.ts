/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { webcrypto } from 'crypto';

import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import secureStorage from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

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

  function readEntry(target = scope) {
    const manifest = JSON.parse(metadata.get(MANIFEST) ?? '') as {
      entries: Record<string, { keyRef: string; ciphertext?: string }>;
    };
    return manifest.entries[
      stringUtils.stableStringify({ ...target, version: 1 })
    ];
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

  it.each(['invalid-ciphertext', ''])(
    'keeps corrupt ciphertext %j paired without affecting another backup',
    async (ciphertext) => {
      await saveTwo();
      const manifest = JSON.parse(metadata.get(MANIFEST) ?? '') as {
        entries: Record<string, { keyRef: string; ciphertext: string }>;
      };
      const target = Object.keys(manifest.entries).find((entry) =>
        entry.includes('backup-a'),
      ) as string;
      manifest.entries[target].ciphertext = ciphertext;
      metadata.set(MANIFEST, JSON.stringify(manifest));
      const before = metadata.get(MANIFEST);
      expect(await cache.get(scope)).toBeUndefined();
      await cache.set({ ...scope, password: 'verified-manual-password' });
      expect(metadata.get(MANIFEST)).toBe(before);
      expect(secure.removeSecureItem).not.toHaveBeenCalled();
      expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(2);
      expect(await cache.get(second)).toBe('synthetic-second-password');
      expect(keys.size).toBe(2);
    },
  );

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

  it('retries declined enrollment after cold start without probing protected keys', async () => {
    secure.setSecureItemWithBiometrics.mockRejectedValueOnce(
      new Error('cancelled'),
    );
    await cache.set({ ...scope, password: 'synthetic-password' });
    const pending = readEntry();
    expect(pending.ciphertext).toBeUndefined();
    cache = new LocalBackupPasswordCache();
    expect(await cache.get(scope)).toBeUndefined();
    expect(readEntry()).toEqual(pending);
    await cache.set({ ...scope, password: 'verified-manual-password' });
    expect(secure.removeSecureItem).toHaveBeenCalledWith(pending.keyRef, {
      keychainService: pending.keyRef,
    });
    expect(readEntry().keyRef).toBe(pending.keyRef);
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(2);
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    cache = new LocalBackupPasswordCache();
    expect(await cache.get(scope)).toBe('verified-manual-password');
    expect(keys.size).toBe(1);
  });

  it('retires a key whose ciphertext commit failed before reusing its isolated service', async () => {
    await cache.set({ ...second, password: 'synthetic-second-password' });
    const otherEntry = readEntry(second);
    secure.setSecureItem
      .mockImplementationOnce(async (key, value) => {
        metadata.set(key, value);
      })
      .mockRejectedValueOnce(new Error('commit failed'));
    await cache.set({ ...scope, password: 'synthetic-password' });
    const pending = readEntry();
    expect(pending.ciphertext).toBeUndefined();
    expect(keys.has(pending.keyRef)).toBe(true);
    const oldValue = keys.get(pending.keyRef);
    cache = new LocalBackupPasswordCache();
    secure.setSecureItemWithBiometrics.mockImplementationOnce(
      async (key, value) => {
        expect(keys.has(pending.keyRef)).toBe(false);
        expect(readEntry()).toEqual({ keyRef: key });
        expect(key).toBe(pending.keyRef);
        expect(value).not.toBe(oldValue);
        keys.set(key, value);
      },
    );
    await cache.set({ ...scope, password: 'verified-manual-password' });
    expect(readEntry(second)).toEqual(otherEntry);
    expect(keys.size).toBe(2);
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    expect(await cache.get(scope)).toBe('verified-manual-password');
    expect(await cache.get(second)).toBe('synthetic-second-password');
  });

  it('retains the old reference when retiring an interrupted key fails', async () => {
    secure.setSecureItemWithBiometrics.mockImplementationOnce(
      async (key, value) => {
        keys.set(key, value);
        throw new OneKeyLocalError('write outcome unknown');
      },
    );
    await cache.set({ ...scope, password: 'synthetic-password' });
    const before = metadata.get(MANIFEST);
    const oldKeys = [...keys];
    secure.removeSecureItem.mockRejectedValueOnce(new Error('delete failed'));
    await cache.set({ ...scope, password: 'verified-manual-password' });
    expect(metadata.get(MANIFEST)).toBe(before);
    expect([...keys]).toEqual(oldKeys);
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(1);
    cache = new LocalBackupPasswordCache();
    await cache.set({ ...scope, password: 'verified-manual-password' });
    expect(keys.size).toBe(1);
    expect(readEntry().keyRef).toBe(oldKeys[0][0]);
    expect(keys.get(oldKeys[0][0])).not.toBe(oldKeys[0][1]);
    expect(await cache.get(scope)).toBe('verified-manual-password');
  });

  it.each(['reject', 'persist then reject'])(
    'does not write a new protected key when retry journaling fails (%s)',
    async (failure) => {
      secure.setSecureItemWithBiometrics.mockRejectedValueOnce(
        new Error('cancelled'),
      );
      await cache.set({ ...scope, password: 'synthetic-password' });
      secure.setSecureItem.mockImplementationOnce(async (key, value) => {
        if (failure === 'persist then reject') metadata.set(key, value);
        throw new OneKeyLocalError('journal failure');
      });
      await cache.set({ ...scope, password: 'verified-manual-password' });
      expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(1);
      expect(readEntry().ciphertext).toBeUndefined();
      expect(keys.size).toBe(0);
      cache = new LocalBackupPasswordCache();
      await cache.set({ ...scope, password: 'verified-manual-password' });
      expect(await cache.get(scope)).toBe('verified-manual-password');
    },
  );

  it('can reuse an already durable pending reference when an identical journal write is a no-op', async () => {
    secure.setSecureItemWithBiometrics.mockRejectedValueOnce(
      new Error('cancelled'),
    );
    await cache.set({ ...scope, password: 'synthetic-password' });
    const pending = readEntry();
    secure.setSecureItem.mockImplementationOnce(async () => {});
    await cache.set({ ...scope, password: 'verified-manual-password' });
    expect(readEntry().keyRef).toBe(pending.keyRef);
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(2);
    expect(await cache.get(scope)).toBe('verified-manual-password');
  });

  it('does not create a protected item when the initial journal is not persisted', async () => {
    secure.setSecureItem.mockImplementationOnce(async () => {});
    await cache.set({ ...scope, password: 'synthetic-password' });
    expect(metadata.size).toBe(0);
    expect(keys.size).toBe(0);
    expect(secure.setSecureItemWithBiometrics).not.toHaveBeenCalled();
    cache = new LocalBackupPasswordCache();
    await cache.set({ ...scope, password: 'verified-manual-password' });
    expect(await cache.get(scope)).toBe('verified-manual-password');
  });

  it('keeps a failed retry commit erasable and allows another cold retry', async () => {
    secure.setSecureItemWithBiometrics.mockRejectedValueOnce(
      new Error('cancelled'),
    );
    await cache.set({ ...scope, password: 'synthetic-password' });
    secure.setSecureItem
      .mockImplementationOnce(async (key, value) => {
        metadata.set(key, value);
      })
      .mockRejectedValueOnce(new Error('commit failed'));
    await cache.set({ ...scope, password: 'verified-manual-password' });
    const interrupted = readEntry();
    const oldValue = keys.get(interrupted.keyRef);
    expect(interrupted.ciphertext).toBeUndefined();
    expect(keys.has(interrupted.keyRef)).toBe(true);
    cache = new LocalBackupPasswordCache();
    await cache.set({ ...scope, password: 'verified-manual-password' });
    expect(readEntry().keyRef).toBe(interrupted.keyRef);
    expect(keys.get(interrupted.keyRef)).not.toBe(oldValue);
    expect(await cache.get(scope)).toBe('verified-manual-password');
    await cache.prepareForReset({ preserve: false });
    expect(metadata.size).toBe(0);
    expect(keys.size).toBe(0);
  });

  it('keeps repeated declined retries unavailable and erasable', async () => {
    secure.setSecureItemWithBiometrics.mockImplementation(
      async (key, value) => {
        keys.set(key, value);
        throw new OneKeyLocalError('interrupted');
      },
    );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await cache.set({ ...scope, password: 'verified-manual-password' });
      expect(keys.size).toBe(1);
      expect(keys.has(readEntry().keyRef)).toBe(true);
      expect(await cache.get(scope)).toBeUndefined();
    }
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(3);
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    await cache.prepareForReset({ preserve: false });
    expect(keys.size).toBe(0);
    expect(metadata.size).toBe(0);
  });

  it('bounds wrapping aliases across cold cancelled retries while rotating the recovery key', async () => {
    // Model Expo Android: alias creation precedes authentication, and deleting
    // a stored item does not delete that alias. This is not a device test.
    const aliases = new Set<string>();
    let attempts = 0;
    secure.setSecureItemWithBiometrics.mockImplementation(
      async (ref, value) => {
        aliases.add(ref);
        attempts += 1;
        if (attempts <= 3) throw new OneKeyLocalError('cancelled');
        keys.set(ref, value);
      },
    );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await cache.set({ ...scope, password: 'verified-manual-password' });
      expect(aliases.size).toBe(1);
      expect(await cache.get(scope)).toBeUndefined();
      cache = new LocalBackupPasswordCache();
    }
    await cache.set({ ...scope, password: 'verified-manual-password' });
    const writes = secure.setSecureItemWithBiometrics.mock.calls;
    expect(new Set(writes.map(([ref]) => ref)).size).toBe(1);
    expect(new Set(writes.map(([, value]) => value)).size).toBe(4);
    expect(secure.getSecureItemWithBiometrics).not.toHaveBeenCalled();
    expect(await cache.get(scope)).toBe('verified-manual-password');
    await cache.prepareForReset({ preserve: false });
    expect(keys.size).toBe(0);
    expect(metadata.size).toBe(0);
    // JS deletion removes recovery values, not Android's Keystore wrapping key.
    expect(aliases.size).toBe(1);
  });

  it('preserves a complete pairing when final commit persisted before rejecting', async () => {
    secure.setSecureItem
      .mockImplementationOnce(async (key, value) => {
        metadata.set(key, value);
      })
      .mockImplementationOnce(async (key, value) => {
        metadata.set(key, value);
        throw new OneKeyLocalError('acknowledgment failed');
      });
    await cache.set({ ...scope, password: 'synthetic-password' });
    const before = metadata.get(MANIFEST);
    cache = new LocalBackupPasswordCache();
    await cache.set({ ...scope, password: 'must-not-replace' });
    expect(metadata.get(MANIFEST)).toBe(before);
    expect(secure.removeSecureItem).not.toHaveBeenCalled();
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(1);
    expect(await cache.get(scope)).toBe('synthetic-password');
  });

  it('does not retire another pairing through a duplicated pending reference', async () => {
    await saveTwo();
    const manifest = JSON.parse(metadata.get(MANIFEST) ?? '') as {
      entries: Record<string, { keyRef: string; ciphertext?: string }>;
    };
    manifest.entries[stringUtils.stableStringify({ ...scope, version: 1 })] = {
      keyRef: readEntry(second).keyRef,
    };
    metadata.set(MANIFEST, stringUtils.stableStringify(manifest));
    const before = metadata.get(MANIFEST);
    await cache.set({ ...scope, password: 'verified-manual-password' });
    expect(metadata.get(MANIFEST)).toBe(before);
    expect(secure.removeSecureItem).not.toHaveBeenCalled();
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(2);
    expect(await cache.get(second)).toBe('synthetic-second-password');
  });

  it('serializes interrupted retries with same-record and other-record creation', async () => {
    secure.setSecureItemWithBiometrics.mockRejectedValueOnce(
      new Error('cancelled'),
    );
    await Promise.all([
      cache.set({ ...scope, password: 'synthetic-password' }),
      cache.set({ ...scope, password: 'verified-manual-password' }),
      cache.set({ ...second, password: 'synthetic-second-password' }),
      cache.set({ ...scope, password: 'must-not-replace-first' }),
    ]);
    expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(3);
    expect(keys.size).toBe(2);
    expect(await cache.get(scope)).toBe('verified-manual-password');
    expect(await cache.get(second)).toBe('synthetic-second-password');
  });

  it.each(['marker', 'manifest'])(
    'never retries a pending enrollment behind an erasure %s',
    async (intent) => {
      secure.setSecureItemWithBiometrics.mockRejectedValueOnce(
        new Error('cancelled'),
      );
      await cache.set({ ...scope, password: 'synthetic-password' });
      if (intent === 'marker') metadata.set(ERASURE, '1');
      else {
        const manifest = JSON.parse(metadata.get(MANIFEST) ?? '') as {
          erasing?: boolean;
        };
        manifest.erasing = true;
        metadata.set(MANIFEST, stringUtils.stableStringify(manifest));
      }
      const before = [...metadata];
      cache = new LocalBackupPasswordCache();
      await cache.set({ ...scope, password: 'verified-manual-password' });
      expect([...metadata]).toEqual(before);
      expect(secure.removeSecureItem).not.toHaveBeenCalled();
      expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(1);
      expect(await cache.get(scope)).toBeUndefined();
      await cache.prepareForReset({ preserve: true });
      expect(metadata.size).toBe(0);
    },
  );

  it.each([false, true])(
    'drains a retiring pending key and blocks queued enrollment on reset preserve=%s',
    async (preserve) => {
      secure.setSecureItemWithBiometrics.mockRejectedValueOnce(
        new Error('cancelled'),
      );
      await cache.set({ ...scope, password: 'synthetic-password' });
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let started = () => {};
      const retiring = new Promise<void>((resolve) => {
        started = resolve;
      });
      secure.removeSecureItem.mockImplementationOnce(async (key) => {
        started();
        await gate;
        keys.delete(key);
      });
      const retry = cache.set({
        ...scope,
        password: 'verified-manual-password',
      });
      await retiring;
      const queued = cache.set({
        ...second,
        password: 'synthetic-second-password',
      });
      const reset = cache.prepareForReset({ preserve });
      release();
      await Promise.all([retry, queued, reset]);
      expect(keys.size).toBe(0);
      expect(secure.setSecureItemWithBiometrics).toHaveBeenCalledTimes(1);
      cache.finishReset();
      await cache.set({ ...scope, password: 'verified-manual-password' });
      expect(await cache.get(scope)).toBe('verified-manual-password');
    },
  );

  it('drains an in-flight retry write before security erasure', async () => {
    secure.setSecureItemWithBiometrics.mockRejectedValueOnce(
      new Error('cancelled'),
    );
    await cache.set({ ...scope, password: 'synthetic-password' });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = () => {};
    const writing = new Promise<void>((resolve) => {
      started = resolve;
    });
    secure.setSecureItemWithBiometrics.mockImplementationOnce(
      async (key, value) => {
        started();
        await gate;
        keys.set(key, value);
      },
    );
    const retry = cache.set({ ...scope, password: 'verified-manual-password' });
    await writing;
    const reset = cache.prepareForReset({ preserve: false });
    release();
    await Promise.all([retry, reset]);
    expect(keys.size).toBe(0);
    expect(metadata.size).toBe(0);
    expect(await cache.get(scope)).toBeUndefined();
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
