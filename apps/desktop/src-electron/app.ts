/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import * as path from 'path';
import { format as formatUrl } from 'url';

import { BrowserWindow, app, screen } from 'electron';
import isDev from 'electron-is-dev';

const APP_NAME = 'OneKey Wallet';
app.name = APP_NAME;
let mainWindow: BrowserWindow | null;

(global as any).resourcesPath = isDev
  ? path.join(__dirname, '../public/static')
  : process.resourcesPath;
const staticPath = isDev
  ? path.join(__dirname, '../public/static')
  : path.join((global as any).resourcesPath, 'static');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

export type IDesktopOpenUrlEventData = {
  url?: string;
  argv?: string[];
  isColdStartup?: boolean;
  platform?: string;
};

function showMainWindow() {
  if (!mainWindow) {
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
  const display = screen.getPrimaryDisplay();
  const dimensions = display.workAreaSize;
  const ratio = 16 / 9;

  const browserWindow = new BrowserWindow({
    title: APP_NAME,
    titleBarStyle: isWin ? 'default' : 'hidden',
    autoHideMenuBar: true,
    frame: true,
    resizable: true,
    x: isDev ? 0 : undefined,
    y: isDev ? 0 : undefined,
    width: Math.min(1200, dimensions.width),
    height: Math.min(1200 / ratio, dimensions.height),
    minWidth: isDev ? undefined : 1024, // OK-8215
    minHeight: isDev ? undefined : 800 / ratio,
    webPreferences: {
      spellcheck: false,
      webviewTag: true,
      webSecurity: !isDev,
      allowRunningInsecureContent: isDev,
      // webview injected js needs isolation=false, because property can not be exposeInMainWorld() when isolation enabled.
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
    icon: path.join(staticPath, 'images/icons/512x512.png'),
  });

  if (isDev) {
    browserWindow.webContents.openDevTools();
  }

  const src = isDev
    ? 'http://localhost:3001/'
    : formatUrl({
        pathname: 'index.html',
        protocol: 'file',
        slashes: true,
      });

  void browserWindow.loadURL(src);

  return browserWindow;
}

const singleInstance = app.requestSingleInstanceLock();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function quitOrMinimizeApp(event?: Event) {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (isMac) {
    // **** renderer app will reload after minimize, and keytar not working.
    event?.preventDefault();
    if (!mainWindow?.isDestroyed()) {
      mainWindow?.hide();
    }
    // ****
    // app.quit();
  } else {
    app.quit();
  }
}

if (!singleInstance && !process.mas) {
  quitOrMinimizeApp();
} else {
  app.on('second-instance', (e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      showMainWindow();
    }
  });

  app.name = APP_NAME;
  app.on('ready', async () => {
    if (!mainWindow) {
      mainWindow = createMainWindow();
    }
    showMainWindow();
  });
}

app.on('activate', () => {
  if (!mainWindow) {
    mainWindow = createMainWindow();
  }
  showMainWindow();
});

app.on('before-quit', () => {
  if (mainWindow) {
    mainWindow?.removeAllListeners();
    mainWindow?.removeAllListeners('close');
    mainWindow?.close();
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', (event: Event) => {
  quitOrMinimizeApp(event);
});

// Closing the cause context: https://onekeyhq.atlassian.net/browse/OK-8096
app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');
