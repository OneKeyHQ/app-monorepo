import { AppError, ERROR_CODES } from '../../../errors';

import { BotWalletAuthManager } from './bot-wallet-auth-manager';
import { HardwareAuthManager } from './hardware-auth-manager';

import type { IHardwareSessionPersistInput } from './hardware-auth-manager';
import type {
  AppTransferLoginResult,
  ResolvedAuthSession,
  StartAppTransferLoginInput,
} from '../../../core/auth/auth-types';

export type ICliAuthManagerOptions = {
  botWallet?: Pick<
    BotWalletAuthManager,
    'getStatus' | 'startAppTransferLogin' | 'clearSession'
  >;
  hardware?: Pick<
    HardwareAuthManager,
    'getStatus' | 'persistSession' | 'clearSession'
  >;
};

function isAuthenticated(session: ResolvedAuthSession): boolean {
  return session.authStatus === 'authenticated';
}

/**
 * Single entry point for `auth status` / `auth login` / `auth logout` /
 * `auth-gate`. Routes between two storage backends:
 *
 *  - BotWalletAuthManager → ~/.onekey-cli/vault (app-transfer / bot wallet)
 *  - HardwareAuthManager  → ~/.onekey/auth-session.json + OS keychain pair
 *
 * Either flow alone is valid; both flows persisting concurrently is a bug
 * (the login guard prevents it) and surfaces here as AUTH_SESSION_INVALID.
 */
export class CliAuthManager {
  private readonly botWallet: NonNullable<ICliAuthManagerOptions['botWallet']>;

  private readonly hardware: NonNullable<ICliAuthManagerOptions['hardware']>;

  constructor(options: ICliAuthManagerOptions = {}) {
    this.botWallet = options.botWallet ?? new BotWalletAuthManager();
    this.hardware = options.hardware ?? new HardwareAuthManager();
  }

  async getStatus(): Promise<ResolvedAuthSession> {
    // Hardware first: if a session.json exists with loginMethod=hardware,
    // bot wallet must NOT also be authenticated (login guards enforce this
    // invariant). Reading both lets us detect a violation rather than
    // silently masking one half.
    const hardwareStatus = await this.hardware.getStatus();
    const botWalletStatus = await this.botWallet.getStatus();

    if (isAuthenticated(hardwareStatus) && isAuthenticated(botWalletStatus)) {
      throw new AppError(
        ERROR_CODES.AUTH_SESSION_INVALID.code,
        'Conflicting auth sessions: both hardware and bot wallet are active.',
        'Run: onekey auth logout, then login again.',
      );
    }

    if (isAuthenticated(hardwareStatus)) {
      return hardwareStatus;
    }
    if (isAuthenticated(botWalletStatus)) {
      return botWalletStatus;
    }
    return botWalletStatus;
  }

  async startAppTransferLogin(
    input: StartAppTransferLoginInput = {},
  ): Promise<AppTransferLoginResult> {
    // BotWalletAuthManager.startAppTransferLogin already runs an
    // already-authenticated guard against vault. We layer the facade-level
    // check here so a hardware-only session also blocks app-transfer login
    // — without this, `auth login --app-transfer` would race past the guard
    // and create the conflicting state we throw on in getStatus().
    const currentSession = await this.getStatus();
    if (isAuthenticated(currentSession)) {
      throw new AppError(
        ERROR_CODES.AUTH_WALLET_EXISTS.code,
        'Wallet already exists. Log out before importing another wallet.',
        'Run: onekey auth logout',
      );
    }

    return this.botWallet.startAppTransferLogin(input);
  }

  async persistHardwareSession(
    input: IHardwareSessionPersistInput,
  ): Promise<void> {
    await this.hardware.persistSession(input);
  }

  async clearSession(): Promise<void> {
    // Always attempt both — a half-cleared state (vault still alive after
    // hardware delete, or session.json still alive after vault delete) is
    // exactly what produced the original status/transfer split-brain bug.
    const errors: unknown[] = [];

    try {
      await this.hardware.clearSession();
    } catch (error) {
      errors.push(error);
    }

    try {
      await this.botWallet.clearSession();
    } catch (error) {
      errors.push(error);
    }

    if (errors.length === 0) {
      return;
    }
    if (errors.length === 1) {
      throw errors[0];
    }
    throw new AppError(
      ERROR_CODES.AUTH_SESSION_PERSIST_FAILED.code,
      'Failed to clear one or more auth session backends.',
      'Re-run: onekey auth logout, then check ~/.onekey-cli/vault and ~/.onekey/auth-session.json permissions.',
      {
        cause: errors[0],
        details: {
          errors: errors.map((error) =>
            error instanceof Error ? error.message : String(error),
          ),
        },
      },
    );
  }
}
