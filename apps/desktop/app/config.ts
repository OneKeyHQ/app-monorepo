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
  sentryContexts: Contexts;
};

export const ipcMessageKeys = {
  IS_DEV: 'IS_DEV',
  // DEV Only
  APP_DEV_ONLY_API: 'electronAppMainProcessDevOnly/api',

  // Updater
  SHOW_ABOUT_WINDOW: 'showAboutWindow',
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
  CHECK_FOR_UPDATES: 'update/checkForUpdates',
  TOUCH_UPDATE_RES_SUCCESS: 'touch/update-res-success',
  TOUCH_UPDATE_PROGRESS: 'touch/update-progress',
  UPDATE_DOWNLOAD_ASC: 'update/download-asc',
  UPDATE_VERIFY_ASC: 'update/verify-asc',
  UPDATE_DOWNLOAD_ASC_DONE: 'update/download-asc-done',
  UPDATE_VERIFY_ASC_DONE: 'update/verify-asc-done',
  UPDATE_MANUAL_INSTALLATION: 'update/manual-installation',
  UPDATE_GET_PREVIOUS_UPDATE_BUILD_NUMBER:
    'update/getPreviousUpdateBuildNumber',

  // App
  APP_VERSION: 'app/version',
  APP_SYSTEM_INFO: 'app/systemInfo',
  APP_STATE: 'appState',
  APP_READY: 'app/ready',
  APP_RELOAD: 'app/reload',
  APP_FOCUS: 'app/focus',
  APP_QUIT: 'app/quit',
  APP_RESTORE_MAIN_WINDOW: 'app/restoreMainWindow',
  APP_GET_MEDIA_ACCESS_STATUS: 'app/getMediaAccessStatus',
  APP_OPEN_PREFERENCES: 'app/openPreferences',
  APP_TOGGLE_MAXIMIZE_WINDOW: 'app/toggleMaximizeWindow',
  APP_RELOAD_BRIDGE_PROCESS: 'app/reloadBridgeProcess',
  APP_SHORCUT: 'app/shortcut',
  APP_IDLE: 'app/idle',
  APP_SET_IDLE_TIME: 'app/setIdleTime',
  APP_CHANGE_DEV_TOOLS_STATUS: 'app/changeDevTools',
  APP_OPEN_SETTINGS: 'app/openSettings',
  APP_CHANGE_LANGUAGE: 'app/changeLanguage',
  APP_LOCK_NOW: 'app/lockNow',
  APP_GET_ENV_PATH: 'app/getEnvPath',
  APP_GET_BUNDLE_INFO: 'app/getBundleInfo',
  APP_OPEN_LOGGER_FILE: 'app/openLoggerFile',
  APP_TEST_CRASH: 'app/testCrash',
  APP_UPDATE_DISABLE_SHORTCUTS: 'app/updateDisableShortcuts',
  APP_IS_FOCUSED: 'app/isFocused',

  // Theme
  THEME_UPDATE: 'theme/update',

  // Touch
  TOUCH_ID_CAN_PROMPT: 'touchId/canPrompt',
  TOUCH_ID_PROMPT_RES: 'touchId/prompt-res',
  TOUCH_ID_PROMPT: 'touchId/prompt',
  CHECK_BIOMETRIC_AUTH_CHANGED: 'touchId/checkBiometricAuthChanged',
  TOUCH_RES: 'touch/res',
  TOUCH_OPEN_PRIVACY_PANEL: 'touch/openPrivacyPanel',

  // Secure storage
  SECURE_SET_ITEM_ASYNC: 'secure/setItemAsync',
  SECURE_GET_ITEM_ASYNC: 'secure/getItemAsync',
  SECURE_DEL_ITEM_ASYNC: 'secure/delItemAsync',

  // store
  STORE_SET_ITEM_ASYNC: 'store/setItemAsync',
  STORE_GET_ITEM_ASYNC: 'store/getItemAsync',
  STORE_DEL_ITEM_ASYNC: 'store/delItemAsync',
  STORE_CLEAR: 'store/clear',

  // Server
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
  SET_ALLOWED_PHISHING_URLS: 'webview/setAllowedPhishingUrls',
  CLEAR_WEBVIEW_CACHE: 'webview/clearCache',

  NOTIFICATION_SHOW: 'notification/show',
  NOTIFICATION_GET_PERMISSION: 'notification/getPermission',
  NOTIFICATION_SET_BADGE: 'notification/setBadge',
  NOTIFICATION_SET_BADGE_WINDOWS: 'notification/setBadge/windows',
};
