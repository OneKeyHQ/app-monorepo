import { type BrowserWindow, ipcMain } from 'electron';
import logger from 'electron-log/main';

import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';

import { ipcMessageKeys } from '../config';

import { diffAndNotify } from './trayNotification';
import { getTrayWindow } from './trayWindow';

const ALLOWED_TRAY_ACTION_TYPES = new Set(['open-page', 'market-detail-v2']);

let cachedTrayData: ITrayData | null = null;
let isLocked = false;

export function getCachedTrayData(): ITrayData | null {
  return cachedTrayData;
}

export function setLocked(locked: boolean): void {
  isLocked = locked;
}

export function resetCachedTrayData(): void {
  cachedTrayData = null;
}

export function registerTrayIpcHandlers(
  getMainWindow: () => BrowserWindow | undefined,
  showMainWindow: () => void,
): void {
  ipcMain.on(ipcMessageKeys.TRAY_DATA_RESPONSE, (event, data: ITrayData) => {
    // Only accept responses from the main window. The tray window shares the
    // same preload and could otherwise push crafted payloads (e.g. isLocked)
    // into the cache, mirroring the sender check used by DESKTOP_API_CALL.
    const mainWindow = getMainWindow();
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
      logger.warn('[TrayIpc] rejected TRAY_DATA_RESPONSE from non-main window');
      return;
    }

    // Sync lock state from renderer
    if (data.isLocked) {
      isLocked = true;
      cachedTrayData = data; // Keep locked placeholder as cache
    } else if (data.isError) {
      // Error fallback from renderer — do not run diff/notify because the
      // empty pendingTxs would trigger false "Transaction Confirmed"
      // notifications for every tracked pending tx. Keep previous cache
      // so the panel still shows the last known good data, and do NOT
      // forward the empty error placeholder to the tray window (which
      // would replace the displayed good data with a "No Data Yet" state).
      //
      // Clear isLocked: the renderer only hits this path when the app is
      // already unlocked (the locked branch in useTrayDataProvider returns
      // before the try/catch). Without this, a lock→unlock→gather-failure
      // sequence leaves isLocked stuck true and
      // requestDataFromMainWindow's `if (isLocked) return;` blocks ALL
      // subsequent polling until a push event (account switch, tx status
      // change) happens to produce a non-error response.
      isLocked = false;
      return;
    } else {
      isLocked = false;
      cachedTrayData = data;
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
