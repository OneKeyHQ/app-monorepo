import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AUTH_SESSION_SCHEMA_VERSION,
  AuthSessionStore,
} from '../infra/auth-session-store';

import type { AuthSessionMetadata } from '../core/auth/auth-types';

function makeSession(
  overrides?: Partial<AuthSessionMetadata>,
): AuthSessionMetadata {
  return {
    schemaVersion: AUTH_SESSION_SCHEMA_VERSION,
    loginMethod: 'mnemonic',
    walletKind: 'hd',
    displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
    importedAt: '2026-04-06T05:35:44.000Z',
    sourceLabel: 'Mnemonic Import',
    ...overrides,
  };
}

let tempDir: string;
let sessionPath: string;

function getPermissionMode(path: string): number {
  return Number.parseInt(statSync(path).mode.toString(8).slice(-3), 8);
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'auth-session-store-'));
  sessionPath = join(tempDir, 'auth-session.json');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('AuthSessionStore', () => {
  it('writes and reads auth metadata using snake_case JSON fields', async () => {
    const store = new AuthSessionStore(sessionPath);
    const session = makeSession();

    await store.save(session);

    expect(existsSync(sessionPath)).toBe(true);
    expect(await store.load()).toEqual(session);

    const raw = JSON.parse(readFileSync(sessionPath, 'utf-8')) as Record<
      string,
      unknown
    >;

    expect(Object.keys(raw).toSorted()).toEqual([
      'display_address',
      'imported_at',
      'login_method',
      'schema_version',
      'source_label',
      'wallet_kind',
    ]);
    expect(raw).not.toHaveProperty('mnemonic');
    expect(raw).not.toHaveProperty('encryption_key');
  });

  it('returns null when auth session metadata file does not exist', async () => {
    const store = new AuthSessionStore(sessionPath);

    await expect(store.load()).resolves.toBeNull();
  });

  it('clears the auth session metadata file', async () => {
    const store = new AuthSessionStore(sessionPath);
    await store.save(makeSession());

    await store.clear();

    expect(existsSync(sessionPath)).toBe(false);
    await expect(store.load()).resolves.toBeNull();
  });

  it('throws AUTH_SESSION_INVALID for malformed JSON', async () => {
    writeFileSync(sessionPath, '{bad json', 'utf-8');

    const store = new AuthSessionStore(sessionPath);

    await expect(store.load()).rejects.toMatchObject({
      code: 'AUTH_SESSION_INVALID',
    });
  });

  it('throws AUTH_SESSION_PERSIST_FAILED when target path is a directory', async () => {
    mkdirSync(sessionPath);
    const store = new AuthSessionStore(sessionPath);

    await expect(store.save(makeSession())).rejects.toMatchObject({
      code: 'AUTH_SESSION_PERSIST_FAILED',
    });
  });

  it('tightens auth session directory and file permissions on save', async () => {
    chmodSync(tempDir, 0o755);
    writeFileSync(sessionPath, 'legacy', { encoding: 'utf-8', mode: 0o644 });
    const store = new AuthSessionStore(sessionPath);

    await store.save(makeSession());

    expect(getPermissionMode(tempDir)).toBe(0o700);
    expect(getPermissionMode(sessionPath)).toBe(0o600);
  });
});
