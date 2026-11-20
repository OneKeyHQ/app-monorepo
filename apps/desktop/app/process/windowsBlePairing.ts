import path from 'path';

import { app, dialog } from 'electron';
import electronIsDev from 'electron-is-dev';

import { ElectronTranslations, i18nText } from '../i18n';
import { getAppStaticResourcesPath } from '../resoucePath';

import type { WindowsBlePairingOptions } from '@onekeyfe/hwk-desktop-noble-ble';
import type { BrowserWindow } from 'electron';

export function createWindowsBlePairingOptions(
  browserWindow: BrowserWindow,
): WindowsBlePairingOptions | undefined {
  if (process.platform !== 'win32') return undefined;
  const isDev = !app.isPackaged && electronIsDev;
  return {
    helperPath: path.join(
      getAppStaticResourcesPath(),
      'bin/ble-pair',
      isDev ? `win-${process.arch}` : '',
      'onekey-ble-pair.exe',
    ),
    onPairingRequest: async ({ pin, signal }) => {
      if (signal.aborted || browserWindow.isDestroyed()) return 'cancel';
      const { response } = await dialog.showMessageBox(browserWindow, {
        type: 'info',
        title: i18nText(ElectronTranslations.transfer_pair_code),
        message: pin,
        detail: i18nText(ElectronTranslations.global_confirm_on_device),
        buttons: [
          i18nText(ElectronTranslations.global_confirm),
          i18nText(ElectronTranslations.global_cancel),
        ],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        signal,
      });
      return !signal.aborted && response === 0 ? 'confirm' : 'cancel';
    },
  };
}
