import path from 'path';

import { type BrowserWindow, Tray, nativeImage } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';

import { ipcMessageKeys } from '../config';

import {
  registerTrayIpcHandlers,
  requestDataFromMainWindow,
  resetCachedTrayData,
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
  getTrayWindow,
  onTrayWindowVisibilityChange,
  showTrayWindow,
} from './trayWindow';

const POLL_INTERVAL_MS = 30_000;
// Backstop for when the renderer never responds (main-window crash, etc.).
// Must exceed worst-case serial fetch but stay under POLL_INTERVAL_MS so
// we don't block two whole polls.
const REQUEST_TIMEOUT_MS = 20_000;

let tray: Tray | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;
let isRequesting = false;
let requestTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let cachedGetMainWindow: (() => BrowserWindow | undefined) | null = null;

function clearRequestTimeout(): void {
  if (requestTimeoutTimer) {
    clearTimeout(requestTimeoutTimer);
    requestTimeoutTimer = null;
  }
}

export function releaseRequestGuard(): void {
  isRequesting = false;
  clearRequestTimeout();
}

function guardedRequest(): void {
  if (!cachedGetMainWindow || isRequesting) return;
  isRequesting = true;
  clearRequestTimeout();
  requestTimeoutTimer = setTimeout(() => {
    logger.warn('[TrayManager] data request timed out — releasing guard');
    releaseRequestGuard();
  }, REQUEST_TIMEOUT_MS);
  requestDataFromMainWindow(cachedGetMainWindow);
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
  loadTrayUrl: (win: BrowserWindow) => void,
): void {
  if (isInitialized) return;

  logger.info('[TrayManager] Initializing macOS system tray');
  cachedGetMainWindow = getMainWindow;

  // __dirname resolves to <app>/dist in both dev and inside asar. In prod,
  // build/ holds the packed webpack renderer output; in dev, build/ doesn't
  // exist (renderer runs via dev-server), so we read from public/static/.
  // Don't use app.getAppPath(): dev returns <app>/dist, prod returns the
  // asar root — different levels.
  const iconPath = isDev
    ? path.join(
        __dirname,
        '..',
        '..',
        'public',
        'static',
        'images',
        'trayTemplate.png',
      )
    : path.join(
        __dirname,
        '..',
        'build',
        'static',
        'images',
        'trayTemplate.png',
      );
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    // `new Tray(emptyImage)` throws on macOS, so skip init rather than
    // crash the main process when packaging drops the PNG.
    logger.warn('[TrayManager] tray icon not found at', iconPath);
    return;
  }
  tray = new Tray(icon);
  tray.setToolTip('OneKey');

  const handleClick = () => {
    if (!tray) return;
    if (getTrayWindow()) {
      sendCachedDataToTrayWindow();
    } else {
      // Renderer emits TRAY_READY from its mount effect; main delivers data
      // then, so no setTimeout heuristics here.
      createTrayWindow(tray, loadTrayUrl);
    }
    showTrayWindow(tray);
  };

  tray.on('click', handleClick);
  tray.on('right-click', handleClick);

  onTrayWindowVisibilityChange((visible) => {
    if (visible) {
      startPolling();
    } else {
      stopPolling();
    }
  });

  registerTrayIpcHandlers(getMainWindow, showMainWindow, releaseRequestGuard);

  setNotificationClickHandler((txId: string) => {
    showMainWindow();
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(ipcMessageKeys.TRAY_ACTION, {
        type: 'transaction-detail',
        txid: txId,
        historyId: txId,
      });
    }
  });

  isInitialized = true;

  // Prime the cache so the first panel open is instant.
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
  if (!isInitialized) return;
  logger.info('[TrayManager] Destroying system tray');

  stopPolling();
  releaseRequestGuard();
  unregisterTrayIpcHandlers();
  destroyTrayWindow();
  resetNotificationState();

  // Clear state so a re-init (setting toggle) isn't blocked by stale
  // isLocked or served stale cachedTrayData.
  setLocked(false);
  resetCachedTrayData();

  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
  cachedGetMainWindow = null;
  isInitialized = false;
}
