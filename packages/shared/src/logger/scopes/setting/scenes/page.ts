import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public resetApp({
    reason,
  }: {
    reason: 'ManualResetFromSettings' | 'WrongPasscodeMaxAttempts';
  }) {
    return { reason };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public lockNow() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterAddressBook() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public addAddressBook({ network }: { network: string }) {
    return { network };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public removeAddressBook({ network }: { network: string }) {
    return { network };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterBackup() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public backup({ backupMethod }: { backupMethod: 'iCloud' | 'Google' }) {
    return { backupMethod };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterOneKeyLite() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public oneKeyLiteBackup() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public oneKeyLiteBackupResult({ isSuccess }: { isSuccess: boolean }) {
    return { isSuccess };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public oneKeyLiteImport() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public oneKeyLiteImportResult({ isSuccess }: { isSuccess: boolean }) {
    return { isSuccess };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterKeyTag() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public keyTagBackup() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public keyTagImport() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public keyTagImportResult({ isSuccess }: { isSuccess: boolean }) {
    return { isSuccess };
  }

  @LogToLocal({ level: 'info' })
  public clearDataStep(stepName: string) {
    return { stepName };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public clearData({
    action,
  }: {
    action: 'Cache' | 'Pending txn' | 'ResetApp';
  }) {
    return { action };
  }

  @LogToLocal({ level: 'info' })
  public restartApp() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterCustomRPC() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterCustomizeTransaction() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public addCustomRPC({ network }: { network: string }) {
    return { network };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public deleteCustomRPC({ network }: { network: string }) {
    return { network };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public turnOnCustomRPC({ network }: { network: string }) {
    return { network };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public turnOffCustomRPC({ network }: { network: string }) {
    return { network };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public settingsEnableBluetooth({ enabled }: { enabled: boolean }) {
    return { enabled };
  }
}
