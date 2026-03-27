import path from 'path';
import { type BrowserWindow, Tray, nativeImage } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log';

import { ipcMessageKeys } from '../config';
import { createTrayWindow, showTrayWindow, destroyTrayWindow } from './trayWindow';
import {
  registerTrayIpcHandlers,
  requestDataFromMainWindow,
  sendCachedDataToTrayWindow,
  unregisterTrayIpcHandlers,
  setLocked,
} from './trayIpc';
import { setNotificationClickHandler, resetNotificationState } from './trayNotification';

const POLL_INTERVAL_MS = 30_000;

let tray: Tray | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

export function initTrayManager(
  getMainWindow: () => BrowserWindow | undefined,
  showMainWindow: () => void,
  appStaticResourcesPath: string,
  loadTrayUrl: (win: BrowserWindow) => void,
): void {
  if (isInitialized) return;

  logger.info('[TrayManager] Initializing macOS system tray');

  const iconPath = path.join(appStaticResourcesPath, 'images', 'trayTemplate.png');
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
  logger.info('[TrayManager] macOS system tray initialized');
}

export function startPolling(
  getMainWindow: () => BrowserWindow | undefined,
): void {
  if (pollTimer) return;

  logger.info('[TrayManager] Starting data polling (30s interval)');

  requestDataFromMainWindow(getMainWindow);

  pollTimer = setInterval(() => {
    requestDataFromMainWindow(getMainWindow);
  }, POLL_INTERVAL_MS);
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
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
  isInitialized = false;
}
