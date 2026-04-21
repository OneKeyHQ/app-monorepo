import type { Contexts } from '@sentry/core';
import type { Systeminformation } from 'systeminformation';

export const cspRules = [
  "default-src 'self'",
  "script-src 'self'",
  // inline styles required by React/Tamagui runtime
  "style-src 'self' 'unsafe-inline'",
  // Wallet connects to arbitrary blockchain RPCs, so connect-src must remain open.
  // Webviews (DApp browser) use a separate session with their own CSP.
  'connect-src *',
  "img-src 'self' data: https://onekey.243096.com https://devs.243096.com https://onekey.so https://*.onekey.so https://onekey-asset.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
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
  LOG_DIRECTORY: 'LOG_DIRECTORY',
  GET_PLATFORM_INFO: 'GET_PLATFORM_INFO',

  // Updater
  UPDATE_AVAILABLE: 'update/available',
  UPDATE_DOWNLOAD_FILE_INFO: 'update/download-file-info',
  UPDATE_NOT_AVAILABLE: 'update/not-available',
  UPDATE_ERROR: 'update/error',
  UPDATE_DOWNLOADING: 'update/downloading',
  UPDATE_DOWNLOADED: 'update/downloaded',
  CHECK_FOR_UPDATES: 'update/checkForUpdates',
  TOUCH_UPDATE_RES_SUCCESS: 'touch/update-res-success',
  TOUCH_UPDATE_PROGRESS: 'touch/update-progress',
  CLIENT_LOG_UPLOAD_PROGRESS: 'client-log/upload-progress',
  // OneKey Touch
  TOUCH_RES: 'touch/res',
  TOUCH_OPEN_PRIVACY_PANEL: 'touch/openPrivacyPanel',

  // App
  SHOW_ABOUT_WINDOW: 'showAboutWindow',
  APP_STATE: 'appState',
  APP_READY: 'app/ready',
  APP_SHORTCUT: 'app/shortcut',
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

  // System Resources
  SYSTEM_GET_CPU_USAGE: 'system/getCpuUsage',
  SYSTEM_GET_MEMORY_USAGE: 'system/getMemoryUsage',

  // Boot Recovery
  MARK_BOOT_SUCCESS: 'recovery/markBootSuccess',
  SET_CONSECUTIVE_BOOT_FAIL_COUNT: 'recovery/setConsecutiveBootFailCount',
  RECOVERY_EXPORT_LOGS: 'recovery/exportLogs',
  RECOVERY_TRY_AGAIN: 'recovery/tryAgain',
  RECOVERY_AUTO_REPAIR: 'recovery/autoRepair',

  // Tray
  TRAY_DATA_REQUEST: 'tray/dataRequest',
  TRAY_DATA_RESPONSE: 'tray/dataResponse',
  TRAY_UPDATE: 'tray/update',
  TRAY_ACTION: 'tray/action',
  TRAY_TOGGLE: 'tray/toggle',
};
