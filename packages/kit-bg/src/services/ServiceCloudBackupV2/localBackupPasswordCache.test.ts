/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { webcrypto } from 'crypto';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import secureStorage from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';

import simpleDb from '../../dbs/simple/simpleDb';

import cache from './localBackupPasswordCache';

jest.mock(
  '@onekeyhq/shared/src/storage/instance/secureStorageInstance',
  () => ({
    __esModule: true,
    default: { getSecureItem: jest.fn(), setSecureItem: jest.fn() },
  }),
);
jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    cloudBackupPasswordCache: {
      getPasswordCiphertext: jest.fn(),
      setPasswordCiphertext: jest.fn(),
      removePasswordCiphertext: jest.fn(),
    },
  },
}));

describe('device-only iCloud backup password cache', () => {
  const originalIOS = platformEnv.isNativeIOS;
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'crypto',
  );
  const encryptedStorage = new Map<string, string>();
  const keychain = new Map<string, string>();
  const scope = { accountId: 'synthetic-account-a', recordId: 'backup-a' };
  const password = 'synthetic-backup-password';
  const db = jest.mocked(simpleDb.cloudBackupPasswordCache);
  const secure = jest.mocked(secureStorage);

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  });
  beforeEach(() => {
    platformEnv.isNativeIOS = true;
    encryptedStorage.clear();
    keychain.clear();
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    secure.getSecureItem.mockImplementation(
      async (key) => keychain.get(key) ?? null,
    );
    secure.setSecureItem.mockImplementation(async (key, value) => {
      keychain.set(key, value);
    });
    db.getPasswordCiphertext.mockImplementation(async (key) =>
      encryptedStorage.get(key),
    );
    db.setPasswordCiphertext.mockImplementation(async (key, value) => {
      encryptedStorage.set(key, value);
    });
    db.removePasswordCiphertext.mockImplementation(async (key) => {
      encryptedStorage.delete(key);
    });
  });
  afterEach(() => {
    platformEnv.isNativeIOS = originalIOS;
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (cryptoDescriptor)
      Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  });

  it('stores only ciphertext in SimpleDB and one random key in local secure storage', async () => {
    await cache.set({ ...scope, password });
    expect(await cache.get(scope)).toBe(password);
    expect(keychain.size).toBe(1);
    expect([...keychain.keys()]).toEqual([
      'com.onekey.backup_v2.local_password.key',
    ]);
    const [key] = [...keychain.values()];
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    const [ciphertext] = [...encryptedStorage.values()];
    expect(ciphertext).not.toContain(password);
    expect(ciphertext).not.toContain(key);
    expect(Buffer.from(ciphertext, 'hex').toString('utf8')).not.toContain(
      password,
    );
  });

  it('requires manual entry after SimpleDB migrates without the device key', async () => {
    await cache.set({ ...scope, password });
    keychain.clear();
    secure.setSecureItem.mockClear();
    expect(await cache.get(scope)).toBeUndefined();
    expect(secure.setSecureItem).not.toHaveBeenCalled();
    await cache.set({ ...scope, password: 'newly-verified-password' });
    expect(await cache.get(scope)).toBe('newly-verified-password');
  });

  it('rejects ciphertext copied to another account or backup, and rejects tampering', async () => {
    const otherAccount = { ...scope, accountId: 'synthetic-account-b' };
    const otherRecord = { ...scope, recordId: 'backup-b' };
    await cache.set({ ...scope, password });
    const [ciphertext] = [...encryptedStorage.values()];
    await cache.set({ ...otherAccount, password });
    await cache.set({ ...otherRecord, password });
    for (const key of encryptedStorage.keys())
      encryptedStorage.set(key, ciphertext);
    expect(await cache.get(otherAccount)).toBeUndefined();
    expect(await cache.get(otherRecord)).toBeUndefined();
    expect(await cache.get(scope)).toBe(password);
    for (const key of encryptedStorage.keys()) {
      const bytes = Buffer.from(ciphertext, 'hex');
      bytes[bytes.length - 1] ^= 1;
      encryptedStorage.set(key, bytes.toString('hex'));
    }
    expect(await cache.get(scope)).toBeUndefined();
  });

  it('serializes first writes, retains old backup passwords, and updates the current password', async () => {
    const current = { accountId: scope.accountId };
    await Promise.all([
      cache.set({ ...scope, password }),
      cache.set({ ...current, password: 'old-current-password' }),
      cache.set({ ...current, password: 'new-current-password' }),
    ]);
    expect(secure.setSecureItem).toHaveBeenCalledTimes(1);
    expect(await cache.get(scope)).toBe(password);
    expect(await cache.get(current)).toBe('new-current-password');
    await cache.remove(current);
    expect(await cache.get(current)).toBeUndefined();
    expect(await cache.get(scope)).toBe(password);
  });

  it('treats locked Keychain and corrupt or failing storage as optional cache failures', async () => {
    await cache.set({ ...scope, password });
    secure.getSecureItem.mockRejectedValueOnce(new Error('Keychain locked'));
    expect(await cache.get(scope)).toBeUndefined();
    db.getPasswordCiphertext.mockRejectedValueOnce(
      new Error('Storage unavailable'),
    );
    expect(await cache.get(scope)).toBeUndefined();
    db.getPasswordCiphertext.mockResolvedValueOnce('invalid-ciphertext');
    expect(await cache.get(scope)).toBeUndefined();
    db.setPasswordCiphertext.mockRejectedValueOnce(new Error('Disk full'));
    await expect(cache.set({ ...scope, password })).resolves.toBeUndefined();
    db.removePasswordCiphertext.mockRejectedValueOnce(new Error('Disk full'));
    await expect(cache.remove(scope)).resolves.toBeUndefined();
  });

  it('does not persist ciphertext if secure storage silently declines a write', async () => {
    secure.setSecureItem.mockResolvedValueOnce(undefined);
    await cache.set({ ...scope, password });
    expect(encryptedStorage.size).toBe(0);
  });

  it('never accesses storage outside iOS', async () => {
    platformEnv.isNativeIOS = false;
    await cache.set({ ...scope, password });
    expect(await cache.get(scope)).toBeUndefined();
    await cache.remove(scope);
    expect(secure.getSecureItem).not.toHaveBeenCalled();
    expect(secure.setSecureItem).not.toHaveBeenCalled();
    expect(db.getPasswordCiphertext).not.toHaveBeenCalled();
    expect(db.setPasswordCiphertext).not.toHaveBeenCalled();
    expect(db.removePasswordCiphertext).not.toHaveBeenCalled();
  });
});
