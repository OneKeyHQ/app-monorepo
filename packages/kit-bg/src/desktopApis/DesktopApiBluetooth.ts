import { exec } from 'child_process';

import { shell } from 'electron';
import logger from 'electron-log/main';

import type { IDesktopApi } from './instance/IDesktopApi';

class DesktopApiBluetooth {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  async openBluetoothSettings(): Promise<void> {
    try {
      if (process.platform === 'darwin') {
        exec('open "/System/Library/PreferencePanes/Bluetooth.prefPane"');
      } else if (process.platform === 'win32') {
        void shell.openExternal('ms-settings:bluetooth');
      } else {
        logger.warn(
          'Opening Bluetooth settings not supported on this platform',
        );
      }
    } catch (error) {
      logger.error('Failed to open Bluetooth settings:', error);
    }
  }

  async openPrivacySettings(): Promise<void> {
    try {
      if (process.platform === 'darwin') {
        exec(
          'open "x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth"',
        );
      } else if (process.platform === 'win32') {
        void shell.openExternal('ms-settings:privacy-bluetooth');
      } else {
        logger.warn('Opening privacy settings not supported on this platform');
      }
    } catch (error) {
      logger.error('Failed to open privacy settings:', error);
    }
  }
}

export default DesktopApiBluetooth;
