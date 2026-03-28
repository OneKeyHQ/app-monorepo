import path from 'path';
import { type BrowserWindow, Tray, nativeImage } from 'electron';
import logger from 'electron-log';

import { ipcMessageKeys } from '../config';
import {
  registerTrayIpcHandlers,
  requestDataFromMainWindow,
  sendCachedDataToTrayWindow,
  setLocked,
  unregisterTrayIpcHandlers,
} from './trayIpc';
import {
  resetNotificationState,
  setNotificationClickHandler,
} from './trayNotification';
import {
  createTrayWindow,
  destroyTrayWindow,
  onTrayWindowVisibilityChange,
  showTrayWindow,
} from './trayWindow';

const POLL_INTERVAL_MS = 30_000;

let tray: Tray | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;
let isRequesting = false;
let cachedGetMainWindow: (() => BrowserWindow | undefined) | null = null;

/** Request data with guard to prevent overlapping requests */
function guardedRequest(): void {
  if (!cachedGetMainWindow || isRequesting) return;
  isRequesting = true;
  try {
    requestDataFromMainWindow(cachedGetMainWindow);
  } finally {
    // Release after a short delay so the async pipeline can settle
    setTimeout(() => {
      isRequesting = false;
    }, 2000);
  }
}

export function startPolling(): void {
  if (pollTimer) return;
  if (!cachedGetMainWindow) return;

  logger.info('[TrayManager] Starting data polling (30s interval)');

  guardedRequest();

  pollTimer = setInterval(() => {
    guardedRequest();
  }, POLL_INTERVAL_MS);
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info('[TrayManager] Stopped data polling');
  }
}

export function initTrayManager(
  getMainWindow: () => BrowserWindow | undefined,
  showMainWindow: () => void,
  appStaticResourcesPath: string,
  loadTrayUrl: (win: BrowserWindow) => void,
): void {
  if (isInitialized) return;

  logger.info('[TrayManager] Initializing macOS system tray');
  cachedGetMainWindow = getMainWindow;

  const iconPath = path.join(
    appStaticResourcesPath,
    'images',
    'trayTemplate.png',
  );
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('OneKey');

  let panelCreated = false;

  const handleClick = () => {
    if (!tray) return;
    if (!panelCreated) {
      createTrayWindow(tray, loadTrayUrl);
      panelCreated = true;
      // Send cached data after panel renderer mounts
      setTimeout(() => sendCachedDataToTrayWindow(), 500);
      setTimeout(() => sendCachedDataToTrayWindow(), 1500);
    } else {
      sendCachedDataToTrayWindow();
    }
    showTrayWindow(tray);
  };

  tray.on('click', handleClick);
  tray.on('right-click', handleClick);

  // Start/stop polling based on tray panel visibility
  onTrayWindowVisibilityChange((visible) => {
    if (visible) {
      startPolling();
    } else {
      stopPolling();
    }
  });

  registerTrayIpcHandlers(getMainWindow, showMainWindow);

  setNotificationClickHandler((txId: string) => {
    showMainWindow();
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(ipcMessageKeys.EVENT_OPEN_URL, {
        url: `onekey-wallet://transaction/${txId}`,
      });
    }
  });

  isInitialized = true;

  // Fetch initial data once so the first panel open is instant
  guardedRequest();

  logger.info('[TrayManager] macOS system tray initialized');
}

export function setTrayLocked(locked: boolean): void {
  setLocked(locked);
  if (locked) {
    stopPolling();
    resetNotificationState();
  }
}

export function destroyTrayManager(): void {
  logger.info('[TrayManager] Destroying system tray');

  stopPolling();
  unregisterTrayIpcHandlers();
  destroyTrayWindow();
  resetNotificationState();

  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
  cachedGetMainWindow = null;
  isInitialized = false;
}
