import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { format as formatUrl } from 'url';
import isDev from 'electron-is-dev';

import Logger, {
  LogLevel,
  defaultOptions as loggerDefaults,
} from './libs/logger';
import modules from './libs/modules';
import * as store from './libs/store';

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
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

async function createMainWindow() {
  const browserWindow = new BrowserWindow({
    frame: true, // show title
    // icon: null,
    webPreferences: {
      webviewTag: true,
      webSecurity: !isDevelopment,
      nativeWindowOpen: true,
      allowRunningInsecureContent: isDevelopment,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: true,

      // https://www.electronjs.org/docs/latest/tutorial/context-isolation
      contextIsolation: false, // TODO remove
      // @ts-ignore
      enableRemoteModule: false,

      // isIpcReady will check by this
      preload: path.join(__dirname, '../public/static/preload.js'), // static path
    },
  });

  if (isDevelopment) {
    browserWindow.webContents.openDevTools();
  }

  const src = isDevelopment
    ? 'http://localhost:8000/'
    : formatUrl({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file',
        slashes: true,
      });

  browserWindow.loadURL(src);

  browserWindow.webContents.on('did-finish-load', () => {
    // browserWindow.webContents.send('inject/path', 'success');
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

  // Modules
  await modules({
    mainWindow: browserWindow,
    src,
    store,
  });

  return browserWindow;
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = await createMainWindow();
  }
});

// create main BrowserWindow when electron is ready
app.on('ready', async () => {
  mainWindow = await createMainWindow();
});
