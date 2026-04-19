import { type BrowserWindow, ipcMain } from 'electron';
import logger from 'electron-log/main';

import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';

import { ipcMessageKeys } from '../config';

import { diffAndNotify } from './trayNotification';
import { getTrayWindow } from './trayWindow';

/**
 * Injected by TrayManager at register time so the IPC layer can mark the
 * in-flight guard as released the moment the renderer ack's the request.
 */
let onResponseReceived: (() => void) | null = null;

const ALLOWED_TRAY_ACTION_TYPES = new Set(['open-page', 'market-detail-v2']);

// `/transaction/<hex txid>` — stricter than a catch-all so the tray
// cannot coerce the deep-link handler into navigating to arbitrary URLs
// via the EVENT_OPEN_URL fan-out below.
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
  ipcMain.on(ipcMessageKeys.TRAY_DATA_RESPONSE, (event, data: ITrayData) => {
    // Only accept responses from the main window. The tray window shares the
    // same preload and could otherwise push crafted payloads (e.g. isLocked)
    // into the cache, mirroring the sender check used by DESKTOP_API_CALL.
    const mainWindow = getMainWindow();
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
      logger.warn('[TrayIpc] rejected TRAY_DATA_RESPONSE from non-main window');
      return;
    }

    // Response arrived — let TrayManager release the in-flight guard
    // immediately so the next poll/wallet-switch can proceed without
    // waiting for the backstop timeout.
    onResponseReceived?.();

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
      diffAndNotify(data.pendingTxs, data.accountId);
    }

    const trayWindow = getTrayWindow();
    if (trayWindow) {
      trayWindow.webContents.send(ipcMessageKeys.TRAY_UPDATE, data);
    }
  });

  ipcMain.on(
    ipcMessageKeys.TRAY_ACTION,
    (event, action: { type: string; [key: string]: unknown }) => {
      // Only accept actions from the tray window. `sendTrayAction` is
      // scoped to the tray preload (isTrayWindow check in preload.ts), so
      // this sender gate is defense-in-depth: if the scoping were ever
      // loosened, this still blocks a compromised main renderer from
      // driving navigation + main-window focus via TRAY_ACTION. Also
      // prevents a self-forwarding IPC loop: main-process forwards
      // TRAY_ACTION to the main window (for handleTrayNavigation); if the
      // main window could echo it back, that would re-forward indefinitely.
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

      // Transaction detail is routed via the existing deep-link pipeline
      // (same path the native notification click uses in TrayManager).
      // The main-window renderer's registerHandler subscribes to
      // EVENT_OPEN_URL and resolves the onekey-wallet:// URL to a
      // proper navigation stack, so we reuse it instead of inventing a
      // second navigation mechanism.
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
  onResponseReceived = null;
}
