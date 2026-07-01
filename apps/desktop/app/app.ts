/* eslint-disable dot-notation */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, format as formatUrl } from 'url';
import v8 from 'v8';

import { EOneKeyBleMessageKeys } from '@onekeyfe/hd-shared';
import { initNobleBleSupport } from '@onekeyfe/hd-transport-electron';
import { TREZOR_BLE_CHANNELS } from '@onekeyfe/hwk-trezor-connector-electron-ble';
import { initTrezorBleSupport } from '@onekeyfe/hwk-trezor-connector-electron-ble/main';
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

import { CALL_DESKTOP_API_EVENT_NAME } from '@onekeyhq/kit-bg/src/desktopApis/base/consts';
import {
  getFiatPaySiteWhitelistDomainKeys,
  getFiatPaySiteWhitelistOrigins,
  getOriginDomainKey,
  getTemplatePhishingUrls,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import desktopApi from '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApi';
import {
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { DESKTOP_WEBVIEW_OVERLAY_PARTITION } from '@onekeyhq/shared/src/consts/desktopWebviewPartitions';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { sanitizeTrezorThpModuleLogData } from '@onekeyhq/shared/src/hardware/trezorThpLogRedact';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';
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
import { scheduleCrashDumpCleanup } from './libs/crashDumpCleanup';
import {
  applyDesktopNetworkThrottleToKnownSessions,
  applyDesktopNetworkThrottleToWebContents,
} from './libs/networkThrottle';
// Side-effect import: registers synchronous IPC handler for renderer MMKV access
// eslint-disable-next-line import-js/order
import './libs/react-native-mmkv-desktop-main';
import { registerInfoHandlers } from './libs/registerInfoHandlers';
import { registerShortcuts, unregisterShortcuts } from './libs/shortcuts';
import * as store from './libs/store';
import { getBackgroundColor } from './libs/utils';
// Logger initialization (file rotation, sanitization, rate limiting)
import './logger';
import initProcess from './process';
import { setMainWindowForHttpServer } from './process/HttpServer';
import { createRecoveryWindow } from './recoveryWindow';
import {
  getAppStaticResourcesPath,
  getResourcesPath,
  getStaticPath,
} from './resoucePath';
import { initSentry } from './sentry';
import { startServices } from './service';
// eslint-disable-next-line import-js/order
import { setMainWindowForOAuthServer } from './service/oauthLocalServer/oauthLocalServer';
import { destroyTrayManager, initTrayManager } from './tray/TrayManager';
import { destroyTrayWindow, getTrayWindow } from './tray/trayWindow';

import type { IpcMainLike } from '@onekeyfe/hwk-trezor-connector-electron-ble/main';

// Perf: defer Sentry init off the synchronous module-init path. `@sentry/electron`
// is external (~5MB); requiring + initializing it on the next tick keeps the
// require()/parse out of the cold-start eval window.
//
// Use process.nextTick (not setImmediate): it fires before any timer/IO callback,
// so Sentry's global error handlers are installed at the earliest possible point
// after synchronous eval — and always before the first window (created in
// app.whenReady()). This minimizes the window in which an early async error would
// go unreported. (Synchronous top-level errors during app.js eval remain
// pre-Sentry by construction; native crashes are still covered out-of-band.)
process.nextTick(initSentry);

const isPerfCiMode = process.env.PERF_CI_MODE === '1';
const isDesktopE2EMode = process.env.DESKTOP_E2E_MODE === 'true';
const isDevServer = isDev && !isPerfCiMode;
const isLocalUnpacked = isDev || isPerfCiMode;

function isWhitelistedMediaOrigin(
  origin: string,
  whitelistOrigins: Set<string>,
  whitelistDomainKeys: Set<string>,
): boolean {
  if (!origin) {
    return false;
  }
  if (whitelistOrigins.has(origin)) {
    return true;
  }
  const domainKey = getOriginDomainKey(origin);
  return !!domainKey && whitelistDomainKeys.has(domainKey);
}

if (isPerfCiMode) {
  // Keep prepared state in a stable location on perf machines.
  const userDataDir =
    process.env.PERF_DESKTOP_USER_DATA_DIR ||
    path.join(os.homedir(), 'perf-profiles', 'desktop');
  app.setPath('userData', userDataDir);
  logger.info('[perf-ci] userDataDir:', userDataDir);
} else if (isDesktopE2EMode) {
  const userDataDir =
    process.env.DESKTOP_E2E_USER_DATA_DIR ||
    path.join(os.tmpdir(), 'onekey-desktop-e2e');
  app.setPath('userData', userDataDir);
  logger.info('[desktop-e2e] userDataDir:', userDataDir);
}

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
let isAppReady = false;
// Custom scheme used to serve the renderer bundle via interceptFileProtocol.
// Module-scoped so softRestartRenderer and createMainWindow reference the SAME
// value — a divergence would make the pre-recreate uninterceptProtocol call
// silently no-op and reintroduce the stale-interceptor bug it exists to prevent.
const PROTOCOL = 'file';

const appStaticResourcesPath = getAppStaticResourcesPath();
const staticPath = getStaticPath();
const resourcesPath = getResourcesPath();
// static path
// const preloadJsUrl = path.join(staticPath, 'preload.js');
// const preloadJsUrl = path.join(staticPath, 'preload-webview-test.js');

const sdkConnectSrc = isLocalUnpacked
  ? `file://${path.join(staticPath, 'js-sdk/')}`
  : path.join('/static', 'js-sdk/');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';

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

// MAS / Mac App Store builds cannot call `app.relaunch()` (sandbox forbids it),
// so a JS bundle update there cannot hard-restart. Instead we "soft restart":
// destroy the renderer and recreate it in-process. createMainWindow() re-runs
// processPreLaunchPendingTask() + getUpdateBundleData() + getBundleIndexHtmlPath()
// and (after the P0-1 uninterceptProtocol fix) rebinds the file:// interceptor to
// the new bundle, so the recreated window loads the freshly-installed bundle.
// The active bundle pointer was already written to the main-process store
// (store.setUpdateBundleData) before this runs, so no extra path wiring is needed.
let softRestarting = false;
async function softRestartRenderer() {
  if (softRestarting) {
    logger.warn('[softRestart] already in progress, ignoring re-entrant call');
    return;
  }
  softRestarting = true;
  const startedAt = Date.now();
  const targetBundle = store.getUpdateBundleData();
  logger.info('[softRestart] begin', {
    mas: process.mas,
    targetAppVersion: targetBundle?.appVersion,
    targetBundleVersion: targetBundle?.bundleVersion,
    nativeVersion: app.getVersion(),
    hadTrayWindow: !!getTrayWindow(),
  });
  try {
    // Give the newly installed bundle a fresh boot-fail budget (the bundle-level
    // analog of createMainWindow's app-version-change reset). createMainWindow
    // then increments to 1 — the soft restart still COUNTS, so a new bundle that
    // crashes on boot accumulates toward the recovery page just like a cold boot,
    // while repeated SUCCESSFUL soft restarts can't trip recovery (each resets
    // here, then markBootSuccess clears it). This keeps the crash self-heal /
    // auto-rollback path alive on MAS where app.relaunch() is unavailable.
    store.resetConsecutiveBootFailCount();
    // destroy() force-terminates the old renderer process (same as today's hard
    // restart), giving the recreated window a clean customElements registry and
    // killing any in-flight JS in the old renderer so it cannot re-trigger.
    getSafelyMainWindow()?.destroy();
    mainWindow = null;
    isAppReady = false;
    logger.info('[softRestart] old renderer destroyed');
    // The macOS tray panel is a separate BrowserWindow running its own copy of
    // the bundle; it is NOT recreated by createMainWindow, so after a soft
    // restart it would keep running the OLD bundle. Destroy it (keeping the tray
    // icon + polling alive) so the next tray open lazily rebuilds it from the new
    // bundle (loadTrayUrl reads the current bundle path fresh on each create).
    destroyTrayWindow();
    logger.info('[softRestart] tray window destroyed (will rebuild on demand)');
    // Remove the previous window's file:// interceptor NOW, before the recreated
    // window's loadURL runs. The interceptor lives on the persistent
    // defaultSession (it outlives the window) and still captures the OLD bundle's
    // path + metadata. createMainWindow only re-registers it later, after an
    // `await getMetadata`, so without this the new bundle's very first
    // `file://{newBundle}/index.html` request would be served by the stale
    // interceptor → hash mismatch / tamper dialog / old bundle. Clearing it here
    // lets Chromium's default file handler serve the real new index.html (same
    // as a cold boot), and createMainWindow then installs a fresh interceptor.
    try {
      const wasIntercepted =
        session.defaultSession.protocol.isProtocolIntercepted(PROTOCOL);
      if (wasIntercepted) {
        session.defaultSession.protocol.uninterceptProtocol(PROTOCOL);
      }
      logger.info('[softRestart] stale file interceptor cleared', {
        wasIntercepted,
      });
    } catch (e) {
      logger.warn(
        '[softRestart] uninterceptProtocol before recreate failed',
        e,
      );
    }
    mainWindow = await createMainWindow({ isSoftRestart: true });
    showMainWindow();
    logger.info('[softRestart] done: renderer recreated with new bundle', {
      durationMs: Date.now() - startedAt,
      indexHtml:
        globalThis.$desktopMainAppFunctions?.getBundleIndexHtmlPath?.(),
    });
  } catch (e) {
    // If recreation fails there is no safe in-process recovery on MAS; exit so
    // the user can relaunch manually (equivalent to today's MAS behavior).
    logger.error('[softRestart] failed, exiting', {
      durationMs: Date.now() - startedAt,
      error: e,
    });
    app.exit(0);
  } finally {
    softRestarting = false;
  }
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
        ...(isDevServer || store.getDevTools()
          ? [
              { role: 'reload' },
              { role: 'forceReload' },
              { role: 'toggleDevTools' },
              isDevServer
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
    // **** renderer app will reload after minimize.
    const safelyMainWindow = getSafelyMainWindow();
    safelyMainWindow?.hide();
    // ****
    // app.quit();
  } else {
    app.quit();
  }
}

const emitter = new EventEmitter();
function handleDeepLinkUrl(
  event: Event | null,
  url: string,
  argv?: string[],
  isColdStartup?: boolean,
) {
  // Validate deep link scheme before forwarding to renderer
  if (url) {
    const allowedSchemes = [
      `${ONEKEY_APP_DEEP_LINK_NAME}:`,
      `${WALLET_CONNECT_DEEP_LINK_NAME}:`,
      'ethereum:',
    ];
    const isAllowed = allowedSchemes.some((scheme) => url.startsWith(scheme));
    if (!isAllowed) {
      logger.warn('[DeepLink] Rejected URL with unknown scheme:', url);
      return;
    }
  }

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
        safelyMainWindow.webContents.send(
          ipcMessageKeys.OPEN_DEEP_LINK_URL,
          eventData,
        );
      }

      // Hot startup: send directly to registered listener
      safelyMainWindow.webContents.send(
        ipcMessageKeys.EVENT_OPEN_URL,
        eventData,
      );
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
    const sender = event.sender;
    if (!sender || sender.isDestroyed()) {
      clearInterval(systemIdleInterval);
      return;
    }
    const idleTime = powerMonitor.getSystemIdleTime();
    const systemState = powerMonitor.getSystemIdleState(setIdleTime);
    if (idleTime > setIdleTime || systemState === 'locked') {
      event.reply(ipcMessageKeys.APP_IDLE);
      clearInterval(systemIdleInterval);
    }
  }, 1000);
}

const theme = store.getTheme();
const isDarkTheme =
  theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors);

logger.info('theme >>>> ', theme, nativeTheme.shouldUseDarkColors);

const ratio = 16 / 9;
const defaultSize = 1200;
const minWidth = 1024;
const minHeight = 800;
async function createMainWindow(opts?: { isSoftRestart?: boolean }) {
  const isSoftRestart = opts?.isSoftRestart ?? false;
  // === Boot Recovery Check (must be first) ===
  // Runs for BOTH cold boots AND MAS soft restarts: a soft restart is a real
  // attempt to bring up the (newly installed) bundle, so it MUST count toward
  // crash detection — otherwise a bundle that crashes the renderer on init
  // would, on MAS (no app.relaunch()), leave a dead white window with no path
  // to the recovery page / auto-rollback. softRestartRenderer resets the
  // counter to 0 right before calling this (the bundle-version analog of the
  // app-version-change reset below — a new bundle deserves a fresh budget), so
  // a soft restart starts the new bundle at count 1: repeated SUCCESSFUL soft
  // restarts can't accumulate (each resets, then markBootSuccess clears it),
  // while a new bundle that keeps crashing accumulates across subsequent
  // launches and reaches the recovery page at 3, exactly like a cold boot.
  const currentAppVersion = app.getVersion();
  const storedFailVersion = store.getBootFailAppVersion();
  if (storedFailVersion && storedFailVersion !== currentAppVersion) {
    store.resetConsecutiveBootFailCount();
    logger.info(
      'Boot fail counter reset due to version change',
      storedFailVersion,
      '→',
      currentAppVersion,
    );
  }
  store.setBootFailAppVersion(currentAppVersion);
  const bootFailCount = store.incrementConsecutiveBootFailCount();
  logger.info('Boot fail count:', bootFailCount, { isSoftRestart });
  if (bootFailCount >= 3) {
    logger.error('Recovery page triggered', {
      crashCount: bootFailCount,
      appVersion: currentAppVersion,
    });
    const recoveryWin = createRecoveryWindow();
    recoveryWin.on('closed', () => {
      mainWindow = null;
    });
    return recoveryWin;
  }

  // https://github.com/electron/electron/issues/16168
  const { screen } = require('electron');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const display = screen.getPrimaryDisplay();
  const dimensions = display.workAreaSize;
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
    titleBarOverlay:
      isWin || isLinux
        ? {
            height: 52,
            color: '#00000000',
            symbolColor: isDarkTheme ? '#ffffff' : '#000000',
          }
        : false,
    trafficLightPosition: { x: 20, y: 20 },
    autoHideMenuBar: true,
    frame: true,
    resizable: true,
    x: isDevServer ? 0 : undefined,
    y: isDevServer ? 0 : undefined,
    width: Math.min(defaultSize, dimensions.width),
    height: Math.min(defaultSize / ratio, dimensions.height),
    minWidth: isDevServer ? undefined : minWidth, // OK-8215
    minHeight: isDevServer ? undefined : minHeight / ratio,
    backgroundColor: getBackgroundColor(theme),
    webPreferences: {
      spellcheck: false,
      webviewTag: true,
      webSecurity: isPerfCiMode ? true : !isDev,
      // @ts-expect-error
      nativeWindowOpen: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      autoplayPolicy: 'user-gesture-required',
    },
    icon: path.join(appStaticResourcesPath, 'images/icons/512x512.png'),
    ...savedWinBounds,
  });
  applyDesktopNetworkThrottleToWebContents(browserWindow.webContents);

  const getSafelyBrowserWindow = () => {
    if (browserWindow && !browserWindow.isDestroyed()) {
      return browserWindow;
    }
    return undefined;
  };

  store.processPreLaunchPendingTask();
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
    softRestartRenderer,
  };

  if (isMac) {
    browserWindow.once('ready-to-show', () => {
      showMainWindow();
    });
  }

  const perfIndexHtmlPath =
    process.env.PERF_DESKTOP_INDEX_HTML ||
    path.join(__dirname, '..', 'build', 'index.html');

  // Re-registering interceptFileProtocol on a session that already has an
  // interceptor for the scheme silently fails (Electron returns false), which
  // would leave the OLD closure — capturing the previous bundle's path/metadata
  // — still serving requests after a MAS soft restart, so the recreated window
  // would load the STALE bundle. Clear any prior interceptor first so each
  // createMainWindow() installs a fresh handler bound to the new bundle data.
  const uninterceptFileProtocolIfNeeded = () => {
    try {
      if (session.defaultSession.protocol.isProtocolIntercepted(PROTOCOL)) {
        session.defaultSession.protocol.uninterceptProtocol(PROTOCOL);
      }
    } catch (e) {
      logger.warn('uninterceptProtocol failed', e);
    }
  };

  if (isLocalUnpacked) {
    uninterceptFileProtocolIfNeeded();
    session.defaultSession.protocol.interceptFileProtocol(
      PROTOCOL,
      (request, callback) => {
        const jsSdkPattern = '/static/js-sdk/';
        const jsSdkIndex = request.url.indexOf(jsSdkPattern);

        // resolve js-sdk files path in local unpacked mode
        if (jsSdkIndex > -1) {
          const fileName = request.url.substring(
            jsSdkIndex + jsSdkPattern.length,
          );
          callback(path.join(staticPath, 'js-sdk', fileName));
          return;
        }

        // In perf-ci mode we load renderer via file://. Some builds use absolute
        // asset paths like "/main.xxx.js" which become "file:///main.xxx.js".
        // Map those to the local build directory as a fallback.
        try {
          const requestedPath = fileURLToPath(request.url);
          if (fs.existsSync(requestedPath)) {
            callback(requestedPath);
            return;
          }
          const buildDir = path.join(__dirname, '..', 'build');
          const fallbackPath = path.join(
            buildDir,
            requestedPath.replace(/^\/+/, ''),
          );
          if (fs.existsSync(fallbackPath)) {
            callback(fallbackPath);
            return;
          }
          callback(requestedPath);
        } catch (_e) {
          // Best-effort: let Electron handle it.
          callback(request.url);
        }
      },
    );
  }

  /* eslint-disable no-nested-ternary */
  let src = isPerfCiMode
    ? formatUrl({
        pathname: perfIndexHtmlPath,
        protocol: PROTOCOL,
        slashes: true,
      })
    : isDev
      ? process.env.DESKTOP_E2E_RENDERER_URL || 'http://localhost:3001/'
      : formatUrl({
          pathname: bundleIndexHtmlPath || 'index.html',
          protocol: PROTOCOL,
          slashes: true,
        });
  /* eslint-enable no-nested-ternary */

  if (isDevServer && !isDesktopE2EMode) {
    browserWindow.webContents.openDevTools();
  }

  void browserWindow.loadURL(src);

  // Set main window reference for OAuth server
  setMainWindowForOAuthServer(browserWindow);
  // Tray shares the same preload, so SERVER_* must be scoped to the main
  // renderer via sender-id checks in HttpServer.
  setMainWindowForHttpServer(browserWindow);

  // Protocol handler for win32
  // Skip on soft restart: process.argv is unchanged across an in-process
  // recreate, so replaying the launch deep link here would re-dispatch the
  // original cold-start URL (e.g. a WalletConnect pairing or send screen) after
  // every bundle update. Only a genuine cold boot should consume argv.
  if ((isWin || isMac) && !isSoftRestart) {
    // Keep only command line / deep linked arguments
    const deeplinkingUrl = process.argv[1];
    handleDeepLinkUrl(null, deeplinkingUrl, process.argv, true);
  }

  browserWindow.webContents.on('unresponsive', () => {
    logger.warn('[CPU Watchdog] renderer webContents unresponsive');
    triggerCpuWatchdog({ reason: 'unresponsive' });
  });
  browserWindow.webContents.on('responsive', () => {
    logger.info('[CPU Watchdog] renderer webContents responsive again');
  });

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
    const safelyWindow = getSafelyBrowserWindow();
    if (safelyWindow) {
      store.setWinBounds(safelyWindow.getBounds());
    }
  });
  browserWindow.on('closed', () => {
    mainWindow = null;
    isAppReady = false;
    logger.info('set isAppReady on browserWindow closed', isAppReady);
  });

  browserWindow.webContents.on('devtools-opened', () => {
    const safelyWindow = getSafelyBrowserWindow();
    safelyWindow?.focus();
    setImmediate(() => {
      const w = getSafelyBrowserWindow();
      w?.focus();
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

  // Gate shell.openExternal behind a protocol whitelist so a tainted main
  // renderer (XSS) cannot weaponize window.open() into phishing redirects
  // via javascript:/file:/data: URIs. Only https:// (and mailto:) are
  // forwarded to the OS browser. See SlowMist audit Desktop-14.
  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
        logger.warn(
          '[setWindowOpenHandler] blocked non-https url:',
          parsed.protocol,
        );
        return { action: 'deny' };
      }
      void shell.openExternal(url);
    } catch {
      logger.warn('[setWindowOpenHandler] blocked malformed url');
    }
    return { action: 'deny' };
  });

  ipcMain.removeAllListeners(ipcMessageKeys.APP_READY);
  ipcMain.on(ipcMessageKeys.APP_READY, () => {
    isAppReady = true;
    logger.info('set isAppReady on ipcMain app/ready', isAppReady);
    emitter.emit('ready');
  });

  registerInfoHandlers(isDevServer, () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    return !!safelyBrowserWindow?.isFocused();
  });

  ipcMain.removeAllListeners(ipcMessageKeys.APP_SET_IDLE_TIME);
  ipcMain.on(ipcMessageKeys.APP_SET_IDLE_TIME, (event, setIdleTime: number) => {
    systemIdleHandler(setIdleTime, event);
  });

  ipcMain.removeAllListeners(ipcMessageKeys.APP_TEST_CRASH);
  ipcMain.on(ipcMessageKeys.APP_TEST_CRASH, () => {
    throw new OneKeyLocalError('Test Electron Native crash 996');
  });

  // Dev-only backdoor: force the CPU watchdog dialog to appear immediately,
  // bypassing the sustained-CPU threshold and 30-minute cooldown. Used by
  // the "Force trigger CPU Watchdog Dialog" entries under Dev Mode.
  //
  // SECURITY: registration is gated to dev builds so the channel does not
  // exist on the production IPC surface — a tainted renderer (XSS, malicious
  // DApp webview) cannot spam-pop a system dialog containing a Restart
  // button. Handlers also re-check the gate as backstop and validate the
  // reason against the enum to drop garbage payloads.
  if (isDevServer && !app.isPackaged) {
    ipcMain.removeAllListeners(ipcMessageKeys.CPU_WATCHDOG_FORCE_TRIGGER);
    ipcMain.on(
      ipcMessageKeys.CPU_WATCHDOG_FORCE_TRIGGER,
      (_event, reason: unknown) => {
        if (!isDevServer || app.isPackaged) return;
        if (!isCpuWatchdogReason(reason)) {
          logger.warn(
            '[CPU Watchdog] force-trigger rejected — invalid reason',
            {
              reason,
            },
          );
          return;
        }
        logger.warn('[CPU Watchdog] force-trigger via IPC', { reason });
        triggerCpuWatchdog({
          reason,
          cpuTrend: [99, 99, 99],
          bypassCooldown: true,
        });
      },
    );

    ipcMain.removeAllListeners(ipcMessageKeys.CPU_WATCHDOG_RESET_COOLDOWN);
    ipcMain.on(ipcMessageKeys.CPU_WATCHDOG_RESET_COOLDOWN, () => {
      if (!isDevServer || app.isPackaged) return;
      resetCpuWatchdogStateForTesting();
    });
  }

  // System Resources
  ipcMain.removeHandler(ipcMessageKeys.SYSTEM_GET_CPU_USAGE);
  ipcMain.removeHandler(ipcMessageKeys.SYSTEM_GET_MEMORY_USAGE);
  ipcMain.handle(ipcMessageKeys.SYSTEM_GET_CPU_USAGE, async () => {
    try {
      const cpuUsage = process.getCPUUsage();
      // Calculate CPU usage percentage
      const totalUsage = cpuUsage.percentCPUUsage;
      return {
        usage: totalUsage,
      };
    } catch (error) {
      console.error('Failed to get CPU usage:', error);
      return { usage: 0 };
    }
  });

  ipcMain.handle(ipcMessageKeys.SYSTEM_GET_MEMORY_USAGE, async () => {
    try {
      const memoryUsage = await process.getProcessMemoryInfo();
      const blinkMemory = process.getBlinkMemoryInfo();

      // Format memory value: if < 1, keep 2 decimals; if >= 1, round to integer
      const formatMemoryValue = (valueInKB: number): string => {
        const valueInMB = valueInKB / 1024;
        if (valueInMB < 1) {
          return valueInMB.toFixed(2);
        }
        return Math.round(valueInMB).toString();
      };

      // private: available on all platforms (macOS, Windows, Linux)
      // residentSet: only available on Linux and Windows
      // blinkMemory: Blink (rendering engine) memory usage
      return {
        private: Math.round(memoryUsage.private / 1024), // Convert KB to MB
        residentSet: memoryUsage.residentSet
          ? Math.round(memoryUsage.residentSet / 1024)
          : undefined, // Convert KB to MB, undefined on macOS
        blink: {
          allocated: formatMemoryValue(blinkMemory.allocated), // Formatted string
          total: formatMemoryValue(blinkMemory.total), // Formatted string
        },
      };
    } catch (error) {
      console.error('Failed to get memory usage:', error);
      return {
        private: 0,
        residentSet: undefined,
        blink: { allocated: '0', total: '0' },
      };
    }
  });

  // === Boot Recovery IPC Handlers ===
  ipcMain.removeAllListeners(ipcMessageKeys.MARK_BOOT_SUCCESS);
  ipcMain.on(ipcMessageKeys.MARK_BOOT_SUCCESS, () => {
    store.resetConsecutiveBootFailCount();
    logger.info('Boot success confirmed, crash counter reset');
  });

  ipcMain.removeAllListeners(ipcMessageKeys.SET_CONSECUTIVE_BOOT_FAIL_COUNT);
  ipcMain.on(
    ipcMessageKeys.SET_CONSECUTIVE_BOOT_FAIL_COUNT,
    (_event: unknown, count: number) => {
      store.setConsecutiveBootFailCount(count);
      logger.info('Consecutive boot fail count set to', count);
    },
  );

  ipcMain.removeAllListeners(CALL_DESKTOP_API_EVENT_NAME);
  desktopApi.desktopApiSetup();

  // New invoke-based handler for contextIsolation-compatible API calls
  ipcMain.removeHandler('DESKTOP_API_CALL');
  const allowedModules = new Set([
    'system',
    'security',
    'storage',
    'webview',
    'notification',
    'dev',
    'inAppPurchase',
    'bluetooth',
    'appUpdate',
    'bundleUpdate',
    'cloudKit',
    'keychain',
    'sniRequest',
    'oauthLocalServer',
    'appleAuth',
  ]);
  ipcMain.handle(
    'DESKTOP_API_CALL',
    async (
      event,
      payload: { module: string; method: string; params: any[] },
    ) => {
      // Only allow calls from the main window renderer. Resolve the live main
      // window dynamically (not the closure-captured `browserWindow`) so a MAS
      // soft restart — which destroys and recreates the window — keeps the gate
      // pointed at the current renderer instead of the destroyed one.
      const currentMainWebContentsId =
        getSafelyMainWindow()?.webContents.id ?? browserWindow.webContents.id;
      if (event.sender.id !== currentMainWebContentsId) {
        logger.warn(
          '[DESKTOP_API_CALL] Rejected call from non-main renderer',
          event.sender.id,
        );
        throw new OneKeyLocalError(
          'DESKTOP_API_CALL is only allowed from the main window',
        );
      }
      const { module, method, params } = payload;
      if (!allowedModules.has(module)) {
        throw new OneKeyLocalError(
          `DESKTOP_API_CALL: unknown module "${module}"`,
        );
      }
      // Block inherited prototype methods and private methods
      if (
        typeof method !== 'string' ||
        method.startsWith('_') ||
        ['constructor', 'toString', 'valueOf', 'hasOwnProperty'].includes(
          method,
        )
      ) {
        throw new OneKeyLocalError(
          `DESKTOP_API_CALL: disallowed method "${method}"`,
        );
      }
      const result: unknown = await desktopApi.callDesktopApiMethod({
        type: 'DESKTOP_API_IPC_MESSAGE',
        module: module as any,
        method,
        params,
      });
      return result;
    },
  );

  // reset appState to undefined  to avoid screen lock.
  browserWindow.on('enter-full-screen', () => {
    const safelyBrowserWindow = getSafelyBrowserWindow();
    safelyBrowserWindow?.webContents.send(ipcMessageKeys.APP_STATE, undefined);
    registerShortcuts((event) => {
      const w = getSafelyBrowserWindow();
      w?.webContents.send(ipcMessageKeys.APP_SHORTCUT, event);
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
      w?.webContents.send(ipcMessageKeys.APP_SHORTCUT, event);
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

  // The overlay route uses a dedicated <webview> partition; matching the
  // session reference here lets the main process recognize overlay
  // webviews at creation time — BEFORE any navigation event can fire —
  // and apply the strict overlay URL policy in `will-redirect` /
  // `will-navigate`. These events are the only stage where SSRF-class
  // targets (loopback / private / metadata IPs) can actually be blocked;
  // the renderer's `did-redirect-navigation` fires too late.
  const overlaySession = session.fromPartition(
    DESKTOP_WEBVIEW_OVERLAY_PARTITION,
  );
  void applyDesktopNetworkThrottleToKnownSessions();
  // Overlay loads arbitrary external https pages from deeplinks /
  // notifications; the renderer's media-permission whitelist already
  // denies getUserMedia at the react-native-webview layer, but the
  // desktop session needs its own deny handlers because Electron
  // defaults to granting permission requests when none are set
  // (https://www.electronjs.org/docs/latest/tutorial/security#5-handle-session-permission-requests-from-remote-content).
  overlaySession.setPermissionCheckHandler(() => false);
  overlaySession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );
  overlaySession.setDevicePermissionHandler(() => false);

  // Prevents clicking on links to open new Windows
  app.removeAllListeners('web-contents-created');
  app.on('web-contents-created', (event, contents) => {
    applyDesktopNetworkThrottleToWebContents(contents);
    if (contents.getType() === 'webview') {
      const isOverlayWebview = contents.session === overlaySession;
      if (isOverlayWebview) {
        const guardOverlayPreNavigation = (
          navigationEvent: Electron.Event,
          url: string,
        ) => {
          if (isAllowedWebViewUrl(url)) return;
          navigationEvent.preventDefault();
          logger.info('overlay pre-navigation block (main process):', url);
        };
        contents.on('will-redirect', guardOverlayPreNavigation);
        contents.on('will-navigate', guardOverlayPreNavigation);
      }
      contents.setWindowOpenHandler((handleDetails) => {
        const safelyMainWindow = getSafelyMainWindow();
        // Forward the source webContents id so renderer listeners can
        // distinguish overlay-route webviews (strict policy: https-only,
        // no local addresses, no deeplinks) from Discovery tabs (which
        // intentionally allow http and onekey-wallet:// deeplinks).
        safelyMainWindow?.webContents.send(ipcMessageKeys.WEBVIEW_NEW_WINDOW, {
          ...handleDetails,
          sourceWebContentsId: contents.id,
        });
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
    if (details.deviceType === 'hid') {
      // WebHID has no protected-class blocklist (unlike WebUSB), so tighten
      // to Ledger vendorId only.
      return details.device?.vendorId === 0x2c_97;
    }
    return false;
  });

  // `session` here is the persistent defaultSession, which OUTLIVES the
  // BrowserWindow. `.on` is additive, so on a MAS soft restart this would stack
  // one more listener per recreate. Clear any prior one first so it stays at 1.
  browserWindow.webContents.session.removeAllListeners('select-hid-device');
  browserWindow.webContents.session.on(
    'select-hid-device',
    (event, details, callback) => {
      // preventDefault is required; otherwise Electron auto-picks the first
      // device and ignores the callback — see Electron Session docs.
      event.preventDefault();
      // Only auto-select Ledger devices (vendorId 0x2c97)
      const ledgerDevice = details.deviceList.find(
        (d) => d.vendorId === 0x2c_97,
      );
      callback(ledgerDevice ? ledgerDevice.deviceId : '');
    },
  );

  // Permission handler for webview (partition: persist:onekey)
  //
  // Default policy: DENY all permissions. Only types explicitly listed in
  // WEBVIEW_ALLOWED_PERMISSIONS are granted. Previously the handler fell
  // through to `callback(true)` for anything other than `media`, which let
  // any dapp silently read the user's clipboard, geolocation, screen
  // capture, etc. See SlowMist audit Desktop-10.1.
  //
  // - media: whitelisted fiat pay sites only (camera/microphone for KYC)
  // - clipboard-sanitized-write: allowed (no information disclosure)
  // - fullscreen / pointerLock: allowed (legitimate dapp UX for video/games);
  //   revisit if business confirms they are unused
  // - clipboard-read: DENIED at the Electron level so dapps cannot bypass
  //   the `wallet_requestClipboardPermission` modal via
  //   `navigator.clipboard.readText()`
  // - notifications: already disabled at the Blink engine level via
  //   `disableBlinkFeatures="Notifications"` in DesktopWebView.tsx
  // - all other permissions (geolocation, display-capture, idle-detection,
  //   midi, serial/usb/hid/bluetooth, etc.): DENIED
  const WEBVIEW_ALLOWED_PERMISSIONS = new Set([
    'fullscreen',
    'pointerLock',
    'clipboard-sanitized-write',
  ]);
  const webviewSession = session.fromPartition('persist:onekey');
  void applyDesktopNetworkThrottleToKnownSessions();
  webviewSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl = details.requestingUrl || '';
      const topLevelUrl = webContents.getURL();

      if (permission === 'media') {
        try {
          const requestingOrigin = requestingUrl
            ? new URL(requestingUrl).origin
            : '';
          const topLevelOrigin = topLevelUrl ? new URL(topLevelUrl).origin : '';
          const origins = getFiatPaySiteWhitelistOrigins();
          const domainKeys = getFiatPaySiteWhitelistDomainKeys();
          const isWhitelisted =
            isWhitelistedMediaOrigin(requestingOrigin, origins, domainKeys) ||
            isWhitelistedMediaOrigin(topLevelOrigin, origins, domainKeys);
          if (isWhitelisted) {
            callback(true);
            return;
          }
        } catch {
          // Ignore malformed URLs and fall through to deny by default.
        }
        callback(false);
        return;
      }
      if (WEBVIEW_ALLOWED_PERMISSIONS.has(permission)) {
        callback(true);
        return;
      }
      // Log only the origin — full URLs can carry session tokens or
      // dapp-specific query strings that should not leak into log files.
      let deniedOrigin = '<malformed>';
      try {
        deniedOrigin = new URL(requestingUrl || topLevelUrl).origin;
      } catch {
        // keep '<malformed>' fallback
      }
      logger.info('[webview] permission denied:', permission, deniedOrigin);
      callback(false);
    },
  );
  // Some permissions (notably clipboard) reach the renderer via the
  // synchronous PermissionCheck path rather than PermissionRequest; without a
  // check handler Electron's default is `true`, which would silently let
  // dapps bypass the request-time policy above. Mirror the allowlist here.
  // `media` keeps a true default so the dynamic fiat-pay whitelist still
  // runs at request time.
  webviewSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') return true;
    return WEBVIEW_ALLOWED_PERMISSIONS.has(permission);
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

  // Inject security response headers for the app's own pages only.
  // Scoped to file:// and localhost to avoid interfering with external API responses.
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['file://*', 'http://localhost:*/*'] },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'X-Content-Type-Options': ['nosniff'],
          'X-Frame-Options': ['SAMEORIGIN'],
          'Referrer-Policy': ['strict-origin-when-cross-origin'],
        },
      });
    },
  );

  if (!isLocalUnpacked) {
    // Get Windows drive letter for security validation
    const driveLetter = getDriveLetter();
    logger.info('driveLetter >>>> ', driveLetter);
    const indexHtmlPath =
      globalThis.$desktopMainAppFunctions?.getBundleIndexHtmlPath?.();
    let useJsBundle = globalThis.$desktopMainAppFunctions?.useJsBundle?.();
    const bundleDirPath = getBundleDirPath();
    let metadata: Record<string, string> = {};
    let metadataFailed = false;
    if (bundleDirPath) {
      try {
        metadata = await getMetadata({
          bundleDir: bundleDirPath,
          appVersion: bundleData.appVersion,
          bundleVersion: bundleData.bundleVersion,
          signature: bundleData.signature,
        });
      } catch (e) {
        // GPG verification failed or metadata unreadable — disable JS bundle
        // so the interceptor falls back to the builtin bundle in the asar.
        logger.error('getMetadata failed, falling back to builtin bundle:', e);
        useJsBundle = false;
        metadataFailed = true;
      }
    }
    uninterceptFileProtocolIfNeeded();
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

        // Strip the query string before path resolution — without this the
        // tray window's `?render=tray` gets concatenated into the resolved
        // filename and fs misses. Guarded by indexOf so the common
        // no-query case (main window resources) stays allocation-free.
        const queryIdx = request.url.indexOf('?');
        const rawUrl =
          queryIdx === -1 ? request.url : request.url.substring(0, queryIdx);
        const url = rawUrl.substring(PROTOCOL.length + 1);
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
          const buildDir = path.resolve(__dirname, '..', 'build');
          // Strip leading protocol slashes (e.g. "//index.html" → "index.html")
          // so path.resolve treats the segment as relative, not absolute.
          const relativeUrl = url.replace(/^[:/]+/, '');
          const resolved = path.resolve(buildDir, relativeUrl);
          if (
            !resolved.startsWith(buildDir + path.sep) &&
            resolved !== buildDir
          ) {
            logger.warn('Blocked file access outside build dir:', resolved);
            callback({ error: -6 } as any); // net::ERR_FILE_NOT_FOUND
            return;
          }
          callback(resolved);
        }
      },
    );
    // When getMetadata failed, src still points to the bundle path which the
    // interceptor cannot resolve with useJsBundle=false. Recompute and reload
    // now that the interceptor is registered and will serve builtin files.
    if (metadataFailed) {
      src = formatUrl({
        pathname: 'index.html',
        protocol: PROTOCOL,
        slashes: true,
      });
      void browserWindow.loadURL(src);
    }
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
        if (safelyBrowserWindow.isFullScreen()) {
          // Exit fullscreen first, then hide after the animation completes
          safelyBrowserWindow.once('leave-full-screen', () => {
            safelyBrowserWindow.blur();
            safelyBrowserWindow.hide();
          });
          safelyBrowserWindow.setFullScreen(false);
        } else {
          safelyBrowserWindow.blur();
          safelyBrowserWindow.hide();
        }
      }
    }
  });

  // Use enum from @onekeyfe/hd-shared to stay in sync with the channels
  // registered by initNobleBleSupport() from @onekeyfe/hd-transport-electron
  const nobleBleChannels = [
    EOneKeyBleMessageKeys.NOBLE_BLE_ENUMERATE,
    EOneKeyBleMessageKeys.NOBLE_BLE_STOP_SCAN,
    EOneKeyBleMessageKeys.NOBLE_BLE_GET_DEVICE,
    EOneKeyBleMessageKeys.NOBLE_BLE_CONNECT,
    EOneKeyBleMessageKeys.NOBLE_BLE_DISCONNECT,
    EOneKeyBleMessageKeys.NOBLE_BLE_WRITE,
    EOneKeyBleMessageKeys.NOBLE_BLE_SUBSCRIBE,
    EOneKeyBleMessageKeys.NOBLE_BLE_UNSUBSCRIBE,
    EOneKeyBleMessageKeys.NOBLE_BLE_CANCEL_PAIRING,
    EOneKeyBleMessageKeys.BLE_AVAILABILITY_CHECK,
  ];
  nobleBleChannels.forEach((channel) => ipcMain.removeHandler(channel));
  void initNobleBleSupport(browserWindow.webContents);

  // Third-party BLE wiring — exposed to the renderer as the vendor-neutral
  // `window.desktopApi.thirdPartyBle`. Today it's backed by the SDK's
  // `initTrezorBleSupport`, whose IPC channels live in their own
  // namespace ($onekey-trezor-ble-*) so they coexist with OneKey's
  // own `nobleBle` without colliding. When we add other 3rd-party BLE
  // vendors, they should plug into the same `thirdPartyBle` surface
  // rather than each adding a parallel object.
  Object.values(TREZOR_BLE_CHANNELS).forEach((channel) =>
    ipcMain.removeHandler(channel),
  );
  // The SDK registers its BLE IPC handlers ignoring `event.sender`. DApp
  // webviews share the same preload (`desktopApi.thirdPartyBle`) and could
  // otherwise drive BLE scan/connect/write. Gate every channel to the main
  // window renderer, matching the DESKTOP_API_CALL sender check.
  const trezorBleSenderGatedIpcMain: IpcMainLike = {
    handle: (channel, listener) => {
      ipcMain.handle(channel, (event, ...args) => {
        if (event.sender.id !== browserWindow.webContents.id) {
          logger.warn(
            '[TrezorBLE] Rejected IPC from non-main renderer',
            channel,
            event.sender.id,
          );
          throw new OneKeyLocalError(
            'Trezor BLE IPC is only allowed from the main window',
          );
        }
        return listener(event, ...args);
      });
    },
    removeHandler: (channel) => ipcMain.removeHandler(channel),
  };
  initTrezorBleSupport(browserWindow.webContents, {
    ipcMain: trezorBleSenderGatedIpcMain,
    logger: (entry) => {
      const message = `[hwk:${entry.scope}] ${entry.event}`;
      // THP debug payloads can carry handshake packets / pairing credentials /
      // static keys — redact before anything reaches the on-disk file log.
      const data = sanitizeTrezorThpModuleLogData(entry.data) ?? '';
      if (entry.level === 'error') {
        logger.error(message, data);
        return;
      }
      if (entry.level === 'warn') {
        logger.warn(message, data);
        return;
      }
      logger.info(message, data);
    },
  });

  return browserWindow;
}

function initChildProcess() {
  return initProcess();
}

const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance && !process.mas) {
  // Second instance detected - quit immediately to prevent any initialization
  logger.info('Second instance detected, quitting immediately');
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    logger.info('Second instance launched, focusing existing window', {
      argv,
      platform: process.platform,
    });

    const safelyMainWindow = getSafelyMainWindow();
    if (safelyMainWindow) {
      // Restore window if minimized
      if (safelyMainWindow.isMinimized()) {
        safelyMainWindow.restore();
      }

      // Handle deep link arguments for all platforms
      // argv: An array of the second instance's (command line / deep linked) arguments
      const deeplinkingUrl = argv[1];
      if (deeplinkingUrl) {
        // handleDeepLinkUrl internally calls showMainWindow(), so we don't need to call it separately
        handleDeepLinkUrl(null, deeplinkingUrl, argv, false); // isColdStartup=false for second instance
      } else {
        // No deep link, just show and focus the window
        showMainWindow();
      }
    }
  });

  app.on('ready', async (_, launchInfo) => {
    logger.info('launchInfo >>>> ', launchInfo);
    logger.info(
      `nativeAppVersion: ${app.getVersion()}, buildNumber: ${process.env.BUILD_NUMBER ?? ''}, builtinBundleVersion: ${process.env.BUNDLE_VERSION ?? ''}`,
    );
    const locale = await initLocale();
    logger.info('locale >>>> ', locale);

    if (!mainWindow) {
      mainWindow = await createMainWindow();
    }

    // Menu is needed in both normal and recovery mode
    initMenu();

    // In recovery mode, skip heavy app initialization.
    // createMainWindow() increments bootFailCount; if >= 3 it returned
    // a standalone recovery window that doesn't need these services.
    if (store.getConsecutiveBootFailCount() >= 3) {
      return;
    }

    if (isMac) {
      const loadTrayUrl = (win: BrowserWindow) => {
        if (isDev) {
          const port = process.env.PORT || 3001;
          void win.loadURL(`http://localhost:${port}?render=tray`);
          return;
        }
        // Mirror createMainWindow's URL builder — the interceptFileProtocol
        // handler only resolves the relative `file://index.html` form.
        const bundleData = store.getUpdateBundleData();
        const bundleIndexHtmlPath = getBundleIndexHtmlPath(bundleData);
        void win.loadURL(
          formatUrl({
            pathname: bundleIndexHtmlPath || 'index.html',
            protocol: 'file',
            slashes: true,
            query: { render: 'tray' },
          }),
        );
      };

      // Default to on; renderer sends TRAY_TOGGLE(false) on startup if
      // the user had previously disabled it.
      initTrayManager(getSafelyMainWindow, showMainWindow, loadTrayUrl);

      // Sender gate: tray window shares the main preload and also exposes
      // `toggleTray`, so without this a tray-side caller could disable itself.
      ipcMain.on(ipcMessageKeys.TRAY_TOGGLE, (event, enabled: boolean) => {
        const senderMainWindow = getSafelyMainWindow();
        if (
          !senderMainWindow ||
          event.sender.id !== senderMainWindow.webContents.id
        ) {
          logger.warn('[TrayToggle] rejected TRAY_TOGGLE from non-main window');
          return;
        }
        if (enabled) {
          initTrayManager(getSafelyMainWindow, showMainWindow, loadTrayUrl);
        } else {
          destroyTrayManager();
        }
      });
    }

    startServices();
    void initChildProcess();
  });
}

// The activate and ready events are mapped from OS X's applicationShouldHandleReopen and applicationDidFinishLaunching events
//  couldn't find documentation on whether applicationShouldHandleReopen would be emitted before applicationDidFinishLaunching.
//  So we need to handle both cases to be safe.
app.on('activate', async () => {
  await app.whenReady();
  // During a soft restart `mainWindow` is transiently null while
  // createMainWindow() runs. Skip creating a window here in that window of time,
  // otherwise a dock-icon click would spawn a SECOND main window (without
  // isSoftRestart, so it would also bump the boot-fail counter). softRestart's
  // own showMainWindow() will surface the recreated window.
  if (!mainWindow && !softRestarting) {
    mainWindow = await createMainWindow();
  }
  showMainWindow();
});

app.on('before-quit', () => {
  if (isMac) {
    destroyTrayManager();
  }

  // Reset crash counter on graceful shutdown so normal close
  // is not mistaken for a crash on next boot.
  // Skip reset when in recovery mode (count >= 3) so recovery is still
  // offered if the user closes the recovery window without resolving.
  if (store.getConsecutiveBootFailCount() < 3) {
    store.resetConsecutiveBootFailCount();
  }

  if (systemIdleInterval) {
    clearInterval(systemIdleInterval);
  }
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

// ==================== GPU Process Protection System ====================
// Comprehensive GPU crash prevention and recovery
// Related: Sentry issue - GPU process crashes on Windows AMD + heavy DApp usage

// 1. GPU Crash Detection and Recovery Handler
app.on('child-process-gone', async (event, details) => {
  logger.error('Child process gone:', {
    type: details.type,
    reason: details.reason,
    exitCode: details.exitCode,
    name: details.name,
  });

  if (details.type === 'GPU') {
    logger.error('🔴 GPU process crashed - initiating recovery');

    // Record crash statistics
    store.recordGPUCrash();
    const stats = store.getGPUCrashStats();

    // Track GPU crash in Sentry for monitoring
    try {
      const { captureException } = require('@sentry/electron/main') as {
        captureException: (
          error: Error,
          options: Record<string, unknown>,
        ) => void;
      };
      captureException(new Error('GPU Process Crashed'), {
        level: 'fatal',
        tags: {
          gpu_reason: details.reason,
          gpu_exit_code: details.exitCode,
          platform: process.platform,
          cpu_model: os.cpus()[0]?.model || 'unknown',
          crash_count: stats.count,
        },
        extra: {
          last_crash_time: stats.lastCrashTime,
          time_since_start:
            Date.now() - (app.getAppMetrics()[0]?.creationTime || 0),
        },
      });
    } catch (e) {
      logger.error('Failed to report GPU crash to Sentry:', e);
    }

    // Notify renderer process about the crash
    const safelyMainWindow = getSafelyMainWindow();
    if (safelyMainWindow && !safelyMainWindow.isDestroyed()) {
      safelyMainWindow.webContents.send('gpu-process-crashed', {
        reason: details.reason,
        exitCode: details.exitCode,
        timestamp: Date.now(),
        crashCount: stats.count,
      });
    }

    // Log critical crashes for monitoring
    if (details.reason === 'crashed' || details.reason === 'oom') {
      logger.error('Critical GPU crash detected');
      logger.error('Crash details:', {
        reason: details.reason,
        totalCrashes: stats.count,
        suggestion: 'Consider closing some browser tabs to reduce GPU load',
      });
    }

    // Collect GPU hardware info after crash for diagnostics (fire-and-forget,
    // getGPUInfo may hang when GPU process is dead so we don't await it)
    app
      .getGPUInfo('basic')
      .then((gpuInfo) => {
        logger.error('[GPU Crash] GPU Hardware Info:', JSON.stringify(gpuInfo));
      })
      .catch(() => {
        logger.error('[GPU Crash] Cannot retrieve GPU info after crash');
      });
  }
});

// 2. Monitor render process crashes (may be GPU-related)
app.on('render-process-gone', (event, webContents, details) => {
  logger.error('Render process gone:', {
    reason: details.reason,
    exitCode: details.exitCode,
  });

  if (details.reason === 'crashed' || details.reason === 'oom') {
    logger.warn('⚠️ Renderer crashed - may indicate GPU issues');
  }
});

// 3. GPU Info Update Monitoring
app.on('gpu-info-update', () => {
  logger.info('GPU info updated');
});

// 4. Log GPU protection status
const gpuStats = store.getGPUCrashStats();
logger.info('GPU Protection System initialized', {
  platform: process.platform,
  cpuModel: os.cpus()[0]?.model || 'unknown',
  totalGPUCrashes: gpuStats.count,
  lastCrashTime: gpuStats.lastCrashTime
    ? new Date(gpuStats.lastCrashTime).toISOString()
    : 'never',
});

// ==================== End GPU Protection ====================

// ==================== Memory Protection System ====================
// Prevent OOM crashes by monitoring and limiting renderer process memory
// Related: Sentry issue - OOM crash after 3 hours with DApp browser open

const MEMORY_LIMIT_WARNING_MB = 1024; // 1GB warning threshold
const MEMORY_LIMIT_CRITICAL_MB = 2048; // 2GB critical threshold
const MEMORY_CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds
const METRICS_SAMPLE_INTERVAL_MS = 30_000;

let memoryMonitorInterval: ReturnType<typeof setInterval> | null = null;

// Track previous memory state to only fire on threshold transitions
let wasAboveWarning = false;
let wasAboveCritical = false;

function startMemoryMonitoring() {
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
  }

  memoryMonitorInterval = setInterval(async () => {
    try {
      const memoryInfo = await process.getProcessMemoryInfo();
      const memoryUsageMB = Math.round(memoryInfo.private / 1024); // Convert KB to MB

      // Log memory usage periodically for monitoring
      if (memoryUsageMB > 512) {
        // Only log if > 512MB
        logger.info(
          `[Memory Monitor] Current memory usage: ${memoryUsageMB}MB`,
        );
      }

      const isAboveWarning = memoryUsageMB > MEMORY_LIMIT_WARNING_MB;
      const isAboveCritical = memoryUsageMB > MEMORY_LIMIT_CRITICAL_MB;

      // Warning threshold: 1GB — only fire on transition (below → above)
      if (isAboveWarning && !wasAboveWarning) {
        logger.warn(
          `⚠️ [Memory Monitor] Memory usage high: ${memoryUsageMB}MB (threshold: ${MEMORY_LIMIT_WARNING_MB}MB)`,
        );

        const safelyMainWindow = getSafelyMainWindow();
        if (safelyMainWindow && !safelyMainWindow.isDestroyed()) {
          safelyMainWindow.webContents.send('memory-pressure-warning', {
            currentMemoryMB: memoryUsageMB,
            thresholdMB: MEMORY_LIMIT_WARNING_MB,
            level: 'warning',
          });
        }
      }

      // Critical threshold: 2GB — only fire on transition (below → above)
      if (isAboveCritical && !wasAboveCritical) {
        logger.error(
          `🔴 [Memory Monitor] CRITICAL memory usage: ${memoryUsageMB}MB (threshold: ${MEMORY_LIMIT_CRITICAL_MB}MB)`,
        );

        const safelyMainWindow = getSafelyMainWindow();
        if (safelyMainWindow && !safelyMainWindow.isDestroyed()) {
          // Notify renderer to reload inactive tabs
          // Note: Do NOT clear the shared session cache here — it would
          // destroy cache for ALL webviews (including the active tab) and
          // cause reloaded tabs to re-fetch everything without cache.
          safelyMainWindow.webContents.send('memory-pressure-critical', {
            currentMemoryMB: memoryUsageMB,
            thresholdMB: MEMORY_LIMIT_CRITICAL_MB,
            level: 'critical',
            action: 'reload-inactive-tabs',
          });
        }

        // Track critical memory events in Sentry
        try {
          const { captureException } = require('@sentry/electron/main') as {
            captureException: (
              error: Error,
              options: Record<string, unknown>,
            ) => void;
          };
          captureException(new Error('Critical Memory Usage Detected'), {
            level: 'warning',
            tags: {
              memory_usage_mb: memoryUsageMB,
              threshold_mb: MEMORY_LIMIT_CRITICAL_MB,
            },
            extra: {
              memory_info: memoryInfo,
            },
          });
        } catch (e) {
          logger.error('[Memory Monitor] Failed to report to Sentry:', e);
        }
      }

      // Update state for next check
      wasAboveWarning = isAboveWarning;
      wasAboveCritical = isAboveCritical;
    } catch (error) {
      logger.error('[Memory Monitor] Failed to check memory:', error);
    }
  }, MEMORY_CHECK_INTERVAL_MS);

  logger.info('[Memory Monitor] Started monitoring', {
    warningThresholdMB: MEMORY_LIMIT_WARNING_MB,
    criticalThresholdMB: MEMORY_LIMIT_CRITICAL_MB,
    checkIntervalMs: MEMORY_CHECK_INTERVAL_MS,
  });
}

function startProcessMetricsMonitoring() {
  setInterval(() => {
    const metrics = app.getAppMetrics();
    const highMemoryProcesses = metrics.filter(
      (m) => (m.memory?.workingSetSize ?? 0) > 200 * 1024,
    );

    if (highMemoryProcesses.length > 0) {
      logger.warn(
        '[Process Metrics] High memory processes:',
        highMemoryProcesses.map((m) => ({
          pid: m.pid,
          type: m.type,
          name: m.name,
          memoryMB: Math.round((m.memory?.workingSetSize ?? 0) / 1024),
          cpu: m.cpu.percentCPUUsage.toFixed(1),
        })),
      );
    }

    const totalMemoryMB = metrics.reduce(
      (sum, m) => sum + (m.memory?.workingSetSize ?? 0) / 1024,
      0,
    );
    if (totalMemoryMB > MEMORY_LIMIT_WARNING_MB) {
      try {
        const { addBreadcrumb } = require('@sentry/electron/main') as {
          addBreadcrumb: (breadcrumb: Record<string, unknown>) => void;
        };
        addBreadcrumb({
          category: 'memory',
          message: `Total process memory: ${Math.round(totalMemoryMB)}MB`,
          level: 'warning',
          data: {
            processes: metrics.map((m) => ({
              type: m.type,
              name: m.name,
              memoryMB: Math.round((m.memory?.workingSetSize ?? 0) / 1024),
              cpu: m.cpu.percentCPUUsage,
            })),
          },
        });
      } catch (_e) {
        // ignore
      }
    }
  }, METRICS_SAMPLE_INTERVAL_MS);
}

async function collectGPUInfo() {
  try {
    const gpuInfo = await app.getGPUInfo('complete');
    logger.info('[GPU Info] Complete GPU information collected');

    try {
      const { setContext } = require('@sentry/electron/main') as {
        setContext: (
          name: string,
          context: Record<string, unknown> | null,
        ) => void;
      };
      const gpuDevice = (gpuInfo as any)?.gpuDevice?.[0];
      setContext('gpu', {
        vendorId: gpuDevice?.vendorId,
        deviceId: gpuDevice?.deviceId,
        driverVersion: gpuDevice?.driverVersion,
        driverVendor: gpuDevice?.driverVendor,
        auxAttributes: (gpuInfo as any)?.auxAttributes,
      });
    } catch (_e) {
      // ignore
    }
  } catch (error) {
    logger.error('[GPU Info] Failed to collect:', error);
  }
}

function startV8HeapMonitoring() {
  setInterval(() => {
    const heapStats = v8.getHeapStatistics();
    const usedMB = Math.round(heapStats.used_heap_size / 1024 / 1024);
    const limitMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
    const usagePercent = (
      (heapStats.used_heap_size / heapStats.heap_size_limit) *
      100
    ).toFixed(1);

    if (Number(usagePercent) > 70) {
      logger.warn(`[V8 Heap] ${usedMB}MB / ${limitMB}MB (${usagePercent}%)`, {
        totalHeapSize: heapStats.total_heap_size,
        totalPhysicalSize: heapStats.total_physical_size,
        allocatedMemory: heapStats.malloced_memory,
        externalMemory: heapStats.external_memory,
      });
    }
  }, MEMORY_CHECK_INTERVAL_MS);
}

/* oxlint-disable typescript/no-unsafe-call -- dynamic require('electron') returns untyped */
function startWebviewMemoryMonitoring() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const { webContents } = require('electron');
  setInterval(() => {
    const safelyMainWindow = getSafelyMainWindow();
    if (!safelyMainWindow || safelyMainWindow.isDestroyed()) return;

    const metrics = app.getAppMetrics();
    const metricsByPid = new Map(metrics.map((m) => [m.pid, m]));
    const allContents = webContents.getAllWebContents();
    for (const wc of allContents) {
      // eslint-disable-next-line no-continue
      if (wc.isDestroyed()) continue;
      try {
        const pid = wc.getOSProcessId();
        const metric = metricsByPid.get(pid);
        // eslint-disable-next-line no-continue
        if (!metric) continue;
        const memMB = Math.round((metric.memory?.workingSetSize ?? 0) / 1024);
        if (memMB > 300) {
          logger.warn(
            `[WebView Memory] pid=${pid} type=${wc.getType()} url=${wc.getURL().substring(0, 100)} memory=${memMB}MB`,
          );
        }
      } catch (_e) {
        // webContents may have been destroyed
      }
    }
  }, METRICS_SAMPLE_INTERVAL_MS);
}
/* oxlint-enable typescript/no-unsafe-call */

// In dev, app.getVersion() falls back to the electron binary version because
// no packaged app/package.json is on disk. Chromium builds the UA product
// token from app.getName() verbatim, so the actual default UA contains
// `OneKey Wallet/<electronVer>` (with the space from APP_NAME above) — and
// some packaging paths can also surface the no-space `OneKeyWallet/` form.
// Match both, and normalize to the canonical no-space `OneKeyWallet/<APP_VERSION>`
// that buildCustomUA() emits, so chromium and our X-Onekey-* injection agree.
// Run synchronously at module load (before `ready` fires) so the very first
// webContents created in the ready handler already sees the patched UA —
// `app.userAgentFallback` is readable/writable before `ready`.
try {
  // Escape every regex meta character (including backslash) before
  // interpolating into a RegExp source — process.versions.electron is
  // well-formed in practice, but CodeQL flags partial escapes and the
  // strict version is a one-liner.
  const electronVer = process.versions.electron.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  // process.env.VERSION is substituted at build time by webpack DefinePlugin
  // (apps/desktop/scripts/build.js) — the same path every other call site
  // uses. Falls back to '1' to match buildCustomUA()'s fallback in
  // packages/shared/src/request/customUA.ts.
  const appVersion = process.env.VERSION || '1';
  app.userAgentFallback = app.userAgentFallback.replace(
    new RegExp(`OneKey ?Wallet/${electronVer}\\b`),
    `OneKeyWallet/${appVersion}`,
  );
} catch (error) {
  logger.warn('[user-agent] failed to align chromium UA version', error);
}

// Start monitoring when app is ready
app.on('ready', async () => {
  startMemoryMonitoring();
  startProcessMetricsMonitoring();
  startV8HeapMonitoring();
  startWebviewMemoryMonitoring();
  startCpuWatchdog();
  scheduleCrashDumpCleanup();
  await collectGPUInfo();
});

// Stop monitoring when app quits
app.on('before-quit', () => {
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
    memoryMonitorInterval = null;
    logger.info('[Memory Monitor] Stopped monitoring');
  }
});

// ==================== End Memory Protection ====================

// ==================== CPU Watchdog ====================
// Detects sustained renderer CPU saturation (the symptom seen in
// long-uptime users whose JS main thread hot-loops). Pairs with the
// webContents 'unresponsive' event for the "stuck, not acknowledging
// input" symptom. Both converge here so the dialog and cooldown are
// shared.

// Sample at the faster cadence; both tiers read from the same history.
const CPU_WATCHDOG_SAMPLE_INTERVAL_MS = 10_000;

// Severe tier — catches extreme pegging fast.
// 3 × 10 s = 30 s sustained above 95% → essentially fully pegged for half
// a minute, well past any legitimate hot path (signing, V8 turbofan
// re-optimization, bundle decode, mass import).
const CPU_WATCHDOG_SEVERE_THRESHOLD_PERCENT = 95;
const CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES = 3;

// Mild tier — catches slower drift (the original 22h-uptime symptom).
// 30 × 10 s = 5 minutes sustained above 80%.
const CPU_WATCHDOG_MILD_THRESHOLD_PERCENT = 80;
const CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES = 30;

const CPU_WATCHDOG_HISTORY_SIZE = CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES;
const CPU_WATCHDOG_COOLDOWN_MS = 30 * 60_000;

const cpuHistoryByPid = new Map<number, number[]>();
// Cumulative CPU seconds per pid at the previous tick. Delta of these
// divided by wall-clock delta gives the true "fraction of one core" used,
// independent of how many cores the machine has — matching the DevTools
// Performance Monitor reading.
const prevCumCpuByPid = new Map<number, number>();
let lastSampleAt: number | null = null;
let lastWatchdogFiredAt = 0;
let cpuWatchdogInterval: ReturnType<typeof setInterval> | null = null;

type ICpuWatchdogReason =
  | 'sustained-high-cpu-severe'
  | 'sustained-high-cpu-mild'
  | 'unresponsive';

const CPU_WATCHDOG_REASONS = new Set<ICpuWatchdogReason>([
  'sustained-high-cpu-severe',
  'sustained-high-cpu-mild',
  'unresponsive',
]);

function isCpuWatchdogReason(value: unknown): value is ICpuWatchdogReason {
  return (
    typeof value === 'string' &&
    CPU_WATCHDOG_REASONS.has(value as ICpuWatchdogReason)
  );
}

function startCpuWatchdog() {
  if (cpuWatchdogInterval) {
    clearInterval(cpuWatchdogInterval);
  }
  cpuWatchdogInterval = setInterval(() => {
    try {
      const metrics = app.getAppMetrics();
      const now = Date.now();
      const wallDeltaSec =
        lastSampleAt === null
          ? CPU_WATCHDOG_SAMPLE_INTERVAL_MS / 1000
          : (now - lastSampleAt) / 1000;
      lastSampleAt = now;

      // Step 1: compute effective % (= fraction of one core, 100 = one core
      // fully busy) for every process using the cumulativeCPUUsage delta.
      // This matches what Chrome DevTools Performance Monitor shows and is
      // independent of total core count — Electron's percentCPUUsage divides
      // by cores and is therefore unusable for "main thread saturated".
      const annotated = metrics.map((m) => {
        const cum =
          (m.cpu as { cumulativeCPUUsage?: number }).cumulativeCPUUsage ?? 0;
        const prev = prevCumCpuByPid.get(m.pid);
        let effectivePercent = 0;
        if (prev !== undefined && wallDeltaSec > 0) {
          effectivePercent = ((cum - prev) / wallDeltaSec) * 100;
          if (effectivePercent < 0) effectivePercent = 0;
        }
        prevCumCpuByPid.set(m.pid, cum);
        return {
          pid: m.pid,
          type: m.type,
          name: m.name,
          electronPct: Number(m.cpu.percentCPUUsage.toFixed(2)),
          effectivePct: Number(effectivePercent.toFixed(1)),
          cum: Number(cum.toFixed(2)),
        };
      });

      // Step 2: log every process sorted by effective CPU descending so
      // when "who's burning" is the question, the top line answers it.
      const sortedForLog = [...annotated].toSorted(
        (a, b) => b.effectivePct - a.effectivePct,
      );
      logger.info(
        `[CPU Watchdog] tick cores=${os.cpus().length} wallΔ=${wallDeltaSec.toFixed(
          1,
        )}s processes=${JSON.stringify(sortedForLog)}`,
      );

      // Step 3: only Tab processes feed the sliding window for severe/mild
      // detection. effectivePct is the right metric: 100 = one core fully
      // busy = JS main thread saturated.
      const seenPids = new Set<number>();
      for (const a of annotated) {
        if (a.type === 'Tab') {
          seenPids.add(a.pid);
          // Skip the very first sample for a new pid — no delta available
          // (prev was undefined → effectivePct defaulted to 0).
          if (prevCumCpuByPid.has(a.pid) && a.effectivePct === 0) {
            // proceed with 0 — actually idle
          }
          const history = cpuHistoryByPid.get(a.pid) ?? [];
          history.push(a.effectivePct);
          if (history.length > CPU_WATCHDOG_HISTORY_SIZE) history.shift();
          cpuHistoryByPid.set(a.pid, history);

          const severeWindow = history.slice(
            -CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
          );
          const severe =
            severeWindow.length === CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES &&
            severeWindow.every(
              (v) => v > CPU_WATCHDOG_SEVERE_THRESHOLD_PERCENT,
            );
          if (severe) {
            triggerCpuWatchdog({
              reason: 'sustained-high-cpu-severe',
              pid: a.pid,
              cpuTrend: severeWindow,
            });
          } else {
            const mild =
              history.length === CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES &&
              history.every((v) => v > CPU_WATCHDOG_MILD_THRESHOLD_PERCENT);
            if (mild) {
              triggerCpuWatchdog({
                reason: 'sustained-high-cpu-mild',
                pid: a.pid,
                cpuTrend: [...history],
              });
            }
          }
        }
      }
      // Forget pids that no longer exist (renderer restarted / process gone).
      for (const pid of cpuHistoryByPid.keys()) {
        if (!seenPids.has(pid)) cpuHistoryByPid.delete(pid);
      }
      // Also prune prev cum cache for vanished pids to avoid unbounded growth.
      for (const pid of prevCumCpuByPid.keys()) {
        if (!annotated.some((a) => a.pid === pid)) prevCumCpuByPid.delete(pid);
      }
    } catch (error) {
      logger.warn('[CPU Watchdog] sample failed', error);
    }
  }, CPU_WATCHDOG_SAMPLE_INTERVAL_MS);
  logger.info('[CPU Watchdog] started', {
    sampleIntervalMs: CPU_WATCHDOG_SAMPLE_INTERVAL_MS,
    severe: {
      thresholdPercent: CPU_WATCHDOG_SEVERE_THRESHOLD_PERCENT,
      sustainedSamples: CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
    },
    mild: {
      thresholdPercent: CPU_WATCHDOG_MILD_THRESHOLD_PERCENT,
      sustainedSamples: CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES,
    },
    cooldownMs: CPU_WATCHDOG_COOLDOWN_MS,
  });
}

function reportWatchdogToSentry(params: {
  reason: ICpuWatchdogReason;
  pid?: number;
  cpuTrend?: number[];
}) {
  try {
    const { captureMessage, setContext } = require('@sentry/electron/main') as {
      captureMessage: (msg: string, level?: string) => void;
      setContext: (name: string, data: Record<string, unknown> | null) => void;
    };
    setContext('cpuWatchdog', {
      reason: params.reason,
      pid: params.pid,
      cpuTrend: params.cpuTrend,
      uptimeMs: Math.round(process.uptime() * 1000),
    });
    captureMessage(`desktop:cpu-watchdog:${params.reason}`, 'warning');
  } catch {
    // Sentry not initialized — ignore.
  }
}

function triggerCpuWatchdog(params: {
  reason: ICpuWatchdogReason;
  pid?: number;
  cpuTrend?: number[];
  bypassCooldown?: boolean;
}) {
  const now = Date.now();
  if (
    !params.bypassCooldown &&
    now - lastWatchdogFiredAt < CPU_WATCHDOG_COOLDOWN_MS
  ) {
    logger.warn('[CPU Watchdog] trigger ignored — cooldown active', {
      reason: params.reason,
      msSinceLastFire: now - lastWatchdogFiredAt,
      cooldownMs: CPU_WATCHDOG_COOLDOWN_MS,
    });
    return;
  }
  lastWatchdogFiredAt = now;

  // UI suppressed: only collect local logs + Sentry telemetry while we
  // investigate the underlying CPU regression. Re-enable surface (status
  // indicator / non-blocking card) once root cause is identified.
  logger.warn('[CPU Watchdog] fired (UI suppressed)', params);
  reportWatchdogToSentry(params);
}

function resetCpuWatchdogStateForTesting() {
  logger.warn('[CPU Watchdog] cooldown reset via IPC', {
    previousLastFiredAt: lastWatchdogFiredAt,
  });
  lastWatchdogFiredAt = 0;
  cpuHistoryByPid.clear();
  prevCumCpuByPid.clear();
  lastSampleAt = null;
}

app.on('before-quit', () => {
  if (cpuWatchdogInterval) {
    clearInterval(cpuWatchdogInterval);
    cpuWatchdogInterval = null;
  }
});

// ==================== End CPU Watchdog ====================

// Dev-only switches — NEVER run in production builds
if (isDevServer && !app.isPackaged) {
  // OK-8096: webview crashed on pages with COOP headers (e.g. Google Search).
  // Root cause was Electron bugs #25872 / #25469, fixed in Electron 18+.
  // No longer needed in production (we're on Electron 39.x), kept for dev only.
  app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');
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
