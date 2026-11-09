/* eslint-disable dot-notation */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, format as formatUrl } from 'url';
import v8 from 'v8';

import { EOneKeyBleMessageKeys } from '@onekeyfe/hd-shared';
import {
  disposeNobleBleSupport,
  initNobleBleSupport,
} from '@onekeyfe/hd-transport-electron';
import { initThirdPartyBleSupport } from '@onekeyfe/hwk-desktop-noble-ble';
import { THIRD_PARTY_BLE_CHANNELS } from '@onekeyfe/hwk-desktop-noble-ble/constants';
import {
  BrowserWindow,
  Menu,
  app,
  webContents as electronWebContents,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inAppPurchase,
  ipcMain,
  nativeTheme,
  net,
  powerMonitor,
  session,
  shell,
} from 'electron';
import contextMenu from 'electron-context-menu';
import electronIsDev from 'electron-is-dev';
import logger from 'electron-log/main';

import { CALL_DESKTOP_API_EVENT_NAME } from '@onekeyhq/kit-bg/src/desktopApis/base/consts';
import {
  getFiatPaySiteWhitelistDomainKeys,
  getFiatPaySiteWhitelistOrigins,
  getOriginDomainKey,
  getTemplatePhishingUrls,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import desktopApi, {
  getDesktopApiAppUpdate,
} from '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApi';
import {
  TRADING_VIEW_LOCALHOST_ORIGIN,
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import {
  APP_MENU_GITHUB_URL,
  APP_MENU_HELP_CENTER_URL,
  APP_MENU_OFFICIAL_WEBSITE_URL,
  APP_MENU_X_URL,
} from '@onekeyhq/shared/src/consts/appMenuConsts';
import { DESKTOP_WEBVIEW_OVERLAY_PARTITION } from '@onekeyhq/shared/src/consts/desktopWebviewPartitions';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { makeIpcSafeError } from '@onekeyhq/shared/src/errors/utils/ipcSafeError';
import { sanitizeTrezorThpModuleLogData } from '@onekeyhq/shared/src/hardware/trezorThpLogRedact';
import { resolveDesktopCustomUAHeaders } from '@onekeyhq/shared/src/request/customUA';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';

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
import { createBeforeQuitHandler } from './libs/appQuitHandlers';
import {
  applyBootFailThresholds,
  resetBootFailCountOnGracefulQuit,
} from './libs/bootFailRecovery';
import {
  CPU_WATCHDOG_COOLDOWN_MS,
  CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES,
  CPU_WATCHDOG_MILD_THRESHOLD_PERCENT,
  CPU_WATCHDOG_RECOVERY_SUSTAINED_SAMPLES,
  CPU_WATCHDOG_RECOVERY_THRESHOLD_PERCENT,
  CPU_WATCHDOG_SAMPLE_INTERVAL_MS,
  CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
  CPU_WATCHDOG_SEVERE_THRESHOLD_PERCENT,
  CPU_WATCHDOG_STARTUP_GRACE_MS,
  CpuWatchdogController,
  isCpuWatchdogReason,
} from './libs/cpuWatchdog';
import { scheduleCrashDumpCleanup } from './libs/crashDumpCleanup';
import {
  findAllowedDeepLinkArg,
  resolveDesktopRuntimeFlags,
} from './libs/deepLink';
import {
  createDeepLinkHandler,
  createSecondInstanceHandler,
} from './libs/deepLinkHandler';
import {
  DESKTOP_API_ALLOWED_MODULES,
  isDesktopApiMethodAllowed,
} from './libs/desktopApiModuleAllowlist';
import { createFetchStreamRelay } from './libs/fetchStreamRelay';
import {
  createMainWindowClosedHandler,
  createSafelyBrowserWindowGetter,
  getMainWindow,
  getSafelyMainWindow,
  setMainWindow,
  showMainWindow,
} from './libs/mainWindowAccess';
import { createMainWindowFactory } from './libs/mainWindowFactory';
import {
  createMainWindowSenderTrustPredicate,
  createShellDocumentTrustState,
  installMainWindowShellNavigationHandlers,
} from './libs/mainWindowShellTrust';
import { installMainWindowShortcutHandlers } from './libs/mainWindowShortcutHandlers';
import {
  applyDesktopNetworkThrottleToKnownSessions,
  applyDesktopNetworkThrottleToWebContents,
} from './libs/networkThrottle';
import { openExternalUrl } from './libs/openExternalUrl';
import { createPrimeStripeRequestMonitor } from './libs/primeStripeRequestMonitor';
import { PROTOCOL } from './libs/protocol';
// Side-effect import: registers synchronous IPC handler for renderer MMKV access
// eslint-disable-next-line import-js/order
import './libs/react-native-mmkv-desktop-main';
import { registerDesktopProtocolClients } from './libs/registerDesktopProtocolClients';
import { registerInfoHandlers } from './libs/registerInfoHandlers';
import {
  createDidFailLoadHandler,
  createMainRendererRecoveryState,
  createRenderProcessGoneHandler,
} from './libs/rendererRecoveryHandlers';
import { registerShortcuts, unregisterShortcuts } from './libs/shortcuts';
import { createSoftRestartRenderer } from './libs/softRestart';
import * as store from './libs/store';
import { getBackgroundColor } from './libs/utils';
import {
  isWcPayEmbedUrl,
  stripFrameBlockingHeaders,
} from './libs/wcPayFrameEmbedding';
import { shouldGrantMainWindowDevicePermission } from './libs/webUsbDeviceSelection';
// Logger initialization (file rotation, sanitization, rate limiting)
import './logger';
import initProcess from './process';
import { setMainWindowForHttpServer } from './process/HttpServer';
import { logTrezorBleFlags } from './process/trezorBleFlags';
import { createTrezorBlePairingIpcMain } from './process/trezorBlePairing';
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

import type { ICpuWatchdogReason } from './libs/cpuWatchdog';
import type { IpcMainLike } from '@onekeyfe/hwk-desktop-noble-ble';

export type { IDesktopOpenUrlEventData } from './libs/deepLinkHandler';

// cspell:ignore pkexec
// Main-process (sender) side of the DESKTOP_API_CALL IPC boundary: normalize
// errors/results so Electron's structured clone never throws "An object could
// not be cloned" (notably for execFile/pkexec errors on Linux/flatpak). The
// `.message` is preserved verbatim so the renderer-side counterpart,
// `unwrapElectronIpcError` (packages/shared/src/errors/utils/electronIpcError.ts),
// can still recover any `{ message, code, data }` payload encoded in it.

// cspell:ignore pkexec
// Main-process (sender) side of the DESKTOP_API_CALL IPC boundary: normalize
// errors/results so Electron's structured clone never throws "An object could
// not be cloned" (notably for execFile/pkexec errors on Linux/flatpak). The
// `.message` is preserved verbatim so the renderer-side counterpart,
// `unwrapElectronIpcError` (packages/shared/src/errors/utils/electronIpcError.ts),
// can still recover any `{ message, code, data }` payload encoded in it.
function makeIpcSafeResult(result: unknown): unknown {
  try {
    structuredClone(result);
    return result;
  } catch (error) {
    try {
      return JSON.parse(JSON.stringify(result)) as unknown;
    } catch {
      throw makeIpcSafeError(error, 'DESKTOP_API_CALL returned unsafe result');
    }
  }
}

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

// SECURITY: never allow development or unpacked modes (such as ELECTRON_IS_DEV=1
// or PERF_CI_MODE=1) in packaged builds; they enable unpacked file/URL loading
// and skip production file:// hash/GPG checks.
const { isDev, isPerfCiMode, isDevServer, isLocalUnpacked, isDesktopE2EMode } =
  resolveDesktopRuntimeFlags({
    isPackaged: app.isPackaged,
    electronIsDev,
    env: process.env,
  });

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
let isAppReady = false;

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

const TRADING_VIEW_ORIGINS = new Set([
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
  TRADING_VIEW_LOCALHOST_ORIGIN,
]);

function isTradingViewWebContents(contents: Electron.WebContents): boolean {
  try {
    return TRADING_VIEW_ORIGINS.has(new URL(contents.getURL()).origin);
  } catch {
    return false;
  }
}

// Electron zoom roles target getFocusedWebContents(), which prefers any <webview> guest in the
// focused window. For TradingView that zooms only the chart page, so zoom its host window instead.
function getZoomTargetWebContents(): Electron.WebContents | null {
  const focused = electronWebContents.getFocusedWebContents();
  if (focused?.getType() === 'webview' && isTradingViewWebContents(focused)) {
    return focused.hostWebContents ?? focused;
  }
  return focused;
}

function adjustZoomLevel(delta: number | 'reset'): void {
  const target = getZoomTargetWebContents();
  if (!target) {
    return;
  }
  target.zoomLevel = delta === 'reset' ? 0 : target.zoomLevel + delta;
}

const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';

let systemIdleInterval: ReturnType<typeof setInterval>;

// The built-in `toggleDevTools` role targets the focused webContents, which
// can be an embedded <webview> (even one in a hidden tab), so the main window
// shortcut must target the main window explicitly.
const toggleMainWindowDevTools = () => {
  getSafelyMainWindow()?.webContents.toggleDevTools();
};

const toggleFocusedWebViewDevTools = () => {
  const focused = electronWebContents.getFocusedWebContents();
  if (!focused || focused.isDestroyed()) {
    return;
  }
  // Webview DevTools always open detached and take focus, so resolve the
  // inspected webview from its DevTools frontend to allow closing it again.
  const inspected = electronWebContents
    .getAllWebContents()
    .find((contents) => contents.devToolsWebContents === focused);
  const target = inspected ?? focused;
  if (target.isDestroyed() || target.getType() !== 'webview') {
    return;
  }
  target.toggleDevTools();
};

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
              {
                label: isDevServer
                  ? `Toggle Developer Tools: ${store.getDevTools().toString()}`
                  : 'Toggle Developer Tools',
                accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
                click: toggleMainWindowDevTools,
              },
              {
                label: 'Toggle WebView Developer Tools',
                accelerator: isMac ? 'Alt+Shift+Command+I' : 'Ctrl+Alt+Shift+I',
                click: toggleFocusedWebViewDevTools,
              },
              { type: 'separator' },
            ].filter(Boolean)
          : []),
        {
          label: i18nText(ElectronTranslations.menu_actual_size),
          accelerator: 'CmdOrCtrl+0',
          click: () => adjustZoomLevel('reset'),
        },
        {
          label: i18nText(ElectronTranslations.menu_zoom_in),
          accelerator: isMac ? 'CmdOrCtrl+Plus' : 'CmdOrCtrl+Shift+]',
          click: () => adjustZoomLevel(0.5),
        },
        {
          label: i18nText(ElectronTranslations.menu_zoom_out),
          accelerator: isMac ? 'CmdOrCtrl+-' : 'CmdOrCtrl+Shift+[',
          click: () => adjustZoomLevel(-0.5),
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
            await shell.openExternal(APP_MENU_HELP_CENTER_URL);
          },
        },
        { type: 'separator' },
        {
          label: i18nText(ElectronTranslations.menu_official_website),
          click: async () => {
            await shell.openExternal(APP_MENU_OFFICIAL_WEBSITE_URL);
          },
        },
        {
          label: 'Github',
          click: async () => {
            await shell.openExternal(APP_MENU_GITHUB_URL);
          },
        },
        {
          label: 'X',
          click: async () => {
            await shell.openExternal(APP_MENU_X_URL);
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
const handleDeepLinkUrl = createDeepLinkHandler({
  logger,
  getSafelyMainWindow,
  showMainWindow,
  getIsAppReady: () => isAppReady,
  setAppReady: (ready) => {
    isAppReady = ready;
  },
  hasMainWindow: () => Boolean(getMainWindow()),
  emitter,
});

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
let bleQuitStarted = false;
let bleQuitReady = false;
let appQuitStarted = false;
const mainRendererRecoveryState = createMainRendererRecoveryState();
let nobleBleInitialization = Promise.resolve();
let trezorBleWindowCleanup = Promise.resolve();
// Retain retired handlers so recovery-created native instances survive until app quit.
const trezorBleSupports = new Set<
  ReturnType<typeof initThirdPartyBleSupport>
>();
const createMainWindow = createMainWindowFactory(createMainWindowImpl);
const { softRestartRenderer, isSoftRestarting } = createSoftRestartRenderer({
  logger,
  app,
  store,
  getTrayWindow,
  destroyTrayWindow,
  setAppReady: (ready) => {
    isAppReady = ready;
  },
  session,
  createMainWindow,
  getBundleIndexHtmlPath: () =>
    globalThis.$desktopMainAppFunctions?.getBundleIndexHtmlPath?.(),
  getProcessMas: () => process.mas,
});

async function createMainWindowImpl(opts?: { isSoftRestart?: boolean }) {
  await trezorBleWindowCleanup;
  if (bleQuitStarted) return null;
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
  let bootFailCount = store.incrementConsecutiveBootFailCount();
  logger.info('Boot fail count:', bootFailCount, { isSoftRestart });
  const bootFailRecovery = applyBootFailThresholds<BrowserWindow>({
    store,
    logger,
    appVersion: currentAppVersion,
    bootFailCount,
    createRecoveryWindow,
  });
  bootFailCount = bootFailRecovery.bootFailCount;
  const recoveryWin = bootFailRecovery.recoveryWindow;
  if (recoveryWin) {
    setMainWindow(recoveryWin);
    recoveryWin.on('closed', () => {
      if (getMainWindow() === recoveryWin) {
        setMainWindow(null);
      }
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
      // Disabling origin checks breaks Turnstile child-frame commits in
      // Chromium and terminates the renderer, even during development.
      webSecurity: true,
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
  setMainWindow(browserWindow);

  const getSafelyBrowserWindow = createSafelyBrowserWindowGetter(
    () => browserWindow,
  );

  store.processPreLaunchPendingTask();
  const bundleData = store.getUpdateBundleData();
  logger.info('bundleData >>>> ', bundleData);
  let bundleIndexHtmlPath = getBundleIndexHtmlPath(bundleData);
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
    getRevenueCat: async () =>
      (await import('./service/revenueCat/revenueCat')).default,
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

  const shellTrustState = createShellDocumentTrustState();
  globalThis.$desktopMainAppFunctions.isTrustedMainWindowSender =
    createMainWindowSenderTrustPredicate({
      state: shellTrustState,
      getSafelyMainWindow,
      getSafelyBrowserWindow,
      getAppShellUrl: () => src,
      isDevServer,
    });

  installMainWindowShellNavigationHandlers({
    browserWindow,
    state: shellTrustState,
    getAppShellUrl: () => src,
    isDevServer,
    getSafelyBrowserWindow,
    logger,
  });

  if (isDevServer && !isDesktopE2EMode) {
    browserWindow.webContents.openDevTools();
  }

  // Set main window reference for OAuth server
  setMainWindowForOAuthServer(browserWindow);
  // Tray shares the same preload, so SERVER_* must be scoped to the main
  // renderer via sender-id checks in HttpServer.
  setMainWindowForHttpServer(browserWindow);

  // Protocol handler for cold startup command-line URLs
  // Skip on soft restart: process.argv is unchanged across an in-process
  // recreate, so replaying the launch deep link here would re-dispatch the
  // original cold-start URL (e.g. a WalletConnect pairing or send screen) after
  // every bundle update. Only a genuine cold boot should consume argv.
  if ((isWin || isMac || isLinux) && !isSoftRestart) {
    const deeplinkingUrl = findAllowedDeepLinkArg(process.argv);
    if (deeplinkingUrl) {
      handleDeepLinkUrl(null, deeplinkingUrl, process.argv, true);
    }
  }

  browserWindow.webContents.on('unresponsive', () => {
    logger.warn('[CPU Watchdog] renderer webContents unresponsive');
    let pid: number | undefined;
    try {
      if (
        !browserWindow.isDestroyed() &&
        !browserWindow.webContents.isDestroyed()
      ) {
        pid = browserWindow.webContents.getOSProcessId();
      }
    } catch {
      pid = undefined;
    }
    triggerCpuWatchdog({ reason: 'unresponsive', pid });
  });
  browserWindow.webContents.on('responsive', () => {
    logger.info('[CPU Watchdog] renderer webContents responsive again');
    let pid: number | undefined;
    try {
      if (
        !browserWindow.isDestroyed() &&
        !browserWindow.webContents.isDestroyed()
      ) {
        pid = browserWindow.webContents.getOSProcessId();
      }
    } catch {
      pid = undefined;
    }
    markCpuWatchdogResponsive(pid);
  });

  browserWindow.webContents.on(
    'render-process-gone',
    createRenderProcessGoneHandler({
      state: mainRendererRecoveryState,
      getSafelyBrowserWindow,
      getAppShellUrl: () => src,
      isAppQuitStarted: () => appQuitStarted,
      isBleQuitStarted: () => bleQuitStarted,
      isSoftRestarting,
      setAppReady: (ready) => {
        isAppReady = ready;
      },
    }),
  );

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
  browserWindow.on(
    'closed',
    createMainWindowClosedHandler({
      browserWindow,
      unregisterShortcuts,
      getAppReady: () => isAppReady,
      setAppReady: (ready) => {
        isAppReady = ready;
      },
      logger,
    }),
  );

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

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url);
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

  const { handleFetchStreamRequest } = createFetchStreamRelay({
    net,
    getIsTrustedMainWindowSender: () =>
      globalThis.$desktopMainAppFunctions.isTrustedMainWindowSender,
  });
  ipcMain.removeHandler(ipcMessageKeys.FETCH_STREAM);
  ipcMain.handle(ipcMessageKeys.FETCH_STREAM, handleFetchStreamRequest);

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
    mainRendererRecoveryState.bootFailed = false;
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
  const allowedModules = new Set<string>(DESKTOP_API_ALLOWED_MODULES);
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
      let isTrustedSender = false;
      let senderId = -1;
      try {
        if (!event.sender.isDestroyed()) {
          senderId = event.sender.id;
          isTrustedSender = Boolean(
            globalThis.$desktopMainAppFunctions.isTrustedMainWindowSender?.(
              senderId,
              event.senderFrame,
              event.sender.mainFrame,
            ),
          );
        }
      } catch {
        isTrustedSender = false;
      }
      if (!isTrustedSender) {
        logger.warn(
          '[DESKTOP_API_CALL] Rejected call from non-main renderer',
          senderId,
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
      if (!isDesktopApiMethodAllowed(module, method)) {
        throw new OneKeyLocalError(
          `DESKTOP_API_CALL: disallowed method "${method}"`,
        );
      }
      try {
        const result: unknown = await desktopApi.callDesktopApiMethod({
          type: 'DESKTOP_API_IPC_MESSAGE',
          module: module as any,
          method,
          params,
        });
        return makeIpcSafeResult(result);
      } catch (error) {
        logger.error('[DESKTOP_API_CALL] handler failed', {
          module,
          method,
          error: error instanceof Error ? error.message : String(error),
        });
        throw makeIpcSafeError(error, 'DESKTOP_API_CALL failed');
      }
    },
  );

  installMainWindowShortcutHandlers({
    browserWindow,
    getSafelyBrowserWindow,
    getBleQuitStarted: () => bleQuitStarted,
    ipcMessageKeys,
    registerShortcuts,
    unregisterShortcuts,
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
          logger.info('overlay pre-navigation block (main process)');
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
          logger.info('reject navigate main process will-frame-navigate');
          return false;
        }

        if (uriUtils.isValidDeepLink(url)) {
          e.preventDefault();
          logger.info('reject deeplink in main process');
          return false;
        }
      });
    }
  });

  const filter: Electron.WebRequestFilter = {
    urls: ['http://*/*', 'https://*/*'],
    // Only XHR/fetch carry the UA bridge. Keep every destination so Chromium's
    // original bridge header is also removed after cross-origin redirects.
    types: ['xhr'],
  };

  // WebUSB permission handlers - Enable WebUSB support for hardware wallet connections

  browserWindow.webContents.session.setDevicePermissionHandler((details) => {
    // WebHID has no protected-class blocklist (unlike WebUSB), so tighten HID
    // to Ledger vendorId only. USB is scoped to the trusted main window session;
    // arbitrary dapp webviews use the separate persist:onekey deny-by-default
    // session below.
    return shouldGrantMainWindowDevicePermission(details);
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
      let requestHeaders = resolveDesktopCustomUAHeaders(
        url,
        details.requestHeaders,
      );
      if (
        url.startsWith('http://127.0.0.1:21320/') ||
        url.startsWith('http://localhost:21320/')
      ) {
        // resolve onekey bridge CORS error
        requestHeaders = {
          ...requestHeaders,
          Origin: 'https://jssdk.onekey.so',
        };
      } else if (url.startsWith('https://mainnet.optimism.io/')) {
        // add metamask header to resolve rate-limit
        requestHeaders = {
          ...requestHeaders,
          Origin: 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn',
        };
      }

      callback(
        requestHeaders === details.requestHeaders ? {} : { requestHeaders },
      );
    },
  );

  const primeStripeRequestMonitor = createPrimeStripeRequestMonitor(
    () => getSafelyMainWindow()?.webContents,
  );
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['https://js.stripe.com/*'] },
    (details, callback) => {
      primeStripeRequestMonitor.recordRequest(details);
      callback({});
    },
  );
  session.defaultSession.webRequest.onErrorOccurred(
    { urls: ['https://js.stripe.com/*'] },
    (details) => primeStripeRequestMonitor.forgetRequest(details.id),
  );

  // Inject security response headers for the app's own pages only.
  // Scoped to file:// and localhost to avoid interfering with external API responses.
  //
  // The WalletConnect Pay hosts are the one exception: their compliance form
  // is embedded in an iframe (official web integration path), but its CSP
  // `frame-ancestors https:` rejects the desktop renderer origin (file:// in
  // prod, http://localhost in dev). Strip only the frame-blocking headers for
  // those hosts; the rest of their CSP stays enforced. Electron replaces the
  // previous onHeadersReceived listener on re-registration, so both concerns
  // must share this single registration.
  session.defaultSession.webRequest.onHeadersReceived(
    {
      urls: [
        'file://*',
        'http://localhost:*/*',
        'https://pay.walletconnect.com/*',
        'https://*.pay.walletconnect.com/*',
        'https://js.stripe.com/*',
      ],
    },
    (details, callback) => {
      if (details.url.startsWith('https://js.stripe.com/')) {
        primeStripeRequestMonitor.receiveResponse(details);
        callback({});
        return;
      }
      if (isWcPayEmbedUrl(details.url)) {
        callback({
          responseHeaders: stripFrameBlockingHeaders(details.responseHeaders),
        });
        return;
      }
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
    if (bundleDirPath) {
      try {
        metadata = await getMetadata({
          bundleDir: bundleDirPath,
          appVersion: bundleData.appVersion,
          bundleVersion: bundleData.bundleVersion,
          signature: bundleData.signature,
        });
      } catch (e) {
        // GPG verification failed or metadata unreadable — clear broken OTA
        // bundle pointer and disable JS bundle so the interceptor falls back
        // to the builtin bundle in the asar.
        logger.error('getMetadata failed, falling back to builtin bundle:', e);
        store.clearUpdateBundleData();
        bundleIndexHtmlPath = undefined;
        useJsBundle = false;
        /* eslint-disable no-nested-ternary */
        src = isPerfCiMode
          ? formatUrl({
              pathname: perfIndexHtmlPath,
              protocol: PROTOCOL,
              slashes: true,
            })
          : isDev
            ? process.env.DESKTOP_E2E_RENDERER_URL || 'http://localhost:3001/'
            : formatUrl({
                pathname: 'index.html',
                protocol: PROTOCOL,
                slashes: true,
              });
        /* eslint-enable no-nested-ternary */
        shellTrustState.selectedShellDocumentCommitted = false;
        shellTrustState.trustedSameDocumentRouteUrl = undefined;
      }
    }
    uninterceptFileProtocolIfNeeded();
    session.defaultSession.protocol.interceptFileProtocol(
      PROTOCOL,
      (request, callback) => {
        try {
          const cleanUrl = request.url.split(/[?#]/, 1)[0];
          const isJsSdkFile = cleanUrl.indexOf('/static/js-sdk') > -1;
          const isIFrameHtml = cleanUrl.endsWith('/static/js-sdk/iframe.html');

          // resolve iframe path
          if (isJsSdkFile && isIFrameHtml) {
            if (useJsBundle && indexHtmlPath && bundleDirPath) {
              let key = path.join('static', 'js-sdk', 'iframe.html');
              const filePath = path.join(bundleDirPath, key);
              if (isWin) {
                key = key.replace(/\\/g, '/');
              }
              const sha512 =
                Object.prototype.hasOwnProperty.call(metadata, key) &&
                typeof metadata[key] === 'string'
                  ? metadata[key]
                  : undefined;
              if (!sha512 || !checkFileSha512(filePath, sha512)) {
                logger.info(
                  'checkFileHash error in js-sdk:',
                  `${key}:  ${filePath} not matched ${sha512 ?? ''}`,
                );
                store.clearUpdateBundleData();
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

          const url = cleanUrl.substring(PROTOCOL.length + 1);
          if (useJsBundle && indexHtmlPath && bundleDirPath) {
            let decodedUrl: string;
            try {
              decodedUrl = decodeURIComponent(url);
            } catch {
              callback({ error: -6 } as any);
              return;
            }
            const normalizedDecodedUrl = decodedUrl.replace(/\\/g, '/');
            const normalizedBundleDirPath = bundleDirPath.replace(/\\/g, '/');
            if (normalizedDecodedUrl.includes(normalizedBundleDirPath)) {
              const filePath = checkFileHash({
                bundleDirPath,
                metadata,
                driveLetter,
                url: normalizedDecodedUrl.replace(normalizedBundleDirPath, ''),
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
            let decodedUrl: string;
            try {
              decodedUrl = decodeURIComponent(url);
            } catch {
              callback({ error: -6 } as any);
              return;
            }
            // Strip leading protocol slashes (e.g. "//index.html" → "index.html")
            // and Windows drive prefix so path.resolve treats the segment as relative.
            const relativeUrl = decodedUrl
              .replace(/^[:/\\]+/, '')
              .replace(/^[A-Za-z]:[\\/]/, '')
              .replace(/^[:/\\]+/, '');
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
        } catch (error) {
          logger.error('interceptFileProtocol error:', error);
          callback({ error: -6 } as any);
        }
      },
    );
    const safelyBrowserWindow = getSafelyBrowserWindow();
    safelyBrowserWindow?.webContents.on(
      'did-fail-load',
      createDidFailLoadHandler({
        state: mainRendererRecoveryState,
        getSafelyBrowserWindow,
        getAppShellUrl: () => src,
        isAppQuitStarted: () => appQuitStarted,
      }),
    );
  }

  void getSafelyBrowserWindow()?.loadURL(src);

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
    EOneKeyBleMessageKeys.NOBLE_BLE_RELEASE,
    EOneKeyBleMessageKeys.NOBLE_BLE_DISCONNECT,
    EOneKeyBleMessageKeys.NOBLE_BLE_WRITE,
    EOneKeyBleMessageKeys.NOBLE_BLE_SUBSCRIBE,
    EOneKeyBleMessageKeys.NOBLE_BLE_UNSUBSCRIBE,
    EOneKeyBleMessageKeys.NOBLE_BLE_CANCEL_PAIRING,
    EOneKeyBleMessageKeys.BLE_AVAILABILITY_CHECK,
  ];
  if (bleQuitStarted) return browserWindow;
  nobleBleChannels.forEach((channel) => ipcMain.removeHandler(channel));
  nobleBleInitialization = initNobleBleSupport(browserWindow.webContents).catch(
    (error) => logger.error('[NobleBLE] IPC initialization failed', error),
  );

  // Third-party BLE wiring — exposed to the renderer as the vendor-neutral
  // `window.desktopApi.thirdPartyBle` serves every third-party vendor through
  // one handler, namespaced ($onekey-3p-ble-*) to coexist with OneKey's `nobleBle`. A new vendor plugs in here, not a parallel object.
  Object.values(THIRD_PARTY_BLE_CHANNELS).forEach((channel) =>
    ipcMain.removeHandler(channel),
  );
  // The SDK registers its BLE IPC handlers ignoring `event.sender`. DApp
  // webviews share the same preload (`desktopApi.thirdPartyBle`) and could
  // otherwise drive BLE scan/connect/write. Gate every channel to the main
  // window renderer, matching the DESKTOP_API_CALL sender check.
  const thirdPartyBleSenderGatedIpcMain: IpcMainLike = {
    handle: (channel, listener) => {
      ipcMain.handle(channel, (event, ...args) => {
        let isMainRenderer = false;
        let senderId = -1;
        try {
          if (!event.sender.isDestroyed()) {
            senderId = event.sender.id;
            const currentMainWindow =
              getSafelyMainWindow() ?? getSafelyBrowserWindow();
            isMainRenderer = currentMainWindow?.webContents.id === senderId;
          }
        } catch {
          isMainRenderer = false;
        }
        if (!isMainRenderer) {
          logger.warn(
            '[ThirdPartyBLE] Rejected IPC from non-main renderer',
            channel,
            senderId,
          );
          throw new OneKeyLocalError(
            'Third-party BLE IPC is only allowed from the main window',
          );
        }
        return listener(event, ...args);
      });
    },
    removeHandler: (channel) => ipcMain.removeHandler(channel),
  };
  logTrezorBleFlags();
  const trezorBleSupport = initThirdPartyBleSupport(browserWindow.webContents, {
    // Insert Windows OS-pairing at the connect seam (SDK stays untouched):
    // caches scan address, runs the WinRT pairing helper before noble connects.
    // No-op on non-Windows / builds without the bundled helper.
    ipcMain: createTrezorBlePairingIpcMain(
      thirdPartyBleSenderGatedIpcMain,
      browserWindow,
    ),
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

  trezorBleSupports.add(trezorBleSupport);
  browserWindow.webContents.once('destroyed', () => {
    if (bleQuitStarted) return;
    trezorBleWindowCleanup = trezorBleSupport.dispose().catch((error) => {
      logger.error('[TrezorBLE] Window cleanup failed', error);
    });
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
  app.on(
    'second-instance',
    createSecondInstanceHandler({
      logger,
      getPlatform: () => process.platform,
      getSafelyMainWindow,
      showMainWindow,
      handleDeepLinkUrl,
    }),
  );

  app.on('ready', async (_, launchInfo) => {
    logger.info('launchInfo >>>> ', launchInfo);
    logger.info(
      `nativeAppVersion: ${app.getVersion()}, buildNumber: ${process.env.BUILD_NUMBER ?? ''}, builtinBundleVersion: ${process.env.BUNDLE_VERSION ?? ''}`,
    );
    const locale = await initLocale();
    logger.info('locale >>>> ', locale);

    if (!getMainWindow()) {
      setMainWindow(await createMainWindow());
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
  if (bleQuitStarted) return;
  // During a soft restart `mainWindow` is transiently null while
  // createMainWindow() runs. Skip creating a window here in that window of time,
  // otherwise a dock-icon click would spawn a SECOND main window (without
  // isSoftRestart, so it would also bump the boot-fail counter). softRestart's
  // own showMainWindow() will surface the recreated window.
  if (!getMainWindow() && !isSoftRestarting()) {
    setMainWindow(await createMainWindow());
  }
  showMainWindow();
});

app.on(
  'before-quit',
  createBeforeQuitHandler({
    app,
    isMac,
    logger,
    getDesktopApiAppUpdate,
    markAppQuitStarted: () => {
      appQuitStarted = true;
    },
    unregisterShortcuts,
    getBleQuitStarted: () => bleQuitStarted,
    setBleQuitStarted: (started) => {
      bleQuitStarted = started;
    },
    getBleQuitReady: () => bleQuitReady,
    setBleQuitReady: (ready) => {
      bleQuitReady = ready;
    },
    getNobleBleInitialization: () => nobleBleInitialization,
    getTrezorBleSupports: () => trezorBleSupports,
    disposeNobleBleSupport,
    getSafelyMainWindow,
    destroyTrayManager,
    resetBootFailCountOnGracefulQuit: () => {
      resetBootFailCountOnGracefulQuit({
        store,
        mainRendererBootFailed: mainRendererRecoveryState.bootFailed,
      });
    },
    clearSystemIdleInterval: () => {
      if (systemIdleInterval) {
        clearInterval(systemIdleInterval);
      }
    },
    disposeContextMenu: () => {
      disposeContextMenu?.();
    },
  }),
);

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
    webContentsType: webContents.getType(),
    isMainWindow: webContents === getSafelyMainWindow()?.webContents,
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
// Match both, and normalize to the no-space `OneKeyWallet/<APP_VERSION>` so the
// Chromium's default UA carries the real app version. OneKey API requests
// use buildCustomUA()'s `OneKey <platform> <version>` via the request hook.
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
  // process.env.VERSION is substituted by the main-process esbuild config in
  // apps/desktop/scripts/build.js — the same path every other call site
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

const cpuWatchdog = new CpuWatchdogController();
let cpuWatchdogInterval: ReturnType<typeof setInterval> | null = null;

function collectGuestWebviewPids(): Set<number> {
  const ignoredPids = new Set<number>();
  try {
    for (const contents of electronWebContents.getAllWebContents()) {
      if (!contents.isDestroyed() && contents.getType() === 'webview') {
        const pid = contents.getOSProcessId();
        if (typeof pid === 'number' && pid > 0) {
          ignoredPids.add(pid);
        }
      }
    }
  } catch {
    // Best-effort guest webview PID enumeration
  }
  return ignoredPids;
}

function startCpuWatchdog() {
  if (cpuWatchdogInterval) {
    clearInterval(cpuWatchdogInterval);
  }
  cpuWatchdog.start();
  cpuWatchdogInterval = setInterval(() => {
    try {
      const metrics = app.getAppMetrics().map((m) => ({
        pid: m.pid,
        type: m.type,
        name: m.name,
        percentCPUUsage: m.cpu.percentCPUUsage,
        cumulativeCPUUsage: (m.cpu as { cumulativeCPUUsage?: number })
          .cumulativeCPUUsage,
      }));
      const sample = cpuWatchdog.sampleMetrics({
        metrics,
        ignoredTabPids: collectGuestWebviewPids(),
      });
      if (sample.shouldLogTick) {
        logger.info(
          `[CPU Watchdog] tick cores=${
            os.cpus().length
          } wallΔ=${sample.wallDeltaSec.toFixed(1)}s processes=${JSON.stringify(
            sample.sortedForLog,
          )}`,
        );
      }
      for (const event of sample.eventsToFire) {
        logger.warn('[CPU Watchdog] fired (UI suppressed)', event);
        reportWatchdogToSentry(event);
      }
    } catch (error) {
      logger.warn('[CPU Watchdog] sample failed', error);
    }
  }, CPU_WATCHDOG_SAMPLE_INTERVAL_MS);
  logger.info('[CPU Watchdog] started', {
    sampleIntervalMs: CPU_WATCHDOG_SAMPLE_INTERVAL_MS,
    startupGraceMs: CPU_WATCHDOG_STARTUP_GRACE_MS,
    severe: {
      thresholdPercent: CPU_WATCHDOG_SEVERE_THRESHOLD_PERCENT,
      sustainedSamples: CPU_WATCHDOG_SEVERE_SUSTAINED_SAMPLES,
    },
    mild: {
      thresholdPercent: CPU_WATCHDOG_MILD_THRESHOLD_PERCENT,
      sustainedSamples: CPU_WATCHDOG_MILD_SUSTAINED_SAMPLES,
    },
    recovery: {
      thresholdPercent: CPU_WATCHDOG_RECOVERY_THRESHOLD_PERCENT,
      sustainedSamples: CPU_WATCHDOG_RECOVERY_SUSTAINED_SAMPLES,
    },
    cooldownMs: CPU_WATCHDOG_COOLDOWN_MS,
  });
}

function reportWatchdogToSentry(params: {
  reason: ICpuWatchdogReason;
  pid?: number;
  cpuTrend?: number[];
  episodeEscalated?: boolean;
}) {
  try {
    const { captureMessage, setContext } = require('@sentry/electron/main') as {
      captureMessage: (msg: string, level?: string) => void;
      setContext: (name: string, data: Record<string, unknown> | null) => void;
    };
    const safelyMainWindow = getSafelyMainWindow();
    setContext('cpuWatchdog', {
      reason: params.reason,
      pid: params.pid,
      cpuTrend: params.cpuTrend,
      episodeEscalated: params.episodeEscalated ?? false,
      windowVisible: safelyMainWindow?.isVisible() ?? false,
      windowMinimized: safelyMainWindow?.isMinimized() ?? false,
      uptimeMs: Math.round(process.uptime() * 1000),
    });
    captureMessage(`desktop:cpu-watchdog:${params.reason}`, 'warning');
  } catch {
    // Sentry not initialized — ignore.
  }
}

function markCpuWatchdogResponsive(pid?: number) {
  cpuWatchdog.markResponsive(pid);
}

function triggerCpuWatchdog(params: {
  reason: ICpuWatchdogReason;
  pid?: number;
  cpuTrend?: number[];
  bypassCooldown?: boolean;
}) {
  const decision = cpuWatchdog.evaluateTrigger(params);
  if (!decision) {
    logger.warn(
      '[CPU Watchdog] trigger ignored — episode active or cooldown active',
      {
        reason: params.reason,
        pid: params.pid,
        cooldownMs: CPU_WATCHDOG_COOLDOWN_MS,
      },
    );
    return;
  }

  // UI suppressed: only collect local logs + Sentry telemetry while we
  // investigate the underlying CPU regression. Re-enable surface (status
  // indicator / non-blocking card) once root cause is identified.
  logger.warn('[CPU Watchdog] fired (UI suppressed)', decision);
  reportWatchdogToSentry(decision);
}

function resetCpuWatchdogStateForTesting() {
  const previousLastFiredAt = cpuWatchdog.reset();
  logger.warn('[CPU Watchdog] cooldown reset via IPC', {
    previousLastFiredAt,
  });
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
registerDesktopProtocolClients({
  defaultApp: process.defaultApp,
  argv: process.argv,
  execPath: process.execPath,
});

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
