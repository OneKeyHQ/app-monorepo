import path from 'path';

import { ipcMain } from 'electron';
import logger from 'electron-log/main';

import { ipcMessageKeys } from '../config';

import { getDesktopPlatformInfo } from './desktopPlatformInfo';

// Main-process ownership survives renderer reloads and handler registration.
const reportedStartupStages = new Set<string>();

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
    event.returnValue = getDesktopPlatformInfo();
  });

  ipcMain.removeAllListeners(ipcMessageKeys.CLAIM_STARTUP_TIMING);
  ipcMain.on(ipcMessageKeys.CLAIM_STARTUP_TIMING, (event, stage: unknown) => {
    if (stage !== 'jsReadyTime' && stage !== 'uiVisibleTime') {
      event.returnValue = false;
      return;
    }
    const claimed = !reportedStartupStages.has(stage);
    if (claimed) {
      reportedStartupStages.add(stage);
    }
    event.returnValue = claimed;
  });

  ipcMain.removeAllListeners(ipcMessageKeys.RELEASE_STARTUP_TIMING);
  ipcMain.on(ipcMessageKeys.RELEASE_STARTUP_TIMING, (event, stage: unknown) => {
    event.returnValue =
      (stage === 'jsReadyTime' || stage === 'uiVisibleTime') &&
      reportedStartupStages.delete(stage);
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
