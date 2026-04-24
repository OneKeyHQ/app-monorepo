import { type BrowserWindow, type IpcMainEvent, ipcMain } from 'electron';
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
let onTrayReady: IpcOn | null = null;

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

// Sender-id gates: the tray window shares the main preload, so without
// these checks either renderer could forge traffic on the other's channels.
// Rejection logs dump the id comparison so field reports can pinpoint
// whether the expected window was missing vs. a different sender.
function isFromMainWindow(
  event: IpcMainEvent,
  getMainWindow: () => BrowserWindow | undefined,
  channel: string,
): boolean {
  const mainWindow = getMainWindow();
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
    logger.warn(`[TrayIpc] rejected ${channel} from non-main window`, {
      senderId: event.sender.id,
      hasMainWindow: !!mainWindow,
      mainWindowId: mainWindow?.webContents.id ?? null,
    });
    return false;
  }
  return true;
}

function isFromTrayWindow(event: IpcMainEvent, channel: string): boolean {
  const trayWindow = getTrayWindow();
  if (!trayWindow || event.sender.id !== trayWindow.webContents.id) {
    logger.warn(`[TrayIpc] rejected ${channel} from non-tray window`, {
      senderId: event.sender.id,
      hasTrayWindow: !!trayWindow,
      trayWindowId: trayWindow?.webContents.id ?? null,
    });
    return false;
  }
  return true;
}

export function registerTrayIpcHandlers(
  getMainWindow: () => BrowserWindow | undefined,
  showMainWindow: () => void,
  onResponse?: () => void,
): void {
  onResponseReceived = onResponse ?? null;
  onTrayDataResponse = (event, data: ITrayData) => {
    if (!isFromMainWindow(event, getMainWindow, 'TRAY_DATA_RESPONSE')) return;

    // Release the in-flight guard immediately so the next poll/wallet-switch
    // doesn't have to wait for the backstop timeout.
    onResponseReceived?.();

    // Detect account switch before we mutate cachedTrayData so the comparison
    // reflects the identity the tray window is currently showing.
    const accountChanged =
      cachedTrayData?.accountId !== undefined &&
      data.accountId !== undefined &&
      cachedTrayData.accountId !== data.accountId;

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
    // Forward when visible (normal update) OR when account just switched —
    // the switch case must push even to a hidden window so the next open
    // doesn't re-read stale cachedTrayData before the next poll (OK-53623).
    if (trayWindow) {
      if (accountChanged || trayWindow.isVisible()) {
        trayWindow.webContents.send(ipcMessageKeys.TRAY_UPDATE, data);
      }
    }
  };
  ipcMain.on(ipcMessageKeys.TRAY_DATA_RESPONSE, onTrayDataResponse);

  onTrayAction = (event, action: { type: string; [key: string]: unknown }) => {
    if (!isFromTrayWindow(event, 'TRAY_ACTION')) return;

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

  onTrayReady = (event) => {
    if (!isFromTrayWindow(event, 'TRAY_READY')) return;
    const trayWindow = getTrayWindow();
    if (!trayWindow) return;
    if (cachedTrayData) {
      trayWindow.webContents.send(ipcMessageKeys.TRAY_UPDATE, cachedTrayData);
      return;
    }
    // Cold start: main renderer hasn't pushed data yet. Trigger a gather
    // instead of waiting for the next 30s poll tick.
    requestDataFromMainWindow(getMainWindow);
  };
  ipcMain.on(ipcMessageKeys.TRAY_READY, onTrayReady);
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
  if (onTrayReady) {
    ipcMain.removeListener(ipcMessageKeys.TRAY_READY, onTrayReady);
    onTrayReady = null;
  }
  onResponseReceived = null;
}
