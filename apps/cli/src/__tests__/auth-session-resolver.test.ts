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
import { AuthSessionStore } from '../infra/auth-session-store';
import { KEYCHAIN_ENCRYPTION_KEY, KEYCHAIN_MNEMONIC_KEY } from '../signer';

import type {
  ISecureStorage,
  SecureStorageBackend,
} from '../infra/keychain-storage';

class InMemorySecureStorage implements ISecureStorage {
  private readonly store = new Map<string, Buffer>();

  private readonly backendType: SecureStorageBackend;

  constructor(backendType: SecureStorageBackend = 'macos-keychain') {
    this.backendType = backendType;
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
});
