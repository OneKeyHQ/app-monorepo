/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EventEmitter } from 'events';
import os from 'os';
import * as path from 'path';
import { format as formatUrl } from 'url';

import {
  BrowserWindow,
  Menu,
  app,
  ipcMain,
  screen,
  session,
  shell,
  systemPreferences,
} from 'electron';
import contextMenu from 'electron-context-menu';
import isDev from 'electron-is-dev';
import logger from 'electron-log';

// eslint-disable-next-line @typescript-eslint/no-unused-vars

import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import {
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
} from '@onekeyhq/shared/src/walletConnect/constant';

import { ipcMessageKeys } from './config';
import { registerShortcuts, unregisterShortcuts } from './libs/shortcuts';
import * as store from './libs/store';
import initProcess, { restartBridge } from './process';

import type { IPrefType } from './preload';

// https://github.com/sindresorhus/electron-context-menu
const disposeContextMenu = contextMenu({
  showSaveImageAs: true,
});

const APP_NAME = 'OneKey Wallet';
app.name = APP_NAME;
let mainWindow: BrowserWindow | null;

(global as any).resourcesPath = isDev
  ? path.join(__dirname, '../public/static')
  : process.resourcesPath;
const staticPath = isDev
  ? path.join(__dirname, '../public/static')
  : path.join((global as any).resourcesPath, 'static');
// static path
const preloadJsUrl = path.join(staticPath, 'preload.js');

const sdkConnectSrc = isDev
  ? `file://${path.join(staticPath, 'js-sdk/')}`
  : path.join('/static', 'js-sdk/');

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

const template = [
  // { role: 'appMenu' },
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
      ]
    : []),
  { role: 'editMenu' },
  { role: 'viewMenu' },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac
        ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' },
            {
              label: 'OneKey',
              click: showMainWindow,
              accelerator: 'CmdOrCtrl+O',
            },
          ]
        : [{ role: 'close' }]),
    ],
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          await shell.openExternal('https://onekey.so');
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template as any);
Menu.setApplicationMenu(menu);

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
        mainWindow.webContents.send(
          ipcMessageKeys.OPEN_DEEP_LINK_URL,
          eventData,
        );
      }
      mainWindow.webContents.send(ipcMessageKeys.EVENT_OPEN_URL, eventData);
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

function clearWebData() {
  return session.defaultSession.clearStorageData({
    storages: ['cookies'],
  });
}

function createMainWindow() {
  const display = screen.getPrimaryDisplay();
  const dimensions = display.workAreaSize;
  const ratio = 16 / 9;
  const savedWinBounds: any = store.getWinBounds();
  const browserWindow = new BrowserWindow({
    title: APP_NAME,
    titleBarStyle: isWin ? 'default' : 'hidden',
    trafficLightPosition: { x: 20, y: 18 },
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
      sandbox: false,
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

  void browserWindow.loadURL(src);

  // Protocol handler for win32
  if (isWin || isMac) {
    // Keep only command line / deep linked arguments
    const deeplinkingUrl = process.argv[1];
    handleDeepLinkUrl(null, deeplinkingUrl, process.argv, true);
  }

  browserWindow.webContents.on('did-finish-load', () => {
    console.log('browserWindow >>>> did-finish-load');
    browserWindow.webContents.send(ipcMessageKeys.SET_ONEKEY_DESKTOP_GLOBALS, {
      resourcesPath: (global as any).resourcesPath,
      staticPath: `file://${staticPath}`,
      preloadJsUrl: `file://${preloadJsUrl}?timestamp=${Date.now()}`,
      sdkConnectSrc,
    });
  });

  browserWindow.on('resize', () => {
    store.setWinBounds(browserWindow.getBounds());
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
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  ipcMain.on(ipcMessageKeys.APP_READY, () => {
    isAppReady = true;
    console.log('set isAppReady on ipcMain app/ready', isAppReady);
    emitter.emit('ready');
  });
  ipcMain.on(ipcMessageKeys.APP_READY, () => {
    if (!process.mas) {
      app.relaunch();
    }
    app.exit(0);
    disposeContextMenu();
  });
  ipcMain.on(ipcMessageKeys.APP_FOCUS, () => {
    showMainWindow();
  });
  ipcMain.on(ipcMessageKeys.APP_QUIT, () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    quitOrMinimizeApp();
  });
  ipcMain.on(ipcMessageKeys.APP_RELOAD, () => {
    browserWindow.reload();
  });

  ipcMain.on(
    ipcMessageKeys.APP_OPEN_PREFERENCES,
    (_event, prefType: IPrefType) => {
      const platform = os.type();
      if (platform === 'Darwin') {
        void shell.openPath(
          '/System/Library/PreferencePanes/Security.prefPane',
        );
      } else if (platform === 'Windows_NT') {
        // ref https://docs.microsoft.com/en-us/windows/uwp/launch-resume/launch-settings-app
        if (prefType === 'camera') {
          void shell.openExternal('ms-settings:privacy-webcam');
        }
        // BlueTooth is not supported on desktop currently
      } else {
        // Linux ??
      }
    },
  );

  ipcMain.on(ipcMessageKeys.APP_TOGGLE_MAXIMIZE_WINDOW, () => {
    if (browserWindow.isMaximized()) {
      // Restore the original window size
      browserWindow.unmaximize();
    } else {
      // Maximized window
      browserWindow.maximize();
    }
  });

  ipcMain.on(ipcMessageKeys.TOUCH_ID_CAN_PROMPT, (event) => {
    const result = systemPreferences?.canPromptTouchID?.();
    event.returnValue = !!result;
  });

  ipcMain.on(ipcMessageKeys.TOUCH_ID_PROMPT, async (event, msg: string) => {
    try {
      await systemPreferences.promptTouchID(msg);
      event.reply(ipcMessageKeys.TOUCH_ID_PROMPT_RES, { success: true });
    } catch (e: any) {
      event.reply(ipcMessageKeys.TOUCH_ID_PROMPT_RES, {
        success: false,
        error: e.message,
      });
    }
  });

  ipcMain.on(
    ipcMessageKeys.SECURE_SET_ITEM_ASYNC,
    (event, { key, value }: { key: string; value: string }) => {
      store.setSecureItem(key, value);
      event.returnValue = '';
    },
  );

  ipcMain.on(
    ipcMessageKeys.SECURE_GET_ITEM_ASYNC,
    (event, { key }: { key: string }) => {
      const value = store.getSecureItem(key);
      event.returnValue = value;
    },
  );

  ipcMain.on(
    ipcMessageKeys.SECURE_DEL_ITEM_ASYNC,
    (event, { key }: { key: string }) => {
      store.deleteSecureItem(key);
      event.returnValue = '';
    },
  );

  ipcMain.on(ipcMessageKeys.APP_RELOAD_BRIDGE_PROCESS, (event) => {
    logger.debug('reloadBridgeProcess receive');
    void restartBridge();
    event.reply(ipcMessageKeys.APP_RELOAD_BRIDGE_PROCESS, true);
  });

  ipcMain.on(ipcMessageKeys.APP_RESTORE_MAIN_WINDOW, (event) => {
    logger.debug('restoreMainWindow receive');
    browserWindow.show();
    event.reply(ipcMessageKeys.APP_RESTORE_MAIN_WINDOW, true);
  });

  ipcMain.on(ipcMessageKeys.APP_CLEAR_WEBVIEW_DATA, () => {
    void clearWebData();
  });

  // reset appState to undefined  to avoid screen lock.
  browserWindow.on('enter-full-screen', () => {
    browserWindow.webContents.send(ipcMessageKeys.APP_STATE, undefined);
  });

  // reset appState to undefined  to avoid screen lock.
  browserWindow.on('leave-full-screen', () => {
    browserWindow.webContents.send(ipcMessageKeys.APP_STATE, undefined);
  });

  browserWindow.on('focus', () => {
    browserWindow.webContents.send(ipcMessageKeys.APP_STATE, 'active');
    registerShortcuts((event) => {
      browserWindow.webContents.send(ipcMessageKeys.APP_SHORCUT, event);
    });
  });

  browserWindow.on('blur', () => {
    browserWindow.webContents.send(ipcMessageKeys.APP_STATE, 'blur');
    unregisterShortcuts();
  });

  browserWindow.on('hide', () => {
    browserWindow.webContents.send(ipcMessageKeys.APP_STATE, 'background');
    unregisterShortcuts();
  });

  // Prevents clicking on links to open new Windows
  app.on('web-contents-created', (event, contents) => {
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(() => ({ action: 'deny' }));
      contents.on('will-frame-navigate', (e) => {
        const { url } = e;
        const { action } = uriUtils.parseDappRedirect(url);
        if (action === uriUtils.EDAppOpenActionEnum.DENY) {
          e.preventDefault();
          console.log(
            '====>>>>>>>reject navigate main process will-frame-navigate: ',
            url,
          );
          return false;
        }
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
        url.startsWith('http://127.0.0.1:21320/') ||
        url.startsWith('http://localhost:21320/')
      ) {
        // resolve onekey bridge CORS error
        details.requestHeaders.Origin = 'https://jssdk.onekey.so';
      } else if (url.startsWith('https://mainnet.optimism.io/')) {
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
        const isJsSdkFile = request.url.indexOf('/static/js-sdk') > -1;
        const isIFrameHtml =
          request.url.indexOf('/static/js-sdk/iframe.html') > -1;

        // resolve iframe path
        if (isJsSdkFile && isIFrameHtml) {
          callback({
            path: path.join(
              __dirname,
              '..',
              'build',
              'static',
              'js-sdk',
              'iframe.html',
            ),
          });
          return;
        }

        // move to parent folder
        let url = request.url.substr(PROTOCOL.length + 1);
        url = path.join(__dirname, '..', 'build', url);
        callback(url);
      },
    );
    browserWindow.webContents.on(
      'did-fail-load',
      (_, __, ___, validatedURL) => {
        const redirectPath = validatedURL.replace(`${PROTOCOL}://`, '');
        if (validatedURL.startsWith(PROTOCOL) && !redirectPath.includes('.')) {
          void browserWindow.loadURL(src);
        }
      },
    );
  }

  // @ts-expect-error
  browserWindow.on('close', (event: Event) => {
    // hide() instead of close() on MAC
    if (isMac) {
      event.preventDefault();
      if (!browserWindow.isDestroyed()) {
        browserWindow.blur();
        browserWindow.hide(); // hide window only
        // browserWindow.minimize(); // hide window and minimize to Docker
      }
    }
  });

  return browserWindow;
}

function initChildProcess() {
  return initProcess({ mainWindow: mainWindow as BrowserWindow, store });
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
  app.on('ready', async () => {
    if (!mainWindow) {
      mainWindow = createMainWindow();
    }
    void initChildProcess();
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
// also define `protocols` at apps/desktop/electron-builder.config.js
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
  // @ts-expect-error
  app.on('open-url', handleDeepLinkUrl);
});

console.log(' ========= Desktop main app start!!!!!!!!!!!!!  ========== ');
