import { AppError, ERROR_CODES } from '../../errors';
import { AuthSessionStore } from '../../infra/auth-session-store';
import { KEYCHAIN_ENCRYPTION_KEY, KEYCHAIN_MNEMONIC_KEY } from '../../signer';
import { decrypt, secureWipe } from '../crypto-utils';

import { createAppTransferSourceLabelFromMnemonic } from './app-transfer-session';

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
        metadata?.loginMethod === 'app_transfer' &&
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
  // index if BOTH succeeded. If a keychain delete fails we keep the session
  // file so the next resolve() re-enters this cleanup path — never leave the
  // store in a "metadata missing + secrets present" state, which resolve()
  // would otherwise report as authenticated (see auth-manager.test.ts
  // "reports authenticated status when secrets exist but metadata is missing").
  private async silentlyClearEverything(): Promise<void> {
    let keychainCleared = true;
    try {
      await this.storage.delete(KEYCHAIN_MNEMONIC_KEY);
    } catch {
      keychainCleared = false;
    }
    try {
      await this.storage.delete(KEYCHAIN_ENCRYPTION_KEY);
    } catch {
      keychainCleared = false;
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
