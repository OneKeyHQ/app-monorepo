import type { IPersistAuthSessionInput } from '@onekeyhq/shared/src/types/cliBotWallet';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { startAppTransferLogin as startAppTransferLoginRuntime } from '../../../core/auth/app-transfer-login';
import { extractBotWalletAuthSessionInputFromTransferData } from '../../../core/auth/app-transfer-payload';
import { AppError, ERROR_CODES } from '../../../errors';
import { KeychainStorage } from '../../../infra/keychain-storage';

import { routeAuthSession } from './login-pipeline';
import { executeLogoutPipeline } from './logout-pipeline';
import { executeStatusPipeline } from './status-pipeline';

import type { ILoginPipelineResult } from './login-pipeline';
import type {
  AppTransferLoginResult,
  ResolvedAuthSession,
  StartAppTransferLoginInput,
} from '../../../core/auth/auth-types';
import type { ITransferPayloadHandlingContext } from '../../../core/prime-transfer/transfer-types';

type IStartAppTransferLoginRuntime = typeof startAppTransferLoginRuntime;
type IRouteAuthSession = typeof routeAuthSession;
type IExecuteLogoutPipeline = typeof executeLogoutPipeline;
type IExecuteStatusPipeline = typeof executeStatusPipeline;

export type IBotWalletAuthManagerOptions = {
  keychainStorage?: Pick<KeychainStorage, 'getBackendType'>;
  startAppTransferLogin?: IStartAppTransferLoginRuntime;
  routeAuthSession?: IRouteAuthSession;
  executeLogoutPipeline?: IExecuteLogoutPipeline;
  executeStatusPipeline?: IExecuteStatusPipeline;
};

function isUnauthenticatedVaultError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'NOT_AUTHENTICATED' || error.code === 'VAULT_MISSING')
  );
}

function isStorageAccessDeniedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'EACCES' || error.code === 'EPERM')
  );
}

function toStorageAccessDeniedAppError(error: unknown): AppError {
  return new AppError(
    ERROR_CODES.SEC_STORAGE_ACCESS_DENIED.code,
    error instanceof Error ? error.message : 'Vault storage access denied.',
    'Check the CLI vault storage permissions and retry.',
    { cause: error },
  );
}

export function toResolvedAuthSession(
  status: Awaited<ReturnType<IExecuteStatusPipeline>>,
  storageBackend: ResolvedAuthSession['storageBackend'],
): ResolvedAuthSession {
  return {
    authStatus: 'authenticated',
    hasSecrets: true,
    storageBackend,
    loginMethod: 'app_transfer',
    walletKind: 'hd',
    sourceLabel: status.data.sourceLabel,
    displayAddress: status.data.displayAddress,
  };
}

export class BotWalletAuthManager {
  private readonly keychainStorage: Pick<KeychainStorage, 'getBackendType'>;

  private readonly startAppTransferLoginRuntime: IStartAppTransferLoginRuntime;

  private readonly routeAuthSession: IRouteAuthSession;

  private readonly logoutPipeline: IExecuteLogoutPipeline;

  private readonly statusPipeline: IExecuteStatusPipeline;

  constructor(options: IBotWalletAuthManagerOptions = {}) {
    this.keychainStorage = options.keychainStorage ?? new KeychainStorage();
    this.startAppTransferLoginRuntime =
      options.startAppTransferLogin ?? startAppTransferLoginRuntime;
    this.routeAuthSession = options.routeAuthSession ?? routeAuthSession;
    this.logoutPipeline =
      options.executeLogoutPipeline ?? executeLogoutPipeline;
    this.statusPipeline =
      options.executeStatusPipeline ?? executeStatusPipeline;
  }

  async persistSession(
    input: IPersistAuthSessionInput,
  ): Promise<ILoginPipelineResult> {
    return this.routeAuthSession(input);
  }

  async getStatus(): Promise<ResolvedAuthSession> {
    try {
      return toResolvedAuthSession(
        await this.statusPipeline(),
        this.keychainStorage.getBackendType(),
      );
    } catch (error) {
      if (isUnauthenticatedVaultError(error)) {
        return {
          authStatus: 'unauthenticated',
          hasSecrets: false,
          storageBackend: this.keychainStorage.getBackendType(),
        };
      }
      if (isStorageAccessDeniedError(error)) {
        throw toStorageAccessDeniedAppError(error);
      }
      throw error;
    }
  }

  async startAppTransferLogin(
    input: StartAppTransferLoginInput = {},
  ): Promise<AppTransferLoginResult> {
    const currentSession = await this.getStatus();
    if (currentSession.authStatus === 'authenticated') {
      throw new AppError(
        ERROR_CODES.AUTH_WALLET_EXISTS.code,
        'Wallet already exists. Log out before importing another wallet.',
        'Run: onekey auth logout',
      );
    }

    return this.startAppTransferLoginRuntime(input, {
      onTransferData: async (transferData, context) =>
        this.handleTransferData(transferData, context),
    });
  }

  async clearSession(): Promise<void> {
    await this.logoutPipeline();
  }

  private async handleTransferData(
    transferData: IPrimeTransferData,
    context: ITransferPayloadHandlingContext,
  ) {
    await this.persistSession(
      extractBotWalletAuthSessionInputFromTransferData(transferData),
    );

    try {
      context.assertSessionIsActive();
    } catch (error) {
      await this.clearSession();
      throw error;
    }

    return {
      rollback: async () => {
        await this.clearSession();
      },
    };
  }
}
