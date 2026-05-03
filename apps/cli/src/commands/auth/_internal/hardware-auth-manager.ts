import { AUTH_LOGIN_METHOD_HARDWARE } from '../../../core/auth/auth-types';
import { AuthSessionStore } from '../../../infra/auth-session-store';
import { KeychainStorage } from '../../../infra/keychain-storage';
import {
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
  persistKeychainSessionPair,
} from '../../../signer/keychain-keys';

import type {
  AuthSessionMetadata,
  ResolvedAuthSession,
} from '../../../core/auth/auth-types';

type IHardwareSessionStore = Pick<AuthSessionStore, 'load' | 'save' | 'clear'>;
type IHardwareKeychain = Pick<
  KeychainStorage,
  'getBackendType' | 'set' | 'delete'
>;
type IPersistKeychainPair = typeof persistKeychainSessionPair;

export interface IHardwareSessionPersistInput {
  session: AuthSessionMetadata;
  passphraseState?: string;
  sessionId?: string;
}

export type IHardwareAuthManagerOptions = {
  sessionStore?: IHardwareSessionStore;
  keychainStorage?: IHardwareKeychain;
  persistKeychainPair?: IPersistKeychainPair;
};

/**
 * Manages the hardware-wallet auth artifacts: `~/.onekey/auth-session.json`
 * (via AuthSessionStore) and the `passphrase-state` / `session-id` keychain
 * pair. Bot wallet sessions live in the vault and are owned by
 * BotWalletAuthManager; this class never touches the vault.
 *
 * The disk session is recognized as a hardware login only when its
 * `loginMethod === AUTH_LOGIN_METHOD_HARDWARE`. Missing keychain entries are
 * legitimate when `passphraseMode === none`, so they do NOT downgrade the
 * authenticated state.
 */
export class HardwareAuthManager {
  private readonly sessionStore: IHardwareSessionStore;

  private readonly keychainStorage: IHardwareKeychain;

  private readonly persistKeychainPair: IPersistKeychainPair;

  constructor(options: IHardwareAuthManagerOptions = {}) {
    this.sessionStore = options.sessionStore ?? new AuthSessionStore();
    this.keychainStorage = options.keychainStorage ?? new KeychainStorage();
    this.persistKeychainPair =
      options.persistKeychainPair ?? persistKeychainSessionPair;
  }

  async getStatus(): Promise<ResolvedAuthSession> {
    const storageBackend = this.keychainStorage.getBackendType();
    const metadata = await this.sessionStore.load();

    if (!metadata || metadata.loginMethod !== AUTH_LOGIN_METHOD_HARDWARE) {
      return {
        authStatus: 'unauthenticated',
        hasSecrets: false,
        storageBackend,
      };
    }

    return {
      authStatus: 'authenticated',
      hasSecrets: true,
      storageBackend,
      loginMethod: metadata.loginMethod,
      walletKind: metadata.walletKind,
      sourceLabel: metadata.sourceLabel,
      displayAddress: metadata.displayAddress,
      importedAt: metadata.importedAt,
      device: metadata.device,
      passphraseMode: metadata.passphraseMode,
    };
  }

  async persistSession(input: IHardwareSessionPersistInput): Promise<void> {
    await this.sessionStore.save(input.session);

    // Keychain persistence mirrors hardware-login-command's original
    // post-save step: best-effort, swallowed on failure. A miss only costs a
    // single pinentry prompt on the next command — no security or data-loss
    // consequence.
    if (input.passphraseState && input.sessionId) {
      try {
        await this.persistKeychainPair(
          this.keychainStorage,
          input.passphraseState,
          input.sessionId,
        );
      } catch {
        // non-fatal
      }
    }
  }

  async clearSession(): Promise<void> {
    await this.sessionStore.clear();
    // Keychain entries may legitimately be absent (PASSPHRASE_MODE_NONE
    // never wrote them). Best-effort delete avoids ENOENT-style throws from
    // bubbling up while still scrubbing residue from past hidden-wallet
    // sessions.
    await Promise.allSettled([
      this.keychainStorage.delete(KEYCHAIN_PASSPHRASE_STATE_KEY),
      this.keychainStorage.delete(KEYCHAIN_SESSION_ID_KEY),
    ]);
  }
}
