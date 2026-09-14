import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export type IKeylessRealmOperation =
  | 'createOrRestore'
  | 'rateLimitCheck'
  | 'recover'
  | 'register'
  | 'resetOrVerifyPin';

export type IKeylessRealmTokenDiagnosticContext = {
  flowId: string;
  operation: IKeylessRealmOperation;
  runtimeRole: string;
  tokenExpiresAt?: number;
  tokenFingerprint: string;
  tokenIssuedAt?: number;
};

export class KeylessScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public oauthAccessTokenRefreshStarted(
    params: IKeylessRealmTokenDiagnosticContext,
  ) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public oauthAccessTokenRefreshResult(
    params: IKeylessRealmTokenDiagnosticContext & {
      errorCode?: string;
      errorMessage?: string;
      errorStatus?: number;
      identityMatched?: boolean;
      refreshedTokenExpiresAt?: number;
      refreshedTokenFingerprint?: string;
      refreshedTokenIssuedAt?: number;
      status:
        | 'ambiguousRefreshError'
        | 'definitiveRefreshTokenError'
        | 'identityMismatch'
        | 'invalidToken'
        | 'nonRetryableError'
        | 'retryableError'
        | 'success'
        | 'thrownError'
        | 'unchangedToken';
      tokenChanged?: boolean;
    },
  ) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public juiceboxClientCacheAccess(
    params: IKeylessRealmTokenDiagnosticContext & {
      cacheEntryCount: number;
      cacheHit: boolean;
    },
  ) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public juiceboxClientCacheDisposed(
    params: IKeylessRealmTokenDiagnosticContext & {
      reason: 'delete' | 'evict' | 'expire' | 'set';
    },
  ) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public realmTokenExchangeStarted(
    params: IKeylessRealmTokenDiagnosticContext & {
      isTestnet: boolean;
    },
  ) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public realmTokenExchangeSucceeded(
    params: IKeylessRealmTokenDiagnosticContext & {
      durationMs: number;
      isTestnet: boolean;
      realmTokenCount: number;
      requestId?: string;
      responseCode?: number;
    },
  ) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public realmTokenExchangeFailed(
    params: IKeylessRealmTokenDiagnosticContext & {
      durationMs: number;
      errorMessage?: string;
      httpStatus?: number;
      isTestnet: boolean;
      requestId?: string;
      responseCode?: number;
      responseMessage?: string;
    },
  ) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public juiceboxRecoverError({
    message,
    sdkError,
    plainError,
  }: {
    message: string;
    sdkError: unknown;
    plainError: IOneKeyError;
  }) {
    return {
      message,
      sdkError,
      plainError,
    };
  }

  @LogToLocal({ level: 'error' })
  public juiceboxRegisterError({
    message,
    sdkError,
    plainError,
  }: {
    message: string;
    sdkError: unknown;
    plainError: IOneKeyError;
  }) {
    return {
      message,
      sdkError,
      plainError,
    };
  }

  @LogToLocal({ level: 'error' })
  public dataCorruptedError({ reason }: { reason: string }) {
    return { reason };
  }

  @LogToLocal({ level: 'info' })
  public createKeylessLockAcquired({ lockId }: { lockId: string }) {
    return { lockId };
  }

  @LogToLocal({ level: 'info' })
  public createKeylessWalletNotYetCreated() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public createKeylessOwnerIdGenerated() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public createKeylessMnemonicEncrypted() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public createKeylessJuiceboxShareUploaded({
    juiceboxShareX,
  }: {
    juiceboxShareX: number;
  }) {
    return { juiceboxShareX };
  }

  @LogToLocal({ level: 'info' })
  public createKeylessBackendShareUploaded({
    backendShareX,
  }: {
    backendShareX: number;
  }) {
    return { backendShareX };
  }

  @LogToLocal({ level: 'info' })
  public createKeylessTokensStored() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public verifyKeylessJuiceboxShareRetrieved() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public verifyKeylessTokensStored() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessBackendShareRetrieved() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessOwnerIdGenerated() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessMnemonicPasswordRetrieved() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessMnemonicDecrypted() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessJuiceboxShareRecovered() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessJuiceboxShareUploaded({
    backendShareX,
  }: {
    backendShareX: number;
  }) {
    return { backendShareX };
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessTokensStored() {
    return {};
  }

  @LogToLocal({ level: 'error' })
  public resetKeylessBackendShareV2MigrationFailed() {
    return {};
  }

  @LogToLocal({ level: 'error' })
  public restoreKeylessBackendShareV2MigrationFailed() {
    return {};
  }

  @LogToLocal({ level: 'error' })
  public prepareOneKeyIdLoginWithLocalKeylessFailed({
    error,
  }: {
    error: string;
  }) {
    return { error };
  }

  @LogToLocal({ level: 'info' })
  public restoreKeylessBackendShareRetrieved() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public restoreKeylessOwnerIdGenerated() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public restoreKeylessJuiceboxShareRetrieved() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public restoreKeylessMnemonicPasswordRecovered() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public restoreKeylessMnemonicDecrypted() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public restoreKeylessMnemonicPasswordStored() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public restoreKeylessTokensStored() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public verifyKeylessOwnerIdGenerated() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public verifyKeylessWalletValidated() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessMnemonicVerified() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessCredentialVerified() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public resetKeylessPinConfirmStatusUpdated() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public restorePinConfirmStatusUpdated() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public createKeylessMnemonicPasswordShared() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public createKeylessMnemonicPasswordStored() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public verifyKeylessBackendShareRetrieved() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public verifyKeylessPinConfirmStatusUpdated() {
    return {};
  }
}
