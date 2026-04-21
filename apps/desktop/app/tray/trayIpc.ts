import { type BrowserWindow, ipcMain } from 'electron';
import logger from 'electron-log/main';

import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';

import { ipcMessageKeys } from '../config';

import { diffAndNotify } from './trayNotification';
import { getTrayWindow } from './trayWindow';

// Injected by TrayManager so the IPC layer can release the in-flight guard
// as soon as the renderer ack's the request.
let onResponseReceived: (() => void) | null = null;

// Handler refs so unregister removes only this module's listeners instead
// of clobbering unrelated subscribers on these channels.
type IpcOn = Parameters<typeof ipcMain.on>[1];
let onTrayDataResponse: IpcOn | null = null;
let onTrayAction: IpcOn | null = null;

const ALLOWED_TRAY_ACTION_TYPES = new Set([
  'open-page',
  'market-detail-v2',
  'view-all-transactions',
]);

// Strict pattern so the tray cannot coerce the EVENT_OPEN_URL fan-out
// below into navigating to arbitrary URLs.
const TX_DETAIL_ROUTE_PATTERN = /^\/transaction\/([A-Za-z0-9_-]+)$/;

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
  onResponse?: () => void,
): void {
  onResponseReceived = onResponse ?? null;
  onTrayDataResponse = (event, data: ITrayData) => {
    // Reject non-main-window senders: the tray window shares the same
    // preload and could otherwise push crafted payloads into the cache.
    const mainWindow = getMainWindow();
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
      logger.warn('[TrayIpc] rejected TRAY_DATA_RESPONSE from non-main window');
      return;
    }

    // Release the in-flight guard immediately so the next poll/wallet-switch
    // doesn't have to wait for the backstop timeout.
    onResponseReceived?.();

    if (data.isLocked) {
      isLocked = true;
      cachedTrayData = data;
    } else if (data.isError) {
      // Skip diff/notify — empty pendingTxs would mis-fire "Confirmed" for
      // every tracked tx. Keep previous cache so the panel still shows the
      // last known good data, and don't forward the placeholder to tray.
      //
      // Clear isLocked: renderer only hits this path when unlocked. Without
      // this, a lock→unlock→gather-failure sequence leaves isLocked stuck
      // true and blocks all polling until a push event arrives.
      isLocked = false;
      return;
    } else {
      isLocked = false;
      cachedTrayData = data;
      diffAndNotify(data.pendingTxs, data.accountId, data.pendingTxsCleared);
    }

    const trayWindow = getTrayWindow();
    if (trayWindow) {
      trayWindow.webContents.send(ipcMessageKeys.TRAY_UPDATE, data);
    }
  };
  ipcMain.on(ipcMessageKeys.TRAY_DATA_RESPONSE, onTrayDataResponse);

  onTrayAction = (event, action: { type: string; [key: string]: unknown }) => {
    // Defense-in-depth alongside the `isTrayWindow` scoping in preload.ts:
    // rejects a compromised main renderer from driving navigation, and
    // prevents a self-forwarding IPC loop (main forwards TRAY_ACTION to
    // the main window for handleTrayNavigation — an echo would re-forward).
    const trayWindow = getTrayWindow();
    if (!trayWindow || event.sender.id !== trayWindow.webContents.id) {
      logger.warn('[TrayIpc] rejected TRAY_ACTION from non-tray window');
      return;
    }

    if (!action?.type || !ALLOWED_TRAY_ACTION_TYPES.has(action.type)) {
      logger.warn('[TrayIpc] rejected unknown action type:', action?.type);
      return;
    }

    showMainWindow();

    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Reuse the existing deep-link pipeline (same path notification clicks
    // take) instead of inventing a second navigation mechanism.
    if (action.type === 'open-page' && typeof action.route === 'string') {
      const match = TX_DETAIL_ROUTE_PATTERN.exec(action.route);
      if (match) {
        mainWindow.webContents.send(ipcMessageKeys.EVENT_OPEN_URL, {
          url: `onekey-wallet://transaction/${match[1]}`,
        });
        return;
      }
    }

    mainWindow.webContents.send(ipcMessageKeys.TRAY_ACTION, action);
  };
  ipcMain.on(ipcMessageKeys.TRAY_ACTION, onTrayAction);
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
  if (onTrayDataResponse) {
    ipcMain.removeListener(
      ipcMessageKeys.TRAY_DATA_RESPONSE,
      onTrayDataResponse,
    );
    onTrayDataResponse = null;
  }
  if (onTrayAction) {
    ipcMain.removeListener(ipcMessageKeys.TRAY_ACTION, onTrayAction);
    onTrayAction = null;
  }
  onResponseReceived = null;
}
