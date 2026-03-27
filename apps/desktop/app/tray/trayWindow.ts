import path from 'path';
import { BrowserWindow, type Tray, screen } from 'electron';
import isDev from 'electron-is-dev';

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 480;

let trayWindow: BrowserWindow | null = null;

function calculateWindowPosition(
  tray: Tray,
  windowWidth: number,
  windowHeight: number,
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
      contextIsolation: false,
      preload: path.join(__dirname, 'preloadTray.js'),
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
  // Inject CSS at every opportunity to ensure splash is hidden
  trayWindow.webContents.on('did-start-loading', () => {
    void trayWindow?.webContents.insertCSS(trayCSS);
  });
  trayWindow.webContents.on('dom-ready', () => {
    void trayWindow?.webContents.insertCSS(trayCSS);
    void trayWindow?.webContents.executeJavaScript(
      `document.querySelectorAll('.onekey-index-html-preload-image').forEach(e=>e.remove())`,
    );
  });

  loadUrl(trayWindow);

  trayWindow.on('blur', () => {
    setTimeout(() => {
      if (trayWindow && !trayWindow.isDestroyed() && !trayWindow.isFocused()) {
        trayWindow.hide();
      }
    }, 100);
  });

  trayWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      trayWindow?.hide();
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
    return;
  }

  const { x, y } = calculateWindowPosition(tray, WINDOW_WIDTH, WINDOW_HEIGHT);
  trayWindow.setPosition(x, y);
  trayWindow.show();
}

export function getTrayWindow(): BrowserWindow | null {
  if (trayWindow && !trayWindow.isDestroyed()) {
    return trayWindow;
  }
  return null;
}

export function destroyTrayWindow(): void {
  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.destroy();
  }
  trayWindow = null;
}
