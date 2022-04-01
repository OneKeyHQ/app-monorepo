import * as path from 'path';
import { format as formatUrl } from 'url';

import { BrowserWindow, app, ipcMain, shell } from 'electron';
import isDev from 'electron-is-dev';

import Logger, {
  LogLevel,
  defaultOptions as loggerDefaults,
} from './libs/logger';
import modules from './libs/modules';
import * as store from './libs/store';

const APP_NAME = 'OneKey Wallet';
let mainWindow: BrowserWindow | null;

// Logger
const log = {
  level:
    app.commandLine.getSwitchValue('log-level') || (isDev ? 'debug' : 'error'),
  writeToConsole: !app.commandLine.hasSwitch('log-no-print'),
  writeToDisk: app.commandLine.hasSwitch('log-write'),
  outputFile:
    app.commandLine.getSwitchValue('log-file') || loggerDefaults.outputFile,
  outputPath:
    app.commandLine.getSwitchValue('log-path') || loggerDefaults.outputPath,
};

const logger = new Logger(log.level as LogLevel, { ...log });

global.logger = logger;
global.resourcesPath = isDev
  ? path.join(__dirname, '..', 'public', 'static')
  : process.resourcesPath;
const staticPath = path.join(__dirname, '..', 'public', 'static');
const preloadJsUrl = path.join(staticPath, 'preload.js'); // static path

async function createMainWindow() {
  const browserWindow = new BrowserWindow({
    title: APP_NAME,
    titleBarStyle: 'hidden',
    resizable: false,
    width: 1600,
    height: 900,
    webPreferences: {
      webviewTag: true,
      webSecurity: !isDev,
      nativeWindowOpen: true,
      allowRunningInsecureContent: isDev,
      // webview injected js needs isolation=false, because property can not be exposeInMainWorld() when isolation enabled.
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(global.resourcesPath, 'images', 'icons', '512x512.png'),
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

  browserWindow.loadURL(src);

  browserWindow.webContents.on('did-finish-load', () => {
    browserWindow.webContents.send('SET_ONEKEY_DESKTOP_GLOBALS', {
      resourcesPath: global.resourcesPath,
      staticPath: `file://${staticPath}`,
      preloadJsUrl: `file://${preloadJsUrl}`,
    });
  });

  browserWindow.on('closed', () => {
    mainWindow = null;
  });

  browserWindow.webContents.on('devtools-opened', () => {
    browserWindow.focus();
    setImmediate(() => {
      browserWindow.focus();
    });
  });

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  ipcMain.on('app/reload', () => {
    app.relaunch();
    app.exit(0);
  });

  // Modules
  await modules({
    mainWindow: browserWindow,
    src,
    store,
  });

  return browserWindow;
}

// https://www.electronjs.org/docs/all#apprequestsingleinstancelock
const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance && !process.mas) {
  logger.warn('main', 'Second instance detected, quitting...');
  app.quit();
} else {
  logger.info('main', 'Application starting');

  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.name = APP_NAME; // overrides @onekey/desktop app name in menu
  app.on('ready', async () => {
    mainWindow = await createMainWindow();
  });
}

app.on('activate', async () => {
  if (mainWindow === null) {
    mainWindow = await createMainWindow();
  }
});

app.on('before-quit', () => {
  if (!mainWindow) return;
  mainWindow.removeAllListeners();
  logger.exit();
});
