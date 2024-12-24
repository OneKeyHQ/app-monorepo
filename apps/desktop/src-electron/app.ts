/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EventEmitter } from 'events';
import * as path from 'path';
import { format as formatUrl } from 'url';

import {
  attachTitlebarToWindow,
  setupTitlebar,
} from 'custom-electron-titlebar/main';
import {
  BrowserWindow,
  Menu,
  app,
  ipcMain,
  nativeTheme,
  powerMonitor,
  screen,
  session,
  shell,
  systemPreferences,
} from 'electron';
import contextMenu from 'electron-context-menu';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';

import {
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type {
  IDesktopAppState,
  IDesktopSubModuleInitParams,
  IMediaType,
} from '@onekeyhq/shared/types/desktop';

import appDevOnlyApi from './appDevOnlyApi';
import appNotification from './appNotification';
import appPermission from './appPermission';
import { ipcMessageKeys } from './config';
import { ETranslations, i18nText, initLocale } from './i18n';
import { registerShortcuts, unregisterShortcuts } from './libs/shortcuts';
import * as store from './libs/store';
import { parseContentPList } from './libs/utils';
import initProcess, { restartBridge } from './process';
import { resourcesPath, staticPath } from './resoucePath';
import { initSentry } from './sentry';
import {
  checkAvailabilityAsync,
  requestVerificationAsync,
  startServices,
} from './service';

initSentry();

logger.initialize();
logger.transports.file.maxSize = 1024 * 1024 * 10;

// https://github.com/sindresorhus/electron-context-menu
let disposeContextMenu: ReturnType<typeof contextMenu> | undefined;

const APP_NAME = 'OneKey Wallet';
app.name = APP_NAME;
let mainWindow: BrowserWindow | null;

// static path
const preloadJsUrl = path.join(staticPath, 'preload.js');

const sdkConnectSrc = isDev
  ? `file://${path.join(staticPath, 'js-sdk/')}`
  : path.join('/static', 'js-sdk/');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

if (!isMac) {
  setupTitlebar();
}

let systemIdleInterval: NodeJS.Timeout;

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
      label: app.name,
      submenu: [
        {
          role: isMac ? 'about' : undefined,
          label: i18nText(ETranslations.menu_about_onekey_wallet),
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
          label: i18nText(ETranslations.menu_check_for_updates),
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
          label: i18nText(ETranslations.menu_preferences),
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
          label: i18nText(ETranslations.menu_lock_now),
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
          label: i18nText(ETranslations.menu_hide_onekey_wallet),
        },
        isMac && {
          role: 'unhide',
          label: i18nText(ETranslations.menu_show_all),
        },
        { type: 'separator' },
        {
          role: 'quit',
          accelerator: 'CmdOrCtrl+Q',
          label: i18nText(ETranslations.menu_quit_onekey_wallet),
        },
      ].filter(Boolean),
    },
    {
      label: i18nText(ETranslations.global_edit),
      submenu: [
        { role: 'undo', label: i18nText(ETranslations.menu_undo) },
        { role: 'redo', label: i18nText(ETranslations.menu_redo) },
        { type: 'separator' },
        { role: 'cut', label: i18nText(ETranslations.menu_cut) },
        { role: 'copy', label: i18nText(ETranslations.global_copy) },
        { role: 'paste', label: i18nText(ETranslations.menu_paste) },
        { type: 'separator' },
        {
          role: 'delete',
          label: i18nText(ETranslations.global_delete),
        },
        {
          role: 'selectAll',
          label: i18nText(ETranslations.menu_select_all),
        },
      ],
    },
    {
      label: i18nText(ETranslations.menu_view),
      submenu: [
        ...(isDev || store.getDevTools()
          ? [
              { role: 'reload' },
              { role: 'forceReload' },
              { role: 'toggleDevTools' },
              { type: 'separator' },
            ]
          : []),
        {
          role: 'resetZoom',
          label: i18nText(ETranslations.menu_actual_size),
          accelerator: 'CmdOrCtrl+0',
        },
        isMac
          ? {
              role: 'zoomIn',
              label: i18nText(ETranslations.menu_zoom_in),
            }
          : {
              role: 'zoomIn',
              label: i18nText(ETranslations.menu_zoom_in),
              accelerator: 'CmdOrCtrl+Shift+]',
            },
        {
          role: 'zoomOut',
          label: i18nText(ETranslations.menu_zoom_out),
          accelerator: isMac ? 'CmdOrCtrl+-' : 'CmdOrCtrl+Shift+[',
        },
        { type: 'separator' },
        {
          role: 'togglefullscreen',
          label: i18nText(ETranslations.menu_toggle_full_screen),
        },
      ],
    },
    {
      label: i18nText(ETranslations.menu_window),
      submenu: [
        { role: 'minimize', label: i18nText(ETranslations.menu_minimize) },
        isMac && { role: 'zoom', label: i18nText(ETranslations.menu_zoom) },
        ...(isMac
          ? [
              { type: 'separator' },
              {
                role: 'front',
                label: i18nText(ETranslations.menu_bring_all_to_front),
              },
              { type: 'separator' },
              {
                label: i18nText(ETranslations.menu_window),
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
      label: i18nText(ETranslations.menu_help),
      submenu: [
        {
          label: i18nText(ETranslations.menu_visit_help_center),
          click: async () => {
            await shell.openExternal('https://help.onekey.so');
          },
        },
        { type: 'separator' },
        {
          label: i18nText(ETranslations.menu_official_website),
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
      cut: i18nText(ETranslations.menu_cut),
      copy: i18nText(ETranslations.global_copy),
      paste: i18nText(ETranslations.menu_paste),
      selectAll: i18nText(ETranslations.menu_select_all),
      copyImage: i18nText(ETranslations.menu__copy_image),
      saveImageAs: i18nText(ETranslations.menu__save_image_as),
    },
  });
};

const refreshMenu = () => {
  setTimeout(async () => {
    await initLocale();
    initMenu();
  }, 50);
};

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
    isAppReady = true;

    const safelyMainWindow = getSafelyMainWindow();
    if (safelyMainWindow) {
      showMainWindow();
      if (process.env.NODE_ENV !== 'production') {
        safelyMainWindow?.webContents.send(
          ipcMessageKeys.OPEN_DEEP_LINK_URL,
          eventData,
        );
      }
      mainWindow?.webContents.send(ipcMessageKeys.EVENT_OPEN_URL, eventData);
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

function createMainWindow() {
  const display = screen.getPrimaryDisplay();
  const dimensions = display.workAreaSize;
  const ratio = 16 / 9;
  const savedWinBounds: any = store.getWinBounds();
  const browserWindow = new BrowserWindow({
    show: false,
    title: APP_NAME,
    titleBarStyle: 'hidden',
    titleBarOverlay: !isMac,
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
    backgroundColor: getBackgroundColor(theme),
    webPreferences: {
      spellcheck: false,
      webviewTag: true,
      webSecurity: !isDev,
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
    icon: path.join(staticPath, 'images/icons/512x512.png'),
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
        preloadJsUrl: `file://${preloadJsUrl}?timestamp=${Date.now()}`,
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
    isAppReady = true;
    logger.info('set isAppReady on browserWindow dom-ready', isAppReady);
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
  ipcMain.on(ipcMessageKeys.APP_FOCUS, () => {
    showMainWindow();
  });
  ipcMain.on(ipcMessageKeys.APP_VERSION, (event) => {
    event.returnValue = app.getVersion();
  });
  ipcMain.on(ipcMessageKeys.APP_QUIT, () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    quitOrMinimizeApp();
  });
  ipcMain.on(ipcMessageKeys.APP_RELOAD, () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    safelyBrowserWindow?.reload();
  });

  ipcMain.on(
    ipcMessageKeys.APP_UPDATE_DISABLE_SHORTCUTS,
    (
      event,
      params: {
        disableNumberShortcuts: boolean;
        disableSearchAndAccountSelectorShortcuts: boolean;
      },
    ) => {
      store.setDisableKeyboardShortcuts(params);
    },
  );

  ipcMain.on(
    ipcMessageKeys.APP_GET_MEDIA_ACCESS_STATUS,
    (event, prefType: IMediaType) => {
      const result = systemPreferences?.getMediaAccessStatus?.(prefType);
      event.returnValue = result;
    },
  );

  const subModuleInitParams: IDesktopSubModuleInitParams = {
    APP_NAME,
    getSafelyMainWindow,
  };
  appNotification.init(subModuleInitParams);
  appPermission.init(subModuleInitParams);
  appDevOnlyApi.init(subModuleInitParams);

  ipcMain.on(ipcMessageKeys.APP_TOGGLE_MAXIMIZE_WINDOW, () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    if (safelyBrowserWindow?.isMaximized()) {
      // Restore the original window size
      safelyBrowserWindow?.unmaximize();
    } else {
      // Maximized window
      safelyBrowserWindow?.maximize();
    }
  });

  ipcMain.on(ipcMessageKeys.IS_DEV, (event) => {
    event.returnValue = isDev;
  });

  ipcMain.on(ipcMessageKeys.TOUCH_ID_CAN_PROMPT, async (event) => {
    if (isWin) {
      logger.info('[TOUCH_ID_CAN_PROMPT] Windows checkAvailabilityAsync');
      try {
        const result = await checkAvailabilityAsync();
        event.returnValue = result;
      } catch (error) {
        logger.info(
          '[TOUCH_ID_CAN_PROMPT] Windows checkAvailabilityAsync',
          error,
        );
        event.returnValue = false;
      }
      return;
    }
    const result = systemPreferences?.canPromptTouchID?.();
    event.returnValue = !!result;
  });

  ipcMain.on(ipcMessageKeys.APP_GET_ENV_PATH, (event) => {
    const home: string = app.getPath('home');
    const appData: string = app.getPath('appData');
    const userData: string = app.getPath('userData');
    const sessionData: string = app.getPath('sessionData');
    const exe: string = app.getPath('exe');
    const temp: string = app.getPath('temp');
    const module: string = app.getPath('module');
    const desktop: string = app.getPath('desktop');
    const appPath: string = app.getAppPath();
    event.returnValue = {
      userData,
      appPath,
      home,
      appData,
      sessionData,
      exe,
      temp,
      module,
      desktop,
    };
  });

  ipcMain.on(ipcMessageKeys.APP_GET_BUNDLE_INFO, (event) => {
    event.returnValue = parseContentPList();
  });

  ipcMain.on(ipcMessageKeys.APP_CHANGE_DEV_TOOLS_STATUS, (event, isOpen) => {
    store.setDevTools(isOpen);
    refreshMenu();
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

  ipcMain.on(ipcMessageKeys.TOUCH_ID_PROMPT, async (event, msg: string) => {
    if (isWin) {
      logger.info(
        '[TOUCH_ID_PROMPT] Windows requestVerificationAsync',
        isAppReady,
      );
      try {
        const { success, error } = await requestVerificationAsync(msg);
        event.reply(ipcMessageKeys.TOUCH_ID_PROMPT_RES, { success });
        if (error) {
          logger.info(
            '[TOUCH_ID_PROMPT] Windows requestVerificationAsync error',
            error,
          );
        }
      } catch (e: any) {
        logger.info(
          '[TOUCH_ID_PROMPT] Windows requestVerificationAsync error',
          e,
        );
        event.reply(ipcMessageKeys.TOUCH_ID_PROMPT_RES, {
          success: false,
          error: e.message,
        });
      }
      return;
    }

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
    showMainWindow();
    event.reply(ipcMessageKeys.APP_RESTORE_MAIN_WINDOW, true);
  });

  ipcMain.on(ipcMessageKeys.APP_CHANGE_LANGUAGE, (event, lang: string) => {
    store.setLanguage(lang);
    refreshMenu();
  });

  ipcMain.on(ipcMessageKeys.APP_SET_IDLE_TIME, (event, setIdleTime: number) => {
    systemIdleHandler(setIdleTime, event);
  });

  ipcMain.on(ipcMessageKeys.APP_OPEN_LOGGER_FILE, () => {
    void shell.openPath(path.dirname(logger.transports.file.getFile().path));
  });

  ipcMain.on(ipcMessageKeys.APP_TEST_CRASH, () => {
    throw new Error('Test Electron Native crash');
  });

  ipcMain.on(ipcMessageKeys.CLEAR_WEBVIEW_CACHE, () => {
    void session.defaultSession.clearStorageData({
      storages: ['cookies', 'cachestorage'],
    });
  });

  let templatePhishingUrls: string[] = [];
  ipcMain.on(
    ipcMessageKeys.SET_ALLOWED_PHISHING_URLS,
    (event, urls: string[]) => {
      if (Array.isArray(urls)) {
        templatePhishingUrls = urls;
      }
    },
  );

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
          templatePhishingUrls,
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
    const safelyMainWindow = getSafelyMainWindow();
    safelyMainWindow?.hide();
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

  app.name = APP_NAME;
  app.on('ready', async () => {
    const locale = await initLocale();
    logger.info('locale >>>> ', locale);
    startServices();
    if (!mainWindow) {
      mainWindow = createMainWindow();
      initMenu();
    }
    void initChildProcess();
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
  disposeContextMenu?.();
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
