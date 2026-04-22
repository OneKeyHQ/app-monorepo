import { AppError, ERROR_CODES } from '../../errors';
import { AuthSessionStore } from '../../infra/auth-session-store';
import {
  KEYCHAIN_ENCRYPTION_KEY,
  KEYCHAIN_MNEMONIC_KEY,
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
} from '../../signer/keychain-keys';
import { decrypt, secureWipe } from '../crypto-utils';

import { createAppTransferSourceLabelFromMnemonic } from './app-transfer-session';
import {
  AUTH_LOGIN_METHOD_APP_TRANSFER,
  AUTH_LOGIN_METHOD_HARDWARE,
} from './auth-types';

import type { AuthSessionMetadata, ResolvedAuthSession } from './auth-types';
import type { ISecureStorage } from '../../infra/keychain-storage';

export class AuthSessionResolver {
  private readonly storage: ISecureStorage;

  private readonly sessionStore: AuthSessionStore;

  constructor(
    storage: ISecureStorage,
    sessionStore: AuthSessionStore = new AuthSessionStore(),
  ) {
    this.storage = storage;
    this.sessionStore = sessionStore;
  }

  async resolve(): Promise<ResolvedAuthSession> {
    let metadata: AuthSessionMetadata | null;
    try {
      metadata = await this.sessionStore.load();
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === ERROR_CODES.AUTH_SESSION_INVALID.code
      ) {
        await this.silentlyClearEverything();
        return {
          authStatus: 'unauthenticated',
          hasSecrets: false,
          storageBackend: this.storage.getBackendType(),
        };
      }
      throw error;
    }

    // Hardware sessions keep no mnemonic in the keychain — the device is the
    // secret holder. The session file itself is the source of truth.
    if (metadata?.loginMethod === AUTH_LOGIN_METHOD_HARDWARE) {
      return {
        authStatus: 'authenticated',
        hasSecrets: true,
        storageBackend: this.storage.getBackendType(),
        loginMethod: metadata.loginMethod,
        walletKind: metadata.walletKind,
        displayAddress: metadata.displayAddress,
        importedAt: metadata.importedAt,
        sourceLabel: metadata.sourceLabel,
        device: metadata.device,
        passphraseMode: metadata.passphraseMode,
      };
    }

    let encryptedMnemonic: Buffer | null = null;
    let encryptionKey: Buffer | null = null;
    let decryptedMnemonic: Buffer | null = null;

    try {
      encryptedMnemonic = await this.storage.get(KEYCHAIN_MNEMONIC_KEY);
      encryptionKey = await this.storage.get(KEYCHAIN_ENCRYPTION_KEY);
      const hasSecrets = Boolean(encryptedMnemonic && encryptionKey);

      if (!hasSecrets) {
        return {
          authStatus: 'unauthenticated',
          hasSecrets: false,
          storageBackend: this.storage.getBackendType(),
        };
      }

      let sourceLabel = metadata?.sourceLabel;
      if (
        metadata?.loginMethod === AUTH_LOGIN_METHOD_APP_TRANSFER &&
        encryptedMnemonic &&
        encryptionKey
      ) {
        try {
          decryptedMnemonic = await decrypt(
            encryptedMnemonic,
            encryptionKey.toString('utf-8'),
          );
          sourceLabel = createAppTransferSourceLabelFromMnemonic(
            decryptedMnemonic.toString('utf-8'),
          );
        } catch {
          sourceLabel = metadata.sourceLabel;
        } finally {
          if (decryptedMnemonic) {
            secureWipe(decryptedMnemonic);
            decryptedMnemonic = null;
          }
        }
      }

      return {
        authStatus: 'authenticated',
        hasSecrets: true,
        storageBackend: this.storage.getBackendType(),
        ...(metadata
          ? {
              loginMethod: metadata.loginMethod,
              walletKind: metadata.walletKind,
              displayAddress: metadata.displayAddress,
              importedAt: metadata.importedAt,
              sourceLabel,
            }
          : {}),
      };
    } finally {
      if (decryptedMnemonic) {
        secureWipe(decryptedMnemonic);
      }
      if (encryptedMnemonic) {
        secureWipe(encryptedMnemonic);
      }
      if (encryptionKey) {
        secureWipe(encryptionKey);
      }
    }
  }

  // Order matters: delete keychain secrets first, and only clear the session
  // index if ALL succeeded. If any keychain delete fails we keep the session
  // file so the next resolve() re-enters this cleanup path — never leave the
  // store in a "metadata missing + secrets present" state, which resolve()
  // would otherwise report as authenticated (see auth-manager.test.ts
  // "reports authenticated status when secrets exist but metadata is missing").
  //
  // All four keys must be cleared so a corrupted hardware session cannot leak
  // stale passphraseState / session_id into the next `auth login --hardware`,
  // where SignerHardware.preloadSessionFromKeychain would pick up the old
  // values and either mis-sign or trigger spurious passphrase prompts.
  private async silentlyClearEverything(): Promise<void> {
    const keys = [
      KEYCHAIN_MNEMONIC_KEY,
      KEYCHAIN_ENCRYPTION_KEY,
      KEYCHAIN_PASSPHRASE_STATE_KEY,
      KEYCHAIN_SESSION_ID_KEY,
    ];

    let keychainCleared = true;
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch {
        keychainCleared = false;
      }
    }

    if (!keychainCleared) {
      return;
    }

    try {
      await this.sessionStore.clear();
    } catch {
      // Keychain is already empty; a lingering session file will re-enter the
      // AUTH_SESSION_INVALID branch on the next resolve() and retry the clear.
    }
  }
}
