/* eslint-disable dot-notation */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EventEmitter } from 'events';
import path from 'path';
import { format as formatUrl } from 'url';

import { initNobleBleSupport } from '@onekeyfe/hd-transport-electron';
import {
  attachTitlebarToWindow,
  setupTitlebar,
} from 'custom-electron-titlebar/main';
import {
  BrowserWindow,
  Menu,
  app,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inAppPurchase,
  ipcMain,
  nativeTheme,
  powerMonitor,
  session,
  shell,
} from 'electron';
import contextMenu from 'electron-context-menu';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';

import { getTemplatePhishingUrls } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import desktopApi from '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApi';
import {
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IDesktopAppState } from '@onekeyhq/shared/types/desktop';

import {
  checkFileHash,
  checkFileSha512,
  getBundleDirPath,
  getBundleIndexHtmlPath,
  getDriveLetter,
  getMetadata,
} from './bundle';
import { ipcMessageKeys } from './config';
import { ElectronTranslations, i18nText, initLocale } from './i18n';
import { registerShortcuts, unregisterShortcuts } from './libs/shortcuts';
import * as store from './libs/store';
import initProcess from './process';
import {
  getAppStaticResourcesPath,
  getResourcesPath,
  getStaticPath,
} from './resoucePath';
import { initSentry } from './sentry';
import { startServices } from './service';
import { setMainWindow } from './service/oauthLocalServer/oauthLocalServer';

logger.initialize();
logger.transports.file.maxSize = 1024 * 1024 * 10;

initSentry();

// https://github.com/sindresorhus/electron-context-menu
let disposeContextMenu: ReturnType<typeof contextMenu> | undefined;

globalThis.$desktopMainAppFunctions = {
  getBundleIndexHtmlPath: () => {
    const bundleData = store.getUpdateBundleData();
    logger.info('bundleData >>>> ', bundleData);
    if (!bundleData) {
      return undefined;
    }
    return getBundleIndexHtmlPath({
      appVersion: bundleData.appVersion,
      bundleVersion: bundleData.bundleVersion,
    });
  },
  useJsBundle: () => {
    const bundleData = store.getUpdateBundleData();
    if (!bundleData) {
      return false;
    }
    return !!getBundleIndexHtmlPath({
      appVersion: bundleData.appVersion,
      bundleVersion: bundleData.bundleVersion,
    });
  },
} as typeof globalThis.$desktopMainAppFunctions;

// WARNING: This name cannot be changed as it affects Electron data storage.
// Changing it will cause the system to generate new storage, preventing users from accessing their existing data.
const APP_NAME = 'OneKey Wallet';
const APP_TITLE_NAME = 'OneKey';
app.name = APP_NAME;
let mainWindow: BrowserWindow | null;

const appStaticResourcesPath = getAppStaticResourcesPath();
const staticPath = getStaticPath();
const resourcesPath = getResourcesPath();
// static path
// const preloadJsUrl = path.join(staticPath, 'preload.js');
// const preloadJsUrl = path.join(staticPath, 'preload-webview-test.js');

const sdkConnectSrc = isDev
  ? `file://${path.join(staticPath, 'js-sdk/')}`
  : path.join('/static', 'js-sdk/');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

if (!isMac) {
  setupTitlebar();
}

let systemIdleInterval: ReturnType<typeof setInterval>;

export type IDesktopOpenUrlEventData = {
  url?: string;
  argv?: string[];
  isColdStartup?: boolean;
  platform?: string;
};

const getSafelyMainWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }
  return undefined;
};

function showMainWindow() {
  const safelyMainWindow = getSafelyMainWindow();
  safelyMainWindow?.show();
  safelyMainWindow?.focus();
}

const initMenu = () => {
  const template = [
    {
      label: APP_TITLE_NAME,
      submenu: [
        {
          role: isMac ? 'about' : undefined,
          label: i18nText(ElectronTranslations.menu_about_onekey_wallet),
          click: isMac
            ? undefined
            : () => {
                const safelyMainWindow = getSafelyMainWindow();
                if (safelyMainWindow) {
                  safelyMainWindow.webContents.send(
                    ipcMessageKeys.SHOW_ABOUT_WINDOW,
                  );
                }
              },
        },
        { type: 'separator' },
        !process.mas && {
          label: i18nText(ElectronTranslations.menu_check_for_updates),
          click: () => {
            showMainWindow();
            const safelyMainWindow = getSafelyMainWindow();
            safelyMainWindow?.webContents.send(
              ipcMessageKeys.CHECK_FOR_UPDATES,
            );
          },
        },
        { type: 'separator' },
        {
          label: i18nText(ElectronTranslations.menu_preferences),
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const safelyMainWindow = getSafelyMainWindow();
            const visible = !!safelyMainWindow?.isVisible();
            logger.info('APP_OPEN_SETTINGS visible >>>> ', visible);
            showMainWindow();
            safelyMainWindow?.webContents.send(
              ipcMessageKeys.APP_OPEN_SETTINGS,
              visible,
            );
          },
        },
        { type: 'separator' },
        {
          label: i18nText(ElectronTranslations.menu_lock_now),
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            showMainWindow();
            const safelyMainWindow = getSafelyMainWindow();
            if (safelyMainWindow) {
              safelyMainWindow.webContents.send(ipcMessageKeys.APP_LOCK_NOW);
            }
          },
        },
        { type: 'separator' },
        isMac && {
          role: 'hide',
          accelerator: 'Alt+CmdOrCtrl+H',
          label: i18nText(ElectronTranslations.menu_hide_onekey_wallet),
        },
        isMac && {
          role: 'unhide',
          label: i18nText(ElectronTranslations.menu_show_all),
        },
        { type: 'separator' },
        {
          role: 'quit',
          accelerator: 'CmdOrCtrl+Q',
          label: i18nText(ElectronTranslations.menu_quit_onekey_wallet),
        },
      ].filter(Boolean),
    },
    {
      label: i18nText(ElectronTranslations.global_edit),
      submenu: [
        { role: 'undo', label: i18nText(ElectronTranslations.menu_undo) },
        { role: 'redo', label: i18nText(ElectronTranslations.menu_redo) },
        { type: 'separator' },
        { role: 'cut', label: i18nText(ElectronTranslations.menu_cut) },
        { role: 'copy', label: i18nText(ElectronTranslations.global_copy) },
        { role: 'paste', label: i18nText(ElectronTranslations.menu_paste) },
        { type: 'separator' },
        {
          role: 'delete',
          label: i18nText(ElectronTranslations.global_delete),
        },
        {
          role: 'selectAll',
          label: i18nText(ElectronTranslations.menu_select_all),
        },
      ],
    },
    {
      label: i18nText(ElectronTranslations.menu_view),
      submenu: [
        ...(isDev || store.getDevTools()
          ? [
              { role: 'reload' },
              { role: 'forceReload' },
              { role: 'toggleDevTools' },
              isDev
                ? {
                    role: 'toggleDevTools',
                    label: `Toggle DevTools: ${store.getDevTools().toString()}`,
                  }
                : null,
              { type: 'separator' },
            ].filter(Boolean)
          : []),
        {
          role: 'resetZoom',
          label: i18nText(ElectronTranslations.menu_actual_size),
          accelerator: 'CmdOrCtrl+0',
        },
        isMac
          ? {
              role: 'zoomIn',
              label: i18nText(ElectronTranslations.menu_zoom_in),
            }
          : {
              role: 'zoomIn',
              label: i18nText(ElectronTranslations.menu_zoom_in),
              accelerator: 'CmdOrCtrl+Shift+]',
            },
        {
          role: 'zoomOut',
          label: i18nText(ElectronTranslations.menu_zoom_out),
          accelerator: isMac ? 'CmdOrCtrl+-' : 'CmdOrCtrl+Shift+[',
        },
        { type: 'separator' },
        {
          role: 'togglefullscreen',
          label: i18nText(ElectronTranslations.menu_toggle_full_screen),
        },
      ],
    },
    {
      label: i18nText(ElectronTranslations.menu_window),
      submenu: [
        {
          role: 'minimize',
          label: i18nText(ElectronTranslations.menu_minimize),
        },
        isMac && {
          role: 'zoom',
          label: i18nText(ElectronTranslations.menu_zoom),
        },
        ...(isMac
          ? [
              { type: 'separator' },
              {
                role: 'front',
                label: i18nText(ElectronTranslations.menu_bring_all_to_front),
              },
              { type: 'separator' },
              {
                label: i18nText(ElectronTranslations.menu_window),
                click: () => {
                  showMainWindow();
                },
              },
            ]
          : []),
      ].filter(Boolean),
    },
    {
      role: 'help',
      label: i18nText(ElectronTranslations.menu_help),
      submenu: [
        {
          label: i18nText(ElectronTranslations.menu_visit_help_center),
          click: async () => {
            await shell.openExternal('https://help.onekey.so');
          },
        },
        { type: 'separator' },
        {
          label: i18nText(ElectronTranslations.menu_official_website),
          click: async () => {
            await shell.openExternal('https://onekey.so');
          },
        },
        {
          label: 'Github',
          click: async () => {
            await shell.openExternal(
              'https://github.com/OneKeyHQ/app-monorepo',
            );
          },
        },
        {
          label: 'X',
          click: async () => {
            await shell.openExternal('https://x.com/onekeyhq');
          },
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template as any);
  Menu.setApplicationMenu(menu);
  disposeContextMenu?.();
  disposeContextMenu = contextMenu({
    showSaveImageAs: true,
    showSearchWithGoogle: false,
    showLookUpSelection: false,
    showSelectAll: true,
    labels: {
      cut: i18nText(ElectronTranslations.menu_cut),
      copy: i18nText(ElectronTranslations.global_copy),
      paste: i18nText(ElectronTranslations.menu_paste),
      selectAll: i18nText(ElectronTranslations.menu_select_all),
      copyImage: i18nText(ElectronTranslations.menu__copy_image),
      saveImageAs: i18nText(ElectronTranslations.menu__save_image_as),
    },
  });
};

const refreshMenu = () => {
  setTimeout(async () => {
    await initLocale();
    initMenu();
  }, 50);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function quitOrMinimizeApp() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (isMac) {
    // **** renderer app will reload after minimize, and keytar not working.
    const safelyMainWindow = getSafelyMainWindow();
    safelyMainWindow?.hide();
    // ****
    // app.quit();
  } else {
    app.quit();
  }
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

  const sendEventData = () => {
    const safelyMainWindow = getSafelyMainWindow();
    if (safelyMainWindow) {
      showMainWindow();

      // Cold startup: cache the deep link for later processing
      if (!isAppReady) {
        safelyMainWindow?.webContents.send(
          ipcMessageKeys.OPEN_DEEP_LINK_URL,
          eventData,
        );
      }

      // Hot startup: send directly to registered listener
      mainWindow?.webContents.send(ipcMessageKeys.EVENT_OPEN_URL, eventData);
    }

    isAppReady = true;
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

function systemIdleHandler(setIdleTime: number, event: Electron.IpcMainEvent) {
  if (systemIdleInterval) {
    clearInterval(systemIdleInterval);
  }
  if (setIdleTime <= 0) {
    return;
  }
  systemIdleInterval = setInterval(() => {
    const idleTime = powerMonitor.getSystemIdleTime();
    const systemState = powerMonitor.getSystemIdleState(setIdleTime);
    if (idleTime > setIdleTime || systemState === 'locked') {
      event.reply(ipcMessageKeys.APP_IDLE);
      clearInterval(systemIdleInterval);
    }
  }, 1000);
}

const theme = store.getTheme();

// colors from packages/components/tamagui.config.ts
const themeColors = {
  light: '#ffffff',
  dark: '#0f0f0f',
};

logger.info('theme >>>> ', theme, nativeTheme.shouldUseDarkColors);

const getBackgroundColor = (key: string) =>
  themeColors[key as keyof typeof themeColors] ||
  themeColors[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'];

const ratio = 16 / 9;
const defaultSize = 1200;
const minWidth = 1024;
const minHeight = 800;
async function createMainWindow() {
  // https://github.com/electron/electron/issues/16168
  const { screen } = require('electron');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const display = screen.getPrimaryDisplay();
  const dimensions = display.workAreaSize;
  // eslint-disable-next-line @typescript-eslint/ban-types
  let savedWinBounds: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } = store.getWinBounds();

  if (
    savedWinBounds &&
    ((savedWinBounds?.width || 0) < minWidth ||
      (savedWinBounds?.height || 0) < minHeight / ratio)
  ) {
    savedWinBounds = {};
  }
  const browserWindow = new BrowserWindow({
    show: false,
    title: APP_TITLE_NAME,
    titleBarStyle: 'hidden',
    titleBarOverlay: !isMac,
    trafficLightPosition: { x: 20, y: 20 },
    autoHideMenuBar: true,
    frame: true,
    resizable: true,
    x: isDev ? 0 : undefined,
    y: isDev ? 0 : undefined,
    width: Math.min(defaultSize, dimensions.width),
    height: Math.min(defaultSize / ratio, dimensions.height),
    minWidth: isDev ? undefined : minWidth, // OK-8215
    minHeight: isDev ? undefined : minHeight / ratio,
    backgroundColor: getBackgroundColor(theme),
    webPreferences: {
      spellcheck: false,
      webviewTag: true,
      webSecurity: !isDev,
      // @ts-expect-error
      nativeWindowOpen: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // webview injected js needs isolation=false, because property can not be exposeInMainWorld() when isolation enabled.
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      autoplayPolicy: 'user-gesture-required',
    },
    icon: path.join(appStaticResourcesPath, 'images/icons/512x512.png'),
    ...savedWinBounds,
  });

  if (!isMac) {
    attachTitlebarToWindow(browserWindow);
  }
  const getSafelyBrowserWindow = () => {
    if (browserWindow && !browserWindow.isDestroyed()) {
      return browserWindow;
    }
    return undefined;
  };

  const bundleData = store.getUpdateBundleData();
  logger.info('bundleData >>>> ', bundleData);
  const bundleIndexHtmlPath = getBundleIndexHtmlPath(bundleData);
  logger.info('bundleIndexHtmlPath >>>> ', bundleIndexHtmlPath);

  globalThis.$desktopMainAppFunctions = {
    getSafelyMainWindow,
    getSafelyBrowserWindow,
    getBackgroundColor,
    quitOrMinimizeApp,
    showMainWindow,
    refreshMenu,
    getAppName: () => APP_NAME,
    getBundleIndexHtmlPath: () => bundleIndexHtmlPath,
    useJsBundle: () => !!bundleIndexHtmlPath,
  };

  if (isMac) {
    browserWindow.once('ready-to-show', () => {
      showMainWindow();
    });
  }

  if (isDev) {
    browserWindow.webContents.openDevTools();
  }

  const src = isDev
    ? 'http://localhost:3001/'
    : formatUrl({
        pathname: bundleIndexHtmlPath || 'index.html',
        protocol: 'file',
        slashes: true,
      });

  void browserWindow.loadURL(src);

  // Set main window reference for OAuth server
  setMainWindow(browserWindow);

  // Protocol handler for win32
  if (isWin || isMac) {
    // Keep only command line / deep linked arguments
    const deeplinkingUrl = process.argv[1];
    handleDeepLinkUrl(null, deeplinkingUrl, process.argv, true);
  }

  browserWindow.webContents.on('did-finish-load', () => {
    logger.info('browserWindow >>>> did-finish-load');
    // fix white flicker on Windows & Linux
    if (!isMac) {
      showMainWindow();
    }
    const safelyBrowserWindow = getSafelyBrowserWindow();
    safelyBrowserWindow?.webContents.send(
      ipcMessageKeys.SET_ONEKEY_DESKTOP_GLOBALS,
      {
        resourcesPath,
        staticPath: `file://${staticPath}`,
        // preloadJsUrl: `file://${preloadJsUrl}?timestamp=${Date.now()}`,
        sdkConnectSrc,
      },
    );
  });

  browserWindow.on('resize', () => {
    store.setWinBounds(browserWindow.getBounds());
  });
  browserWindow.on('closed', () => {
    mainWindow = null;
    isAppReady = false;
    logger.info('set isAppReady on browserWindow closed', isAppReady);
  });

  browserWindow.webContents.on('devtools-opened', () => {
    browserWindow.focus();
    setImmediate(() => {
      browserWindow.focus();
    });
  });

  // dom-ready is fired after ipcMain:app/ready
  browserWindow.webContents.on('dom-ready', () => {
    logger.info('set isAppReady on browserWindow dom-ready', isAppReady);
    // Emit ready event first, so pending deep link handlers can execute
    // before isAppReady is set to true (which affects the cache logic)
    emitter.emit('ready');
    isAppReady = true;
  });

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  ipcMain.on(ipcMessageKeys.APP_READY, () => {
    isAppReady = true;
    logger.info('set isAppReady on ipcMain app/ready', isAppReady);
    emitter.emit('ready');
  });
  ipcMain.on(ipcMessageKeys.APP_READY, () => {
    if (!process.mas) {
      app.relaunch();
    }
    app.exit(0);
    disposeContextMenu?.();
  });

  ipcMain.on(ipcMessageKeys.IS_DEV, (event) => {
    event.returnValue = isDev;
  });

  ipcMain.on(ipcMessageKeys.THEME_UPDATE, (event, themeKey: string) => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    store.setTheme(themeKey);
    safelyBrowserWindow?.setBackgroundColor(getBackgroundColor(themeKey));
  });

  ipcMain.on(ipcMessageKeys.APP_IS_FOCUSED, (event) => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    event.returnValue = safelyBrowserWindow?.isFocused();
  });

  ipcMain.on(ipcMessageKeys.APP_SET_IDLE_TIME, (event, setIdleTime: number) => {
    systemIdleHandler(setIdleTime, event);
  });

  ipcMain.on(ipcMessageKeys.APP_TEST_CRASH, () => {
    throw new OneKeyLocalError('Test Electron Native crash 996');
  });

  desktopApi.desktopApiSetup();

  // reset appState to undefined  to avoid screen lock.
  browserWindow.on('enter-full-screen', () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, undefined);
    registerShortcuts((event) => {
      const w = getSafelyBrowserWindow();
      w?.webContents.send(ipcMessageKeys.APP_SHORCUT, event);
    });
  });

  // reset appState to undefined  to avoid screen lock.
  browserWindow.on('leave-full-screen', () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, undefined);
  });

  browserWindow.on('focus', () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    const state: IDesktopAppState = 'active';
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, state);
    registerShortcuts((event) => {
      const w = getSafelyBrowserWindow();
      w?.webContents.send(ipcMessageKeys.APP_SHORCUT, event);
    });
  });

  browserWindow.on('blur', () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    const state: IDesktopAppState = 'blur';
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, state);
    unregisterShortcuts();
  });

  browserWindow.on('hide', () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    const state: IDesktopAppState = 'background';
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, state);
  });

  app.on('login', (event, webContents, request, authInfo, callback) => {
    event.preventDefault();
    callback('onekey', 'juDUIpz3lVnubZ2aHOkwBB6SJotYynyb');
  });

  // Prevents clicking on links to open new Windows
  app.on('web-contents-created', (event, contents) => {
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler((handleDetails) => {
        const safelyMainWindow = getSafelyMainWindow();
        safelyMainWindow?.webContents.send(
          ipcMessageKeys.WEBVIEW_NEW_WINDOW,
          handleDetails,
        );
        return { action: 'deny' };
      });
      contents.on('will-frame-navigate', (e) => {
        const { url } = e;
        const { action } = uriUtils.parseDappRedirect(
          url,
          getTemplatePhishingUrls(),
        );
        if (action === uriUtils.EDAppOpenActionEnum.DENY) {
          e.preventDefault();
          logger.info(
            'reject navigate main process will-frame-navigate: ',
            url,
          );
          return false;
        }

        if (uriUtils.isValidDeepLink(url)) {
          e.preventDefault();
          logger.info('reject deeplink in main process:', url);
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

  // WebUSB permission handlers - Enable WebUSB support for hardware wallet connections

  browserWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'usb') {
      return true;
    }
    return false;
  });

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

  const PROTOCOL = 'file';
  if (isDev) {
    session.defaultSession.protocol.interceptFileProtocol(
      PROTOCOL,
      (request, callback) => {
        console.log('request url', request);
        const jsSdkPattern = '/static/js-sdk/';
        const jsSdkIndex = request.url.indexOf(jsSdkPattern);

        // resolve js-sdk files path in dev mode
        if (jsSdkIndex > -1) {
          const fileName = request.url.substring(
            jsSdkIndex + jsSdkPattern.length,
          );
          callback({
            path: path.join(staticPath, 'js-sdk', fileName),
          });
          return;
        }
        callback(request.url);
      },
    );
  } else {
    // Get Windows drive letter for security validation
    const driveLetter = getDriveLetter();
    logger.info('driveLetter >>>> ', driveLetter);
    const indexHtmlPath =
      globalThis.$desktopMainAppFunctions?.getBundleIndexHtmlPath?.();
    const useJsBundle = globalThis.$desktopMainAppFunctions?.useJsBundle?.();
    const bundleDirPath = getBundleDirPath();
    const metadata = bundleDirPath
      ? await getMetadata({
          bundleDir: bundleDirPath,
          appVersion: bundleData.appVersion,
          bundleVersion: bundleData.bundleVersion,
          signature: bundleData.signature,
        })
      : {};
    session.defaultSession.protocol.interceptFileProtocol(
      PROTOCOL,
      (request, callback) => {
        const isJsSdkFile = request.url.indexOf('/static/js-sdk') > -1;
        const isIFrameHtml =
          request.url.indexOf('/static/js-sdk/iframe.html') > -1;

        // resolve iframe path
        if (isJsSdkFile && isIFrameHtml) {
          if (useJsBundle && indexHtmlPath && bundleDirPath) {
            let key = path.join('static', 'js-sdk', 'iframe.html');
            const filePath = path.join(bundleDirPath, key);
            if (isWin) {
              key = key.replace(/\\/g, '/');
            }
            const sha512 = metadata[key];
            if (!checkFileSha512(filePath, sha512)) {
              logger.info(
                'checkFileHash error in js-sdk:',
                `${key}:  ${filePath} not matched ${sha512}`,
              );
              throw new OneKeyLocalError(`File ${key} sha512 mismatch`);
            }
            callback(filePath);
            return;
          }
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
        const url = request.url.substring(PROTOCOL.length + 1);
        if (useJsBundle && indexHtmlPath && bundleDirPath) {
          const decodedUrl = decodeURIComponent(url);
          if (decodedUrl.includes(bundleDirPath)) {
            const filePath = checkFileHash({
              bundleDirPath,
              metadata,
              driveLetter,
              url: decodedUrl.replace(bundleDirPath, ''),
            });
            callback(filePath);
          } else {
            const filePath = checkFileHash({
              bundleDirPath,
              metadata,
              driveLetter,
              url: decodedUrl,
            });
            callback(filePath);
          }
        } else {
          callback(path.join(__dirname, '..', 'build', url));
        }
      },
    );
    const safelyBrowserWindow = getSafelyBrowserWindow();
    safelyBrowserWindow?.webContents.on(
      'did-fail-load',
      (_, __, ___, validatedURL) => {
        const redirectPath = validatedURL.replace(`${PROTOCOL}://`, '');
        if (validatedURL.startsWith(PROTOCOL) && !redirectPath.includes('.')) {
          const w = getSafelyBrowserWindow();
          void w?.loadURL(src);
        }
      },
    );
  }

  // @ts-expect-error
  browserWindow.on('close', (event: Event) => {
    // hide() instead of close() on MAC
    if (isMac) {
      event.preventDefault();
      const safelyBrowserWindow = getSafelyBrowserWindow();
      if (safelyBrowserWindow) {
        safelyBrowserWindow.blur();
        safelyBrowserWindow.hide(); // hide window only
        // browserWindow.minimize(); // hide window and minimize to Docker
      }
    }
  });

  void initNobleBleSupport(browserWindow.webContents);

  return browserWindow;
}

function initChildProcess() {
  return initProcess();
}

const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance && !process.mas) {
  quitOrMinimizeApp();
} else {
  app.on('second-instance', (e, argv) => {
    const safelyMainWindow = getSafelyMainWindow();
    if (safelyMainWindow) {
      if (safelyMainWindow.isMinimized()) {
        safelyMainWindow.restore();
      }
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

  app.on('ready', async (_, launchInfo) => {
    logger.info('launchInfo >>>> ', launchInfo);
    const locale = await initLocale();
    logger.info('locale >>>> ', locale);
    startServices();

    if (!mainWindow) {
      mainWindow = await createMainWindow();
      initMenu();
    }
    void initChildProcess();
  });
}

// The activate and ready events are mapped from OS X's applicationShouldHandleReopen and applicationDidFinishLaunching events
//  couldn't find documentation on whether applicationShouldHandleReopen would be emitted before applicationDidFinishLaunching.
//  So we need to handle both cases to be safe.
app.on('activate', async () => {
  await app.whenReady();
  if (!mainWindow) {
    mainWindow = await createMainWindow();
  }
  showMainWindow();
});

app.on('before-quit', () => {
  const safelyMainWindow = getSafelyMainWindow();
  if (safelyMainWindow) {
    safelyMainWindow.removeAllListeners();
    safelyMainWindow.removeAllListeners('close');
    safelyMainWindow.close();
  }
  disposeContextMenu?.();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  quitOrMinimizeApp();
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
