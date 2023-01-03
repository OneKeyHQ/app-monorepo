/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EventEmitter } from 'events';
import { createServer } from 'http';
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
import contextMenu from 'electron-context-menu';
import isDev from 'electron-is-dev';
import logger from 'electron-log';
import { address } from 'ip';
// eslint-disable-next-line @typescript-eslint/no-unused-vars

import * as store from './libs/store';
import initProcess, { restartBridge } from './process/index';

import type { PrefType } from './preload';
import type { Server, ServerResponse } from 'http';

const ONEKEY_APP_DEEP_LINK_NAME = 'onekey-wallet';
const WALLET_CONNECT_DEEP_LINK_NAME = 'wc';

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

// https://github.com/sindresorhus/electron-context-menu
const disposeContextMenu = contextMenu({
  showSaveImageAs: true,
});

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

const emitter = new EventEmitter();
let isAppReady = false;
function handleDeepLinkUrl(
  event: Event | null,
  url: string,
  argv?: string[],
  isColdStartup?: boolean,
) {
  const eventData: IDesktopOpenUrlEventData = {
    url,
    argv,
    isColdStartup,
    platform: process.platform,
  };

  console.log('handleDeepLinkUrl >>>> ', eventData);

  const sendEventData = () => {
    isAppReady = true;
    if (mainWindow) {
      showMainWindow();
      if (process.env.NODE_ENV !== 'production') {
        mainWindow.webContents.send('OPEN_URL_DEEP_LINK_MESSAGE', eventData);
      }
      mainWindow.webContents.send('event-open-url', eventData);
    }
  };
  if (isAppReady && mainWindow) {
    sendEventData();
  } else {
    emitter.once('ready', () => sendEventData());
  }

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

  // Protocol handler for win32
  if (isWin || isMac) {
    // Keep only command line / deep linked arguments
    const deeplinkingUrl = process.argv[1];
    handleDeepLinkUrl(null, deeplinkingUrl, process.argv, true);
  }

  browserWindow.webContents.on('did-finish-load', () => {
    console.log('browserWindow >>>> did-finish-load');
    browserWindow.webContents.send('SET_ONEKEY_DESKTOP_GLOBALS', {
      resourcesPath: (global as any).resourcesPath,
      staticPath: `file://${staticPath}`,
      preloadJsUrl: `file://${preloadJsUrl}?timestamp=${Date.now()}`,
    });
  });

  browserWindow.on('resize', () => {
    config?.set(configKeys.winBounds, browserWindow.getBounds());
  });
  browserWindow.on('closed', () => {
    mainWindow = null;
    isAppReady = false;
    console.log('set isAppReady on browserWindow closed', isAppReady);
  });

  browserWindow.webContents.on('devtools-opened', () => {
    browserWindow.focus();
    setImmediate(() => {
      browserWindow.focus();
    });
  });

  // dom-ready is fired after ipcMain:app/ready
  browserWindow.webContents.on('dom-ready', () => {
    isAppReady = true;
    console.log('set isAppReady on browserWindow dom-ready', isAppReady);
  });

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  ipcMain.on('app/ready', () => {
    isAppReady = true;
    console.log('set isAppReady on ipcMain app/ready', isAppReady);
    emitter.emit('ready');
  });
  ipcMain.on('app/reload', () => {
    if (!process.mas) {
      app.relaunch();
    }
    app.exit(0);
    disposeContextMenu();
  });
  ipcMain.on('app/focus', () => {
    showMainWindow();
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
      event.reply('app/promptTouchID/res', { success: true });
    } catch (e: any) {
      event.reply('app/promptTouchID/res', {
        success: false,
        error: e.message,
      });
    }
  });

  ipcMain.on('app/reloadBridgeProcess', (event) => {
    logger.debug('reloadBridgeProcess receive');
    restartBridge();
    event.reply('app/reloadBridgeProcess', true);
  });

  ipcMain.on('app/restoreMainWindow', (event) => {
    logger.debug('restoreMainWindow receive');
    browserWindow.show();
    event.reply('app/restoreMainWindow', true);
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
    urls: [
      'http://127.0.0.1:21320/*',
      'http://localhost:21320/*',
      'https://mainnet.optimism.io/*',
    ],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(
    filter,
    (details, callback) => {
      const { url } = details;
      if (
        url.startsWith('http://127.0.0.1:21320') ||
        url.startsWith('http://localhost:21320')
      ) {
        // resolve onekey bridge CORS error
        details.requestHeaders.Origin = 'https://jssdk.onekey.so';
      } else if (url.startsWith('https://mainnet.optimism.io')) {
        // add metamask header to resolve rate-limit
        details.requestHeaders.Origin =
          'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn';
      }

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
    browserWindow.webContents.on(
      'did-fail-load',
      (_, __, ___, validatedURL) => {
        const redirectPath = validatedURL.replace(`${PROTOCOL}://`, '');
        if (validatedURL.startsWith(PROTOCOL) && !redirectPath.includes('.')) {
          browserWindow.loadURL(src);
        }
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

  let server: Server;

  const resMap: Record<string, ServerResponse> = {};
  ipcMain.on('server/start', (event, port: number) => {
    try {
      if (!server) {
        server = createServer({ keepAlive: true }, (req, res) => {
          // console.log('http req = ', req);
          event.reply('server/listener', {
            requestId: '123456',
            type: req.method,
            url: req.url,
          });
          resMap['123456'] = res;
          // res.writeHead(200);
          // res.end('hello world\n');
        });
      }

      if (!server.listening) {
        server.listen(port);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const ipAddress = address();
      event.reply('server/start/res', {
        data: `${ipAddress as string}:${port}`,
        success: true,
      });
    } catch (e: any) {
      event.reply('server/start/res', { success: false });
    }
  });

  ipcMain.on('server/respond', (_, args) => {
    const { requestId, code, type, body } = args;
    const res = resMap[requestId];
    if (res) {
      res.writeHead(200);
      res.end(body);
    }
  });

  ipcMain.on('server/stop', () => {
    server.close();
  });

  return browserWindow;
}

function init() {
  initProcess({ mainWindow: mainWindow as BrowserWindow, store });
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

      // Protocol handler for win32
      // argv: An array of the second instance’s (command line / deep linked) arguments
      if (isWin || isMac) {
        // Keep only command line / deep linked arguments
        const deeplinkingUrl = argv[1];
        handleDeepLinkUrl(null, deeplinkingUrl, argv, true);
      }
    }
  });

  app.name = APP_NAME;
  app.on('ready', () => {
    if (!mainWindow) {
      mainWindow = createMainWindow();
    }
    init();
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
  disposeContextMenu();
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
      // reassign args to argv[1]  ?
      [path.resolve(process.argv[1])],
    );
  }
} else {
  app.setAsDefaultProtocolClient(ONEKEY_APP_DEEP_LINK_NAME);
}
if (!app.isDefaultProtocolClient(WALLET_CONNECT_DEEP_LINK_NAME)) {
  // Define custom protocol handler. Deep linking works on packaged versions of the application!
  app.setAsDefaultProtocolClient(WALLET_CONNECT_DEEP_LINK_NAME);
}
// also define `protocols` at packages/desktop/electron-builder.config.js
if (!app.isDefaultProtocolClient(ONEKEY_APP_DEEP_LINK_NAME)) {
  // Define custom protocol handler. Deep linking works on packaged versions of the application!
  app.setAsDefaultProtocolClient(ONEKEY_APP_DEEP_LINK_NAME);
}

if (isWin) {
  app.setAppUserModelId(APP_NAME);
}

// https://github.com/oikonomopo/electron-deep-linking-mac-win/blob/master/main.js
app.on('will-finish-launching', () => {
  // app.off('open-url', handleDeepLinkUrl);
  // ** Protocol handler for osx
  // deeplink: Handle the protocol. In this case, we choose to show an Error Box.
  app.on('open-url', handleDeepLinkUrl);
});

console.log(' ========= Desktop main app start!!!!!!!!!!!!!  ========== ');
