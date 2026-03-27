import { type BrowserWindow, ipcMain } from 'electron';
import { ipcMessageKeys } from '../config';
import { getTrayWindow } from './trayWindow';
import { diffAndNotify } from './trayNotification';
import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';

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
    (_event, action: { type: string; route?: string; txId?: string }) => {
      showMainWindow();

      if (action.type === 'open-page' && action.route) {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(ipcMessageKeys.EVENT_OPEN_URL, {
            url: action.route,
          });
        }
      }
    },
  );
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
