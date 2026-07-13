import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  AUTH_LOGIN_METHOD_APP_TRANSFER,
  AUTH_LOGIN_METHOD_HARDWARE,
  PASSPHRASE_MODE_NONE,
  PASSPHRASE_MODE_ON_HOST,
} from '../../../core/auth/auth-types';
import {
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
} from '../../../signer/keychain-keys';
import { HardwareAuthManager } from '../_internal/hardware-auth-manager';
import { LEGACY_KEYCHAIN_ACCOUNTS } from '../_internal/legacy-keychain-cleanup';

import type {
  AuthSessionMetadata,
  ResolvedAuthSession,
} from '../../../core/auth/auth-types';

const HARDWARE_SESSION: AuthSessionMetadata = {
  schemaVersion: 1,
  loginMethod: AUTH_LOGIN_METHOD_HARDWARE,
  walletKind: 'hw',
  displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
  importedAt: '2026-04-30T00:00:00.000Z',
  sourceLabel: 'Hardware: OneKey',
  device: {
    connectId: 'connect-1',
    deviceId: 'device-1',
    deviceLabel: 'OneKey',
  },
  passphraseMode: PASSPHRASE_MODE_NONE,
};

function makeStubs(initialMetadata: AuthSessionMetadata | null) {
  let stored: AuthSessionMetadata | null = initialMetadata;
  const sessionStore = {
    load: jest.fn(async () => stored),
    save: jest.fn(async (next: AuthSessionMetadata) => {
      stored = next;
    }),
    clear: jest.fn(async () => {
      stored = null;
    }),
  };
  const keychainStorage = {
    getBackendType: jest.fn(() => 'macos-keychain' as const),
    set: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  };
  const persistKeychainPair = jest.fn(async () => undefined);
  return { sessionStore, keychainStorage, persistKeychainPair };
}

describe('HardwareAuthManager.getStatus', () => {
  it('returns unauthenticated when no session.json exists', async () => {
    const stubs = makeStubs(null);
    const manager = new HardwareAuthManager(stubs);

    const session = await manager.getStatus();

    expect(session.authStatus).toBe('unauthenticated');
    expect(session.hasSecrets).toBe(false);
    expect(session.storageBackend).toBe('macos-keychain');
  });

  it('treats non-hardware session.json as not owned by this manager', async () => {
    // A leftover bot-wallet session.json (or any other loginMethod) must
    // NOT be reported as a hardware login — that would lie to the gate.
    const stubs = makeStubs({
      ...HARDWARE_SESSION,
      loginMethod: AUTH_LOGIN_METHOD_APP_TRANSFER,
      walletKind: 'hd',
      device: undefined,
      passphraseMode: undefined,
    });
    const manager = new HardwareAuthManager(stubs);

    const session = await manager.getStatus();

    expect(session.authStatus).toBe('unauthenticated');
  });

  it('returns the hardware session metadata when loginMethod is hardware', async () => {
    const stubs = makeStubs(HARDWARE_SESSION);
    const manager = new HardwareAuthManager(stubs);

    const session = await manager.getStatus();

    expect(session).toMatchObject({
      authStatus: 'authenticated',
      hasSecrets: true,
      storageBackend: 'macos-keychain',
      loginMethod: AUTH_LOGIN_METHOD_HARDWARE,
      walletKind: 'hw',
      displayAddress: HARDWARE_SESSION.displayAddress,
      sourceLabel: HARDWARE_SESSION.sourceLabel,
      device: HARDWARE_SESSION.device,
      passphraseMode: PASSPHRASE_MODE_NONE,
    } satisfies Partial<ResolvedAuthSession>);
  });
});

describe('HardwareAuthManager.persistSession', () => {
  it('writes session.json without touching the keychain when no passphrase pair is supplied', async () => {
    // Standard wallets (PASSPHRASE_MODE_NONE) never resolve a session_id,
    // so there is nothing to persist beyond the on-disk metadata. The
    // keychain pair must NOT be written speculatively.
    const stubs = makeStubs(null);
    const manager = new HardwareAuthManager(stubs);

    await manager.persistSession({ session: HARDWARE_SESSION });

    expect(stubs.sessionStore.save).toHaveBeenCalledWith(HARDWARE_SESSION);
    expect(stubs.persistKeychainPair).not.toHaveBeenCalled();
  });

  it('writes both session.json and the keychain pair when a hidden-wallet pair is supplied', async () => {
    const stubs = makeStubs(null);
    const manager = new HardwareAuthManager(stubs);
    const hidden: AuthSessionMetadata = {
      ...HARDWARE_SESSION,
      passphraseMode: PASSPHRASE_MODE_ON_HOST,
    };

    await manager.persistSession({
      session: hidden,
      passphraseState: 'state-1',
      sessionId: 'session-1',
    });

    expect(stubs.sessionStore.save).toHaveBeenCalledWith(hidden);
    expect(stubs.persistKeychainPair).toHaveBeenCalledWith(
      stubs.keychainStorage,
      'state-1',
      'session-1',
    );
  });

  it('swallows keychain failures so the on-disk metadata write is not undone', async () => {
    // Mirrors the original hardware-login-command behavior. The session.json
    // is the source of truth; a missing keychain pair only costs one
    // pinentry prompt on the next command.
    const stubs = makeStubs(null);
    stubs.persistKeychainPair.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('keychain locked');
    });
    const manager = new HardwareAuthManager(stubs);

    await expect(
      manager.persistSession({
        session: HARDWARE_SESSION,
        passphraseState: 'state-1',
        sessionId: 'session-1',
      }),
    ).resolves.toBeUndefined();

    expect(stubs.sessionStore.save).toHaveBeenCalledTimes(1);
  });

  it('propagates session.json write failures', async () => {
    const stubs = makeStubs(null);
    stubs.sessionStore.save.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('disk full');
    });
    const manager = new HardwareAuthManager(stubs);

    await expect(
      manager.persistSession({ session: HARDWARE_SESSION }),
    ).rejects.toThrow('disk full');
  });
});

describe('HardwareAuthManager.clearSession', () => {
  it('removes session.json AND best-effort deletes both keychain entries', async () => {
    const stubs = makeStubs(HARDWARE_SESSION);
    const manager = new HardwareAuthManager(stubs);

    await manager.clearSession();

    expect(stubs.sessionStore.clear).toHaveBeenCalledTimes(1);
    expect(stubs.keychainStorage.delete).toHaveBeenCalledWith(
      KEYCHAIN_PASSPHRASE_STATE_KEY,
    );
    expect(stubs.keychainStorage.delete).toHaveBeenCalledWith(
      KEYCHAIN_SESSION_ID_KEY,
    );
  });

  it('also purges raw-account legacy keychain storage when supplied', async () => {
    const stubs = makeStubs(HARDWARE_SESSION);
    const legacyDeletes: string[] = [];
    const manager = new HardwareAuthManager({
      ...stubs,
      legacyKeychainStorage: {
        delete: jest.fn(async (account: string) => {
          legacyDeletes.push(account);
        }),
      },
    });

    await manager.clearSession();

    expect(legacyDeletes).toEqual([...LEGACY_KEYCHAIN_ACCOUNTS]);
  });

  it('does not bubble keychain delete errors (entries may legitimately be absent)', async () => {
    // PASSPHRASE_MODE_NONE never wrote keychain entries, so a "not found"
    // delete is normal and must not derail logout.
    const stubs = makeStubs(HARDWARE_SESSION);
    stubs.keychainStorage.delete.mockImplementation(async () => {
      throw new OneKeyLocalError('keychain entry not found');
    });
    const manager = new HardwareAuthManager(stubs);

    await expect(manager.clearSession()).resolves.toBeUndefined();
    expect(stubs.sessionStore.clear).toHaveBeenCalledTimes(1);
  });

  it('propagates session.json clear failures so logout surfaces them', async () => {
    const stubs = makeStubs(HARDWARE_SESSION);
    stubs.sessionStore.clear.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('permission denied');
    });
    const manager = new HardwareAuthManager(stubs);

    await expect(manager.clearSession()).rejects.toThrow('permission denied');
  });
});
