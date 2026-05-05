import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { AuthSessionResolver } from '../core/auth/auth-session-resolver';
import { AppError, ERROR_CODES } from '../errors';
import { AuthSessionStore } from '../infra/auth-session-store';
import { KEYCHAIN_ENCRYPTION_KEY, KEYCHAIN_MNEMONIC_KEY } from '../signer';

import type {
  ISecureStorage,
  SecureStorageBackend,
} from '../infra/keychain-storage';

class InMemorySecureStorage implements ISecureStorage {
  private readonly store = new Map<string, Buffer>();

  private readonly backendType: SecureStorageBackend;

  private readonly failingDeleteKeys: Set<string>;

  constructor(
    backendType: SecureStorageBackend = 'macos-keychain',
    failingDeleteKeys: Iterable<string> = [],
  ) {
    this.backendType = backendType;
    this.failingDeleteKeys = new Set(failingDeleteKeys);
  }

  getBackendType(): SecureStorageBackend {
    return this.backendType;
  }

  async get(key: string): Promise<Buffer | null> {
    const value = this.store.get(key);
    return value ? Buffer.from(value) : null;
  }

  async set(key: string, value: Buffer): Promise<void> {
    this.store.set(key, Buffer.from(value));
  }

  async delete(key: string): Promise<void> {
    if (this.failingDeleteKeys.has(key)) {
      throw new AppError(
        ERROR_CODES.SEC_STORAGE_ERROR.code,
        `simulated delete failure for ${key}`,
        'retry',
      );
    }
    this.store.delete(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

describe('AuthSessionResolver silent cleanup', () => {
  let tempDir: string;
  let sessionPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'resolver-'));
    sessionPath = join(tempDir, 'auth-session.json');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('silently clears keychain + session store when legacy mnemonic session is detected', async () => {
    const storage = new InMemorySecureStorage();
    await storage.set(KEYCHAIN_MNEMONIC_KEY, Buffer.from('ciphertext'));
    await storage.set(KEYCHAIN_ENCRYPTION_KEY, Buffer.from('encryption-key'));

    const legacySession = {
      schema_version: 1,
      login_method: 'mnemonic',
      wallet_kind: 'hd',
      display_address: '0x1234567890abcdef1234567890abcdef12345678',
      imported_at: '2026-01-01T00:00:00.000Z',
      source_label: 'Mnemonic Import',
    };
    mkdirSync(dirname(sessionPath), { recursive: true });
    writeFileSync(
      sessionPath,
      `${JSON.stringify(legacySession, null, 2)}\n`,
      'utf-8',
    );

    const sessionStore = new AuthSessionStore(sessionPath);
    const resolver = new AuthSessionResolver(storage, sessionStore);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const resolved = await resolver.resolve();

    expect(resolved).toEqual({
      authStatus: 'unauthenticated',
      hasSecrets: false,
      storageBackend: 'macos-keychain',
    });
    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(false);
    expect(storage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(false);
    expect(existsSync(sessionPath)).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('silently clears everything when the session file is corrupt JSON', async () => {
    const storage = new InMemorySecureStorage();
    await storage.set(KEYCHAIN_MNEMONIC_KEY, Buffer.from('ciphertext'));
    await storage.set(KEYCHAIN_ENCRYPTION_KEY, Buffer.from('encryption-key'));

    // Invalid session shape — parses as JSON but fails isValidSessionMetadata,
    // so fromRawSession throws AUTH_SESSION_INVALID from load().
    mkdirSync(dirname(sessionPath), { recursive: true });
    writeFileSync(
      sessionPath,
      '{"this":"is","not":"a","valid":"session"}\n',
      'utf-8',
    );

    const sessionStore = new AuthSessionStore(sessionPath);
    const resolver = new AuthSessionResolver(storage, sessionStore);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const resolved = await resolver.resolve();

    expect(resolved).toEqual({
      authStatus: 'unauthenticated',
      hasSecrets: false,
      storageBackend: 'macos-keychain',
    });
    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(false);
    expect(storage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(false);
    expect(existsSync(sessionPath)).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('keeps session metadata on disk when keychain delete fails, so next resolve() retries instead of reviving orphan secrets', async () => {
    // Simulate a keychain that refuses to delete the mnemonic entry. Encryption
    // key delete still succeeds. The session file is a legacy mnemonic record
    // that would trigger AUTH_SESSION_INVALID on load().
    const storage = new InMemorySecureStorage('macos-keychain', [
      KEYCHAIN_MNEMONIC_KEY,
    ]);
    await storage.set(KEYCHAIN_MNEMONIC_KEY, Buffer.from('ciphertext'));
    await storage.set(KEYCHAIN_ENCRYPTION_KEY, Buffer.from('encryption-key'));

    const legacySession = {
      schema_version: 1,
      login_method: 'mnemonic',
      wallet_kind: 'hd',
      display_address: '0x1234567890abcdef1234567890abcdef12345678',
      imported_at: '2026-01-01T00:00:00.000Z',
      source_label: 'Mnemonic Import',
    };
    mkdirSync(dirname(sessionPath), { recursive: true });
    writeFileSync(
      sessionPath,
      `${JSON.stringify(legacySession, null, 2)}\n`,
      'utf-8',
    );

    const sessionStore = new AuthSessionStore(sessionPath);
    const resolver = new AuthSessionResolver(storage, sessionStore);

    const resolved = await resolver.resolve();

    // Current resolve() reports unauthenticated to the caller regardless of
    // cleanup outcome.
    expect(resolved).toEqual({
      authStatus: 'unauthenticated',
      hasSecrets: false,
      storageBackend: 'macos-keychain',
    });
    // Mnemonic delete failed -> session file MUST NOT be cleared. Keeping the
    // legacy session on disk guarantees the next resolve() re-enters the
    // AUTH_SESSION_INVALID cleanup path instead of the "secrets exist +
    // metadata missing" branch that auth-manager.test.ts treats as
    // authenticated.
    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(true);
    expect(existsSync(sessionPath)).toBe(true);
  });

  it('retries cleanup on next resolve() when the previous attempt left session metadata behind', async () => {
    const storage = new InMemorySecureStorage('macos-keychain', [
      KEYCHAIN_MNEMONIC_KEY,
    ]);
    await storage.set(KEYCHAIN_MNEMONIC_KEY, Buffer.from('ciphertext'));
    await storage.set(KEYCHAIN_ENCRYPTION_KEY, Buffer.from('encryption-key'));

    const legacySession = {
      schema_version: 1,
      login_method: 'mnemonic',
      wallet_kind: 'hd',
      display_address: '0x1234567890abcdef1234567890abcdef12345678',
      imported_at: '2026-01-01T00:00:00.000Z',
      source_label: 'Mnemonic Import',
    };
    mkdirSync(dirname(sessionPath), { recursive: true });
    writeFileSync(
      sessionPath,
      `${JSON.stringify(legacySession, null, 2)}\n`,
      'utf-8',
    );

    const sessionStore = new AuthSessionStore(sessionPath);
    const resolver = new AuthSessionResolver(storage, sessionStore);

    // First attempt — keychain delete fails, session kept.
    await resolver.resolve();
    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(true);
    expect(existsSync(sessionPath)).toBe(true);

    // Keychain recovers. Second attempt should now clear everything.
    const healthyStorage = new InMemorySecureStorage('macos-keychain');
    await healthyStorage.set(KEYCHAIN_MNEMONIC_KEY, Buffer.from('ciphertext'));
    await healthyStorage.set(
      KEYCHAIN_ENCRYPTION_KEY,
      Buffer.from('encryption-key'),
    );
    const recoveredResolver = new AuthSessionResolver(
      healthyStorage,
      new AuthSessionStore(sessionPath),
    );

    const resolved = await recoveredResolver.resolve();

    expect(resolved).toEqual({
      authStatus: 'unauthenticated',
      hasSecrets: false,
      storageBackend: 'macos-keychain',
    });
    expect(healthyStorage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(false);
    expect(healthyStorage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(false);
    expect(existsSync(sessionPath)).toBe(false);
  });
});

describe('AuthSessionResolver hardware sessions', () => {
  let tempDir: string;
  let sessionPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'resolver-hw-'));
    sessionPath = join(tempDir, 'auth-session.json');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reports authenticated hardware session without touching keychain mnemonic', async () => {
    const storage = new InMemorySecureStorage();
    const hardwareSession = {
      schema_version: 1,
      login_method: 'hardware',
      wallet_kind: 'hw',
      display_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      imported_at: '2026-04-21T00:00:00.000Z',
      source_label: 'Hardware: OneKey Touch',
      device: {
        connect_id: 'connect-123',
        device_id: 'device-xyz',
        device_label: 'OneKey Touch',
      },
      passphrase_mode: 'on_device',
    };
    mkdirSync(dirname(sessionPath), { recursive: true });
    writeFileSync(
      sessionPath,
      `${JSON.stringify(hardwareSession, null, 2)}\n`,
      'utf-8',
    );

    const sessionStore = new AuthSessionStore(sessionPath);
    const resolver = new AuthSessionResolver(storage, sessionStore);

    const resolved = await resolver.resolve();

    expect(resolved).toEqual({
      authStatus: 'authenticated',
      hasSecrets: true,
      storageBackend: 'macos-keychain',
      loginMethod: 'hardware',
      walletKind: 'hw',
      displayAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      importedAt: '2026-04-21T00:00:00.000Z',
      sourceLabel: 'Hardware: OneKey Touch',
      device: {
        connectId: 'connect-123',
        deviceId: 'device-xyz',
        deviceLabel: 'OneKey Touch',
      },
      passphraseMode: 'on_device',
    });
    expect(storage.has(KEYCHAIN_MNEMONIC_KEY)).toBe(false);
    expect(storage.has(KEYCHAIN_ENCRYPTION_KEY)).toBe(false);
  });
});
