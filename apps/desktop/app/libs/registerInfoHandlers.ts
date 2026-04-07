import path from 'path';

import { ipcMain } from 'electron';
import logger from 'electron-log/main';

import { ipcMessageKeys } from '../config';

/**
 * Register the sync IPC handlers that preload.js calls at module load time.
 * Without these, ipcRenderer.sendSync() blocks forever and the page never
 * renders.
 *
 * @param isDev  – value returned by IS_DEV (app.ts uses `isDev && !isPerfCiMode`,
 *                 recoveryWindow simply uses `isDev`)
 * @param getIsFocused – callback that returns focus state; recovery window
 *                       always returns `false`
 */
export function registerInfoHandlers(
  isDev: boolean,
  getIsFocused: () => boolean,
) {
  ipcMain.removeAllListeners(ipcMessageKeys.IS_DEV);
  ipcMain.on(ipcMessageKeys.IS_DEV, (event) => {
    event.returnValue = isDev;
  });

  ipcMain.removeAllListeners(ipcMessageKeys.GET_PLATFORM_INFO);
  ipcMain.on(ipcMessageKeys.GET_PLATFORM_INFO, (event) => {
    let channel: string | undefined;
    if (process.platform === 'linux') {
      if (process.env.APPIMAGE) {
        channel = 'appImage';
      } else if (process.env.SNAP) {
        channel = 'snap';
      } else if (process.env.FLATPAK) {
        channel = 'flatpak';
      }
    }
    event.returnValue = {
      arch: process.arch,
      platform: process.platform,
      systemVersion: process.getSystemVersion(),
      isMas: !!(process as any).mas,
      channel,
      deskChannel: process.env.DESK_CHANNEL || '',
    };
  });

  ipcMain.removeAllListeners(ipcMessageKeys.LOG_DIRECTORY);
  ipcMain.on(ipcMessageKeys.LOG_DIRECTORY, (event) => {
    event.returnValue = path.dirname(logger.transports.file.getFile().path);
  });

  ipcMain.removeAllListeners(ipcMessageKeys.APP_IS_FOCUSED);
  ipcMain.on(ipcMessageKeys.APP_IS_FOCUSED, (event) => {
    event.returnValue = getIsFocused();
  });
}
