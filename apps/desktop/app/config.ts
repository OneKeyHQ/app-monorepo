/* eslint-disable spellcheck/spell-checker */
import type { Contexts } from '@sentry/core';
import type { Systeminformation } from 'systeminformation';

export const cspRules = [
  // Default to only own resources
  "default-src 'self' 'unsafe-inline' onekey.243096.com dev.243096.com onekey-asset.com",
  // Allow all API calls (Can't be restricted bc of custom backends)
  'connect-src *',
  // Allow images from trezor.io
  "img-src 'self' onekey.243096.com devs.243096.com onekey.so *.onekey.so onekey-asset.com",
];

export type IDesktopSystemInfo = {
  system: Systeminformation.SystemData;
  cpu: Systeminformation.CpuData;
  os: Systeminformation.OsData;
  sentryContexts: Contexts | undefined;
};

export type IDesktopIAPGetProductsParams = {
  productIDs: string[];
};
export type IDesktopIAPGetProductsResult = {
  bundleId: string;
  canMakePayments: boolean;
  productIDs: string[];
  products: Electron.Product[];
};

export const ipcMessageKeys = {
  IS_DEV: 'IS_DEV',

  // Updater
  UPDATE_CHECK: 'update/check',
  UPDATE_SETTINGS: 'update/settings',
  UPDATE_CLEAR_SETTINGS: 'update/clearSettings',
  UPDATE_DOWNLOAD: 'update/download',
  UPDATE_VERIFY: 'update/verify',
  UPDATE_VERIFIED: 'update/verified',
  UPDATE_INSTALL: 'update/install',
  UPDATE_CLEAR: 'update/clear',
  UPDATE_CHECKING: 'update/checking',
  UPDATE_AVAILABLE: 'update/available',
  UPDATE_DOWNLOAD_FILE_INFO: 'update/download-file-info',
  UPDATE_NOT_AVAILABLE: 'update/not-available',
  UPDATE_ERROR: 'update/error',
  UPDATE_DOWNLOADING: 'update/downloading',
  UPDATE_DOWNLOADED: 'update/downloaded',
  UPDATE_DOWNLOAD_ASC: 'update/download-asc',
  UPDATE_VERIFY_ASC: 'update/verify-asc',
  UPDATE_DOWNLOAD_ASC_DONE: 'update/download-asc-done',
  UPDATE_VERIFY_ASC_DONE: 'update/verify-asc-done',
  UPDATE_MANUAL_INSTALLATION: 'update/manual-installation',
  UPDATE_GET_PREVIOUS_UPDATE_BUILD_NUMBER:
    'update/getPreviousUpdateBuildNumber',
  CHECK_FOR_UPDATES: 'update/checkForUpdates',
  TOUCH_UPDATE_RES_SUCCESS: 'touch/update-res-success',
  TOUCH_UPDATE_PROGRESS: 'touch/update-progress',
  // OneKey Touch
  TOUCH_RES: 'touch/res',
  TOUCH_OPEN_PRIVACY_PANEL: 'touch/openPrivacyPanel',

  // App
  SHOW_ABOUT_WINDOW: 'showAboutWindow',
  APP_STATE: 'appState',
  APP_READY: 'app/ready',
  APP_SHORCUT: 'app/shortcut',
  APP_IDLE: 'app/idle',
  APP_SET_IDLE_TIME: 'app/setIdleTime',
  APP_OPEN_SETTINGS: 'app/openSettings',
  APP_LOCK_NOW: 'app/lockNow',
  APP_TEST_CRASH: 'app/testCrash',
  APP_IS_FOCUSED: 'app/isFocused',

  // Theme
  THEME_UPDATE: 'theme/update',

  // build-in http server
  SERVER_START: 'server/start',
  SERVER_STOP: 'server/stop',
  SERVER_START_RES: 'server/start/res',
  SERVER_LISTENER: 'server/listener',
  SERVER_RESPOND: 'server/respond',

  // Event
  EVENT_OPEN_URL: 'event-open-url',

  // DeepLink
  OPEN_DEEP_LINK_URL: 'deepLink/openUrl',

  SET_ONEKEY_DESKTOP_GLOBALS: 'onekey/setDesktopGlobals',

  // webview
  WEBVIEW_NEW_WINDOW: 'webview/newWindow',

  // notification
  NOTIFICATION_SET_BADGE_WINDOWS: 'notification/setBadge/windows',

  // Bluetooth
  BLUETOOTH_CHECK_AVAILABILITY: 'bluetooth/checkAvailability',
};
