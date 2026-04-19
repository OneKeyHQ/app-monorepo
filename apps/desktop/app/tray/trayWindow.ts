import path from 'path';

import { BrowserWindow, type Tray, screen } from 'electron';
import isDev from 'electron-is-dev';

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 480;

let trayWindow: BrowserWindow | null = null;
let visibilityCallback: ((visible: boolean) => void) | null = null;
// Tracked so we can cancel the blur-hide delay when the window is
// destroyed; otherwise a late timeout could hit trayWindow.hide() after
// destroy() has cleared the reference.
let blurHideTimer: ReturnType<typeof setTimeout> | null = null;

/** Register a callback to be notified when the tray panel shows/hides */
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
    return trayWindow;
  }

  const { x, y } = calculateWindowPosition(tray, WINDOW_WIDTH, WINDOW_HEIGHT);

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
      // Tray renderer runs with contextIsolation on: preload exposes the
      // desktopApi surface via contextBridge.exposeInMainWorld, so the
      // app bundle still sees `window.desktopApi`, but cannot monkey-patch
      // preload internals. See apps/desktop/app/preload.ts.
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
  // Inject CSS at every opportunity to ensure splash is hidden.
  // CSS alone is sufficient because trayCSS includes
  // `.onekey-index-html-preload-image { display: none !important; }`
  // and App.tsx module-scope code also removes the element once React boots.
  trayWindow.webContents.on('did-start-loading', () => {
    void trayWindow?.webContents.insertCSS(trayCSS);
  });
  trayWindow.webContents.on('dom-ready', () => {
    void trayWindow?.webContents.insertCSS(trayCSS);
  });

  loadUrl(trayWindow);

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
    return;
  }

  if (trayWindow.isVisible()) {
    trayWindow.hide();
    visibilityCallback?.(false);
    return;
  }

  const { x, y } = calculateWindowPosition(tray, WINDOW_WIDTH, WINDOW_HEIGHT);
  trayWindow.setPosition(x, y);
  trayWindow.show();
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
