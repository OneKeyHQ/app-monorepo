import { autoUpdater } from 'electron-updater';
import logger from 'electron-log/main';

import type {
  IInstallUpdateParams,
  IVerifyUpdateParams,
} from '@onekeyhq/desktop/app/preload';
import * as store from '@onekeyhq/desktop/app/libs/store';
import type { IDesktopStoreUpdateSettings } from '@onekeyhq/shared/types/desktop';

class DesktopApiUpdater {
  async checkForUpdates(isManual?: boolean): Promise<void> {
    try {
      logger.info('Checking for updates...', { isManual });
      await autoUpdater.checkForUpdates();
    } catch (error) {
      logger.error('Check for updates error:', error);
    }
  }

  async disableShortcuts(params: { disableAllShortcuts?: boolean }): Promise<void> {
    store.setDisableKeyboardShortcuts(params);
  }

  async downloadUpdate(): Promise<void> {
    try {
      logger.info('Downloading update...');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error('Download update error:', error);
    }
  }

  async downloadASC(params: IVerifyUpdateParams): Promise<void> {
    logger.info('Download ASC called with params:', params);
    // Implementation would require complex ASC file handling
  }

  async verifyASC(params: IVerifyUpdateParams): Promise<void> {
    logger.info('Verify ASC called with params:', params);
    // Implementation would require GPG signature verification
  }

  async verifyUpdate(params: IVerifyUpdateParams): Promise<void> {
    logger.info('Verify update called with params:', params);
    // Implementation would require file hash verification
  }

  async installUpdate(params: IInstallUpdateParams): Promise<void> {
    try {
      logger.info('Installing update with params:', params);
      autoUpdater.quitAndInstall();
    } catch (error) {
      logger.error('Install update error:', error);
    }
  }

  async manualInstallPackage(params: IInstallUpdateParams): Promise<void> {
    logger.info('Manual install package called with params:', params);
    // Implementation would require manual package installation logic
  }

  async getPreviousUpdateBuildNumber(): Promise<string> {
    return store.getUpdateBuildNumber() || '';
  }

  async clearUpdate(): Promise<void> {
    store.clearUpdateBuildNumber();
    store.clearASCFile();
  }

  async setAutoUpdateSettings(settings: IDesktopStoreUpdateSettings): Promise<void> {
    store.setUpdateSettings(settings);
  }

  async clearAutoUpdateSettings(): Promise<void> {
    store.clearUpdateSettings();
  }
}

export default DesktopApiUpdater;