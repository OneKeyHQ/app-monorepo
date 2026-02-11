import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class KeylessScene extends BaseScene {
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
