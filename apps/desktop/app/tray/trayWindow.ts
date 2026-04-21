import path from 'path';

import { BrowserWindow, type Tray, screen } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 480;

let trayWindow: BrowserWindow | null = null;
let visibilityCallback: ((visible: boolean) => void) | null = null;
// Tracked so destroy() can cancel a pending blur-hide; otherwise a late
// timeout could call hide() after the window reference is gone.
let blurHideTimer: ReturnType<typeof setTimeout> | null = null;

export function onTrayWindowVisibilityChange(
  cb: (visible: boolean) => void,
): void {
  visibilityCallback = cb;
}

function calculateWindowPosition(
  tray: Tray,
  windowWidth: number,
  _windowHeight: number,
): { x: number; y: number } {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });
  const displayBounds = display.workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowWidth / 2);
  const y = Math.round(trayBounds.y + trayBounds.height);

  if (x + windowWidth > displayBounds.x + displayBounds.width) {
    x = displayBounds.x + displayBounds.width - windowWidth;
  }
  if (x < displayBounds.x) {
    x = displayBounds.x;
  }

  return { x, y };
}

export function createTrayWindow(
  tray: Tray,
  loadUrl: (win: BrowserWindow) => void,
): BrowserWindow {
  if (trayWindow && !trayWindow.isDestroyed()) {
    logger.info('[TrayWindow] reuse existing tray window');
    return trayWindow;
  }

  const { x, y } = calculateWindowPosition(tray, WINDOW_WIDTH, WINDOW_HEIGHT);
  logger.info('[TrayWindow] create tray window at', { x, y });

  trayWindow = new BrowserWindow({
    x,
    y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      spellcheck: false,
      webviewTag: false,
      webSecurity: !isDev,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: false,
    },
  });

  const trayCSS = `
    .onekey-index-html-preload-image { display: none !important; }
    *:focus { outline: none !important; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
    ::-webkit-scrollbar-track { background: transparent; }
  `;
  // Inject on both events so splash is hidden before any paint, regardless
  // of which lifecycle hook fires first.
  trayWindow.webContents.on('did-start-loading', () => {
    void trayWindow?.webContents.insertCSS(trayCSS);
  });
  trayWindow.webContents.on('dom-ready', () => {
    void trayWindow?.webContents.insertCSS(trayCSS);
  });

  trayWindow.webContents.on('did-finish-load', () => {
    logger.info('[TrayWindow] did-finish-load');
  });
  trayWindow.webContents.on(
    'did-fail-load',
    (_e, code, description, validatedURL) => {
      logger.warn('[TrayWindow] did-fail-load', {
        code,
        description,
        validatedURL,
      });
    },
  );
  trayWindow.webContents.on('render-process-gone', (_e, details) => {
    logger.warn('[TrayWindow] render-process-gone', details);
  });
  // Forward tray renderer's console output into main log so [TrayPanel]
  // markers land in app-latest.log. Electron 34+ hands us a single event
  // object; older versions pass positional args — defensive spread covers
  // both without depending on shape.
  trayWindow.webContents.on('console-message', (...args: any[]) => {
    const ev = args[0];
    const message = typeof ev === 'object' && ev !== null ? ev.message : args[2];
    const level = typeof ev === 'object' && ev !== null ? ev.level : args[1];
    if (typeof message === 'string' && message.startsWith('[TrayPanel]')) {
      logger.info('[TrayRenderer]', { level, message });
    }
  });

  loadUrl(trayWindow);
  logger.info('[TrayWindow] loadUrl invoked');

  trayWindow.on('blur', () => {
    if (blurHideTimer) clearTimeout(blurHideTimer);
    blurHideTimer = setTimeout(() => {
      blurHideTimer = null;
      if (trayWindow && !trayWindow.isDestroyed() && !trayWindow.isFocused()) {
        trayWindow.hide();
        visibilityCallback?.(false);
      }
    }, 100);
  });

  trayWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      trayWindow?.hide();
      visibilityCallback?.(false);
    }
  });

  return trayWindow;
}

export function showTrayWindow(tray: Tray): void {
  if (!trayWindow || trayWindow.isDestroyed()) {
    logger.warn('[TrayWindow] showTrayWindow aborted: window missing', {
      hasWindow: !!trayWindow,
      destroyed: trayWindow?.isDestroyed() ?? null,
    });
    return;
  }

  if (trayWindow.isVisible()) {
    logger.info('[TrayWindow] toggle hide (was visible)');
    trayWindow.hide();
    visibilityCallback?.(false);
    return;
  }

  const { x, y } = calculateWindowPosition(tray, WINDOW_WIDTH, WINDOW_HEIGHT);
  trayWindow.setPosition(x, y);
  trayWindow.show();
  logger.info('[TrayWindow] show at', { x, y });
  visibilityCallback?.(true);
}

export function getTrayWindow(): BrowserWindow | null {
  if (trayWindow && !trayWindow.isDestroyed()) {
    return trayWindow;
  }
  return null;
}

export function destroyTrayWindow(): void {
  if (blurHideTimer) {
    clearTimeout(blurHideTimer);
    blurHideTimer = null;
  }
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.destroy();
  }
  trayWindow = null;
}
