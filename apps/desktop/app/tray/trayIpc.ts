import { type BrowserWindow, ipcMain } from 'electron';
import logger from 'electron-log';
import { ipcMessageKeys } from '../config';
import { getTrayWindow } from './trayWindow';
import { diffAndNotify } from './trayNotification';
import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';

const ALLOWED_TRAY_ACTION_TYPES = new Set([
  'open-page',
  'market-detail-v2',
]);

let cachedTrayData: ITrayData | null = null;
let isLocked = false;

export function getCachedTrayData(): ITrayData | null {
  return cachedTrayData;
}

export function setLocked(locked: boolean): void {
  isLocked = locked;
}

export function registerTrayIpcHandlers(
  getMainWindow: () => BrowserWindow | undefined,
  showMainWindow: () => void,
): void {
  ipcMain.on(ipcMessageKeys.TRAY_DATA_RESPONSE, (_event, data: ITrayData) => {
    cachedTrayData = data;

    if (!isLocked) {
      diffAndNotify(data.pendingTxs);
    }

    const trayWindow = getTrayWindow();
    if (trayWindow) {
      trayWindow.webContents.send(ipcMessageKeys.TRAY_UPDATE, data);
    }
  });

  ipcMain.on(
    ipcMessageKeys.TRAY_ACTION,
    (_event, action: { type: string; [key: string]: unknown }) => {
      if (!action?.type || !ALLOWED_TRAY_ACTION_TYPES.has(action.type)) {
        logger.warn('[TrayIpc] rejected unknown action type:', action?.type);
        return;
      }

      showMainWindow();

      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(ipcMessageKeys.TRAY_ACTION, action);
      }
    },
  );
}

export function sendCachedDataToTrayWindow(): void {
  if (!cachedTrayData) return;
  const trayWindow = getTrayWindow();
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.webContents.send(ipcMessageKeys.TRAY_UPDATE, cachedTrayData);
  }
}

export function requestDataFromMainWindow(
  getMainWindow: () => BrowserWindow | undefined,
): void {
  if (isLocked) return;

  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isCrashed()) return;

  mainWindow.webContents.send(ipcMessageKeys.TRAY_DATA_REQUEST);
}

export function unregisterTrayIpcHandlers(): void {
  ipcMain.removeAllListeners(ipcMessageKeys.TRAY_DATA_RESPONSE);
  ipcMain.removeAllListeners(ipcMessageKeys.TRAY_ACTION);
}
