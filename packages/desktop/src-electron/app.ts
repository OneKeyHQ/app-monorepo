/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import os from 'os';
import * as path from 'path';
import { format as formatUrl } from 'url';

import {
  BrowserWindow,
  app,
  ipcMain,
  screen,
  session,
  shell,
  systemPreferences,
} from 'electron';
import Config from 'electron-config';
import isDev from 'electron-is-dev';
import logger from 'electron-log';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { isString } from 'lodash';

import initProcess, { restartBridge } from './process/index';

import type { PrefType } from './preload';

const ONEKEY_APP_DEEP_LINK_NAME = 'onekey-wallet';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const config = new Config() as
  | {
      set: (key: string, data: any) => void;
      get: (key: string) => any;
    }
  | undefined;
const configKeys = {
  winBounds: 'winBounds',
};

const APP_NAME = 'OneKey Wallet';
let mainWindow: BrowserWindow | null;

(global as any).resourcesPath = isDev
  ? path.join(__dirname, '../public/static')
  : process.resourcesPath;
const staticPath = isDev
  ? path.join(__dirname, '../public/static')
  : path.join((global as any).resourcesPath, 'static');
// static path
const preloadJsUrl = path.join(staticPath, 'preload.js');

const isMac = process.platform === 'darwin';

function handleDeepLinkUrl(event: Event | null, url: string, argv?: string[]) {
  if (!mainWindow) {
    return;
  }

  // TODO wait delay for kit app initialized ?
  //      or renderer emit kit ui ready event?
  setTimeout(() => {
    if (mainWindow) {
      mainWindow.webContents.send('event-open-url', { url, argv });
    }
  }, 1000);

  if (event) {
    event?.preventDefault();
  }
}

function createMainWindow() {
  const display = screen.getPrimaryDisplay();
  const dimensions = display.workAreaSize;
  const ratio = 16 / 9;
  const savedWinBounds = config?.get(configKeys.winBounds) || {};
  const browserWindow = new BrowserWindow({
    title: APP_NAME,
    titleBarStyle: process.platform === 'win32' ? 'default' : 'hidden',
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
      webviewTag: true,
      webSecurity: !isDev,
      nativeWindowOpen: true,
      allowRunningInsecureContent: isDev,
      // webview injected js needs isolation=false, because property can not be exposeInMainWorld() when isolation enabled.
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(staticPath, 'images/icons/512x512.png'),
    ...savedWinBounds,
  });

  // browserWindow.setAspectRatio(ratio);

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
      resourcesPath: (global as any).resourcesPath,
      staticPath: `file://${staticPath}`,
      preloadJsUrl: `file://${preloadJsUrl}?timestamp=${Date.now()}`,
    });

    // Protocol handler for win32
    if (process.platform === 'win32') {
      // Keep only command line / deep linked arguments
      const deeplinkingUrl = process.argv[1];
      handleDeepLinkUrl(null, deeplinkingUrl, process.argv);
    }

    // TODO app.on('will-finish-launching',
    // deeplink: Handle the protocol. In this case, we choose to show an Error Box.
    app.off('open-url', handleDeepLinkUrl);
    app.on('open-url', handleDeepLinkUrl);
  });

  browserWindow.on('resize', () => {
    config?.set(configKeys.winBounds, browserWindow.getBounds());
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

  ipcMain.on('app/openPrefs', (_event, prefType: PrefType) => {
    const platform = os.type();
    if (platform === 'Darwin') {
      shell.openPath('/System/Library/PreferencePanes/Security.prefPane');
    } else if (platform === 'Windows_NT') {
      // ref https://docs.microsoft.com/en-us/windows/uwp/launch-resume/launch-settings-app
      if (prefType === 'camera') {
        shell.openExternal('ms-settings:privacy-webcam');
      }
      // BlueTooth is not supported on desktop currently
    } else {
      // Linux ??
    }
  });

  ipcMain.on('app/toggleMaximizeWindow', () => {
    if (browserWindow.isMaximized()) {
      // Restore the original window size
      browserWindow.unmaximize();
    } else {
      // Maximized window
      browserWindow.maximize();
    }
  });

  ipcMain.on('app/canPromptTouchID', (event) => {
    const result = systemPreferences?.canPromptTouchID?.();
    event.returnValue = !!result;
  });

  ipcMain.on('app/promptTouchID', async (event, msg: string) => {
    try {
      await systemPreferences.promptTouchID(msg);
      event.reply('app/promptTouchID/res', true);
    } catch {
      event.reply('app/promptTouchID/res', false);
    }
  });

  ipcMain.on('app/reloadBridgeProcess', (event) => {
    logger.debug('reloadBridgeProcess receive');
    restartBridge();
    event.reply('app/reloadBridgeProcess', true);
  });

  // reset appState to undefined  to avoid screen lock.
  browserWindow.on('enter-full-screen', () => {
    browserWindow.webContents.send('appState', undefined);
  });

  // reset appState to undefined  to avoid screen lock.
  browserWindow.on('leave-full-screen', () => {
    browserWindow.webContents.send('appState', undefined);
  });

  browserWindow.on('show', () => {
    browserWindow.webContents.send('appState', 'active');
  });

  browserWindow.on('hide', () => {
    browserWindow.webContents.send('appState', 'background');
  });

  // Prevents clicking on links to open new Windows
  app.on('web-contents-created', (event, contents) => {
    if (contents.getType() === 'webview') {
      contents.on('new-window', (newWindowEvent: Event) => {
        newWindowEvent.preventDefault();
      });
    }
  });

  const filter = {
    urls: ['http://127.0.0.1:21320/*', 'http://localhost:21320/*'],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(
    filter,
    (details, callback) => {
      /**
       * temporary solution to switch origin when the sdk iframe src is modified in development mode.
       */
      const origin =
        // @ts-expect-error
        details?.frame?.url?.indexOf('hardware-sdk.test.onekey.so') > -1
          ? 'https://hardware-sdk.test.onekey.so'
          : 'https://jssdk.onekey.so';
      // @ts-ignore electron declares requestHeaders as an empty interface
      details.requestHeaders.Origin = origin;

      callback({ cancel: false, requestHeaders: details.requestHeaders });
    },
  );

  if (!isDev) {
    const PROTOCOL = 'file';
    session.defaultSession.protocol.interceptFileProtocol(
      PROTOCOL,
      (request, callback) => {
        let url = request.url.substr(PROTOCOL.length + 1);
        // move to parent folder
        url = path.join(__dirname, '..', 'build', url);
        callback(url);
      },
    );
  }

  browserWindow.on('close', (event: Event) => {
    // hide() instead of close() on MAC
    if (isMac) {
      event.preventDefault();
      if (!browserWindow.isDestroyed()) {
        browserWindow.hide();
        // browserWindow.minimize();
      }
    }
  });

  return browserWindow;
}

function init() {
  initProcess();
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
      mainWindow.show();
      mainWindow.focus();

      // Protocol handler for win32
      // argv: An array of the second instance’s (command line / deep linked) arguments
      if (process.platform === 'win32') {
        // Keep only command line / deep linked arguments
        const deeplinkingUrl = argv[1];
        handleDeepLinkUrl(null, deeplinkingUrl, argv);
      }
    }
  });

  app.name = APP_NAME;
  app.on('ready', () => {
    if (!mainWindow) {
      init();
      mainWindow = createMainWindow();
    }
    mainWindow.show();
  });
}

app.on('activate', () => {
  if (!mainWindow) {
    mainWindow = createMainWindow();
  }
  mainWindow.show();
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

if (isDev) {
  app.commandLine.appendSwitch('ignore-certificate-errors');
  app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
  app.commandLine.appendSwitch('disable-site-isolation-trials');
}

// register deeplink for desktop
//  https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(
      ONEKEY_APP_DEEP_LINK_NAME,
      process.execPath,
      [path.resolve(process.argv[1])],
    );
  }
} else {
  app.setAsDefaultProtocolClient(ONEKEY_APP_DEEP_LINK_NAME);
}
if (!app.isDefaultProtocolClient(ONEKEY_APP_DEEP_LINK_NAME)) {
  // Define custom protocol handler. Deep linking works on packaged versions of the application!
  app.setAsDefaultProtocolClient(ONEKEY_APP_DEEP_LINK_NAME);
}
