import path from 'path';

import { ipcMain } from 'electron';
import logger from 'electron-log/main';

import type { IDesktopApiPlatformInfo } from '@onekeyhq/shared/types/desktopApiPlatformInfo';

import { ipcMessageKeys } from '../config';

import { getProcessStartAt } from './getProcessStartAt';

// Exported for the contract test in desktopApiContract.test.ts so drift
// between this builder and IDesktopApiPlatformInfo is caught at test time
// in addition to compile time.
export const buildPlatformInfoForIpc = (): IDesktopApiPlatformInfo => {
  let channel: string | undefined;
  if (process.platform === 'linux') {
    // AppImage is detected via the build-time `DESK_CHANNEL=appImage` flag
    // (set in release-desktop-all.yml and baked in by esbuild `define`).
    // We deliberately do not use the runtime `APPIMAGE` env for detection —
    // it can be empty when a wrapper launcher strips it, giving a false
    // negative for what is in fact an AppImage build.
    if (process.env.DESK_CHANNEL === 'appImage') {
      channel = 'appImage';
    } else if (process.env.SNAP) {
      channel = 'snap';
    } else if (process.env.FLATPAK) {
      channel = 'flatpak';
    }
  }
  return {
    arch: process.arch,
    platform: process.platform,
    systemVersion:
      typeof process.getSystemVersion === 'function'
        ? process.getSystemVersion()
        : '',
    isMas: Boolean((process as { mas?: boolean }).mas),
    channel,
    deskChannel: process.env.DESK_CHANNEL || '',
    processStartAt: getProcessStartAt(),
  };
};

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
    event.returnValue = buildPlatformInfoForIpc();
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
