import { ipcRenderer } from 'electron';

import type { IVerifyUpdateParams, IInstallUpdateParams } from '@onekeyhq/desktop/app/preload';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import type { IDesktopStoreUpdateSettings } from '@onekeyhq/shared/types/desktop';

class DesktopApiUpdater {
  checkForUpdates(isManual?: boolean): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_CHECK, isManual);
  }

  disableShortcuts(params: { disableAllShortcuts?: boolean }): void {
    ipcRenderer.send(ipcMessageKeys.APP_UPDATE_DISABLE_SHORTCUTS, params);
  }

  downloadUpdate(): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_DOWNLOAD);
  }

  downloadASC(params: IVerifyUpdateParams): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_DOWNLOAD_ASC, params);
  }

  verifyASC(params: IVerifyUpdateParams): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_VERIFY_ASC, params);
  }

  verifyUpdate(params: IVerifyUpdateParams): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_VERIFY, params);
  }

  installUpdate(params: IInstallUpdateParams): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_INSTALL, params);
  }

  manualInstallPackage(params: IInstallUpdateParams): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_MANUAL_INSTALLATION, params);
  }

  getPreviousUpdateBuildNumber(): string {
    return ipcRenderer.sendSync(ipcMessageKeys.UPDATE_GET_PREVIOUS_UPDATE_BUILD_NUMBER);
  }

  clearUpdate(): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_CLEAR);
  }

  setAutoUpdateSettings(settings: IDesktopStoreUpdateSettings): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_SETTINGS, settings);
  }

  clearAutoUpdateSettings(): void {
    ipcRenderer.send(ipcMessageKeys.UPDATE_CLEAR_SETTINGS);
  }
}

export default DesktopApiUpdater;