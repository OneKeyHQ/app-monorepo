/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/require-await */
import { EOneKeyBleMessageKeys } from '@onekeyfe/hd-shared';
import { contextBridge, ipcRenderer } from 'electron';

import { OAUTH_CALLBACK_DESKTOP_CHANNEL } from '@onekeyhq/shared/src/consts/authConsts';

import { ipcMessageKeys } from './config';

import type { NobleBleAPI } from '@onekeyfe/hd-transport-electron';

export interface IVerifyUpdateParams {
  downloadedFile?: string;
  downloadUrl?: string;
  skipGPGVerification?: boolean;
}

export interface IInstallUpdateParams extends IVerifyUpdateParams {
  buildNumber: string;
}

export type IDesktopEventUnSubscribe = () => void;

// --- Internal state (preload world, not accessible from renderer) ---

let desktopGlobals: { sdkConnectSrc: string } | undefined;
const deepLinks: any[] = [];

ipcRenderer.on(
  ipcMessageKeys.SET_ONEKEY_DESKTOP_GLOBALS,
  (_, globals: { sdkConnectSrc: string }) => {
    desktopGlobals = globals;
  },
);

ipcRenderer.on(ipcMessageKeys.OPEN_DEEP_LINK_URL, (_event, data) => {
  deepLinks.push(data);
  // Keep only last 5
  if (deepLinks.length > 5) {
    deepLinks.splice(0, deepLinks.length - 5);
  }
});

// --- Channel whitelist for event subscriptions ---

const validChannels = new Set([
  ipcMessageKeys.UPDATE_DOWNLOAD_FILE_INFO,
  ipcMessageKeys.UPDATE_ERROR,
  ipcMessageKeys.UPDATE_DOWNLOADING,
  ipcMessageKeys.UPDATE_DOWNLOADED,
  ipcMessageKeys.CHECK_FOR_UPDATES,
  ipcMessageKeys.APP_OPEN_SETTINGS,
  ipcMessageKeys.APP_LOCK_NOW,
  ipcMessageKeys.TOUCH_UPDATE_RES_SUCCESS,
  ipcMessageKeys.TOUCH_UPDATE_PROGRESS,
  ipcMessageKeys.CLIENT_LOG_UPLOAD_PROGRESS,
  ipcMessageKeys.SHOW_ABOUT_WINDOW,
  'memory-pressure-warning',
  'memory-pressure-critical',
  'gpu-process-crashed',
]);

// --- Platform info (fetched once from main process, sandbox-compatible) ---

const platformInfo = ipcRenderer.sendSync(ipcMessageKeys.GET_PLATFORM_INFO) as {
  arch: string;
  platform: string;
  systemVersion: string;
  isMas: boolean;
  channel?: string;
  deskChannel: string;
};

const isDev = ipcRenderer.sendSync(ipcMessageKeys.IS_DEV);

// --- desktopApi: legacy API surface (plain object, contextBridge-compatible) ---

const desktopApi = {
  on: (channel: string, func: (...args: any[]) => any) => {
    if (validChannels.has(channel)) {
      const callback = (_: any, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, callback);
      return () => {
        ipcRenderer.removeListener(channel, callback);
      };
    }
  },
  arch: platformInfo.arch,
  platform: platformInfo.platform,
  logDirectory: ipcRenderer.sendSync(ipcMessageKeys.LOG_DIRECTORY),
  deskChannel: platformInfo.deskChannel,
  systemVersion: platformInfo.systemVersion,
  isMas: platformInfo.isMas,
  isDev,
  channel: platformInfo.channel,
  ready: () => ipcRenderer.send(ipcMessageKeys.APP_READY),
  addIpcEventListener: (event: string, listener: (...args: any[]) => void) => {
    // Channel whitelist for addIpcEventListener (mirrors validChannels for on())
    const validIpcEventChannels = new Set([
      ipcMessageKeys.EVENT_OPEN_URL,
      ipcMessageKeys.WEBVIEW_NEW_WINDOW,
      ipcMessageKeys.APP_STATE,
      ipcMessageKeys.APP_SHORTCUT,
      ipcMessageKeys.APP_IDLE,
      ipcMessageKeys.SERVER_START_RES,
      ipcMessageKeys.SERVER_LISTENER,
      OAUTH_CALLBACK_DESKTOP_CHANNEL,
    ]);
    if (!validIpcEventChannels.has(event)) {
      console.warn(`[preload] addIpcEventListener: blocked channel "${event}"`);
      return () => {};
    }
    // Strip IpcRendererEvent to avoid passing non-serializable objects
    // through contextBridge (consistent with desktopApi.on() pattern)
    const wrapped = (_ipcEvent: any, ...args: any[]) => listener(...args);
    ipcRenderer.addListener(event, wrapped);
    return () => {
      ipcRenderer.removeListener(event, wrapped);
    };
  },
  removeIpcEventListener: (
    event: string,
    _listener: (...args: any[]) => void,
  ) => {
    // Deprecated: With contextIsolation, proxy identity prevents matching.
    // Use the unsubscribe function returned by addIpcEventListener instead.
    void event;
  },
  onAppState: (cb: (state: 'active' | 'background') => void) => {
    const handler = (_: any, value: any) => cb(value);
    ipcRenderer.addListener(ipcMessageKeys.APP_STATE, handler);
    return () => {
      ipcRenderer.removeListener(ipcMessageKeys.APP_STATE, handler);
    };
  },
  isFocused: () => ipcRenderer.sendSync(ipcMessageKeys.APP_IS_FOCUSED),
  testCrash: () => ipcRenderer.send(ipcMessageKeys.APP_TEST_CRASH),
  touchUpdateResource: (params: {
    resourceUrl: string;
    dialogTitle: string;
    buttonLabel: string;
  }) => ipcRenderer.send(ipcMessageKeys.TOUCH_RES, params),
  openPrivacyPanel: () =>
    ipcRenderer.send(ipcMessageKeys.TOUCH_OPEN_PRIVACY_PANEL),
  startServer: (port: number, cb: (data: string, success: boolean) => void) => {
    ipcRenderer.on(ipcMessageKeys.SERVER_START_RES, (_, arg) => {
      const { data, success } = arg;
      cb(data, success);
    });
    ipcRenderer.send(ipcMessageKeys.SERVER_START, port);
  },
  stopServer: () => {
    ipcRenderer.send(ipcMessageKeys.SERVER_STOP);
    ipcRenderer.removeAllListeners(ipcMessageKeys.SERVER_START_RES);
    ipcRenderer.removeAllListeners(ipcMessageKeys.SERVER_LISTENER);
  },
  serverListener: (
    cb: (request: {
      requestId: string;
      postData: any;
      type: string;
      url: string;
    }) => void,
  ) => {
    ipcRenderer.on(ipcMessageKeys.SERVER_LISTENER, (_, arg) => {
      const { requestId, type, url, postData } = arg;
      cb({ requestId, postData, type, url });
    });
  },
  serverRespond: (
    requestId: string,
    code: number,
    type: string,
    body: string,
  ) => {
    ipcRenderer.send(ipcMessageKeys.SERVER_RESPOND, {
      requestId,
      code,
      type,
      body,
    });
  },
  setSystemIdleTime: (idleTime: number, cb?: () => void) => {
    ipcRenderer.on(ipcMessageKeys.APP_IDLE, () => {
      cb?.();
    });
    ipcRenderer.send(ipcMessageKeys.APP_SET_IDLE_TIME, idleTime);
  },
  // Desktop Bluetooth
  nobleBle: {
    enumerate: () =>
      ipcRenderer.invoke(EOneKeyBleMessageKeys.NOBLE_BLE_ENUMERATE),
    getDevice: (uuid: string) =>
      ipcRenderer.invoke(EOneKeyBleMessageKeys.NOBLE_BLE_GET_DEVICE, uuid),
    connect: (uuid: string) =>
      ipcRenderer.invoke(EOneKeyBleMessageKeys.NOBLE_BLE_CONNECT, uuid),
    disconnect: (uuid: string) =>
      ipcRenderer.invoke(EOneKeyBleMessageKeys.NOBLE_BLE_DISCONNECT, uuid),
    subscribe: (uuid: string) =>
      ipcRenderer.invoke(EOneKeyBleMessageKeys.NOBLE_BLE_SUBSCRIBE, uuid),
    unsubscribe: (uuid: string) =>
      ipcRenderer.invoke(EOneKeyBleMessageKeys.NOBLE_BLE_UNSUBSCRIBE, uuid),
    write: (uuid: string, data: string) =>
      ipcRenderer.invoke(EOneKeyBleMessageKeys.NOBLE_BLE_WRITE, uuid, data),
    cancelPairing: () =>
      ipcRenderer.invoke(EOneKeyBleMessageKeys.NOBLE_BLE_CANCEL_PAIRING),
    onNotification: (callback: (deviceId: string, data: string) => void) => {
      const subscription = (_: unknown, deviceId: string, data: string) => {
        callback(deviceId, data);
      };
      ipcRenderer.on(
        EOneKeyBleMessageKeys.NOBLE_BLE_NOTIFICATION,
        subscription,
      );
      return () => {
        ipcRenderer.removeListener(
          EOneKeyBleMessageKeys.NOBLE_BLE_NOTIFICATION,
          subscription,
        );
      };
    },
    onDeviceDisconnected: (
      callback: (device: { id: string; name: string }) => void,
    ) => {
      const subscription = (
        _: unknown,
        device: { id: string; name: string },
      ) => {
        callback(device);
      };
      ipcRenderer.on(
        EOneKeyBleMessageKeys.BLE_DEVICE_DISCONNECTED,
        subscription,
      );
      return () => {
        ipcRenderer.removeListener(
          EOneKeyBleMessageKeys.BLE_DEVICE_DISCONNECTED,
          subscription,
        );
      };
    },
    checkAvailability: () =>
      ipcRenderer.invoke(EOneKeyBleMessageKeys.BLE_AVAILABILITY_CHECK),
  } as NobleBleAPI,
  getCpuUsage: () => ipcRenderer.invoke(ipcMessageKeys.SYSTEM_GET_CPU_USAGE),
  getMemoryUsage: () =>
    ipcRenderer.invoke(ipcMessageKeys.SYSTEM_GET_MEMORY_USAGE),
  appVersion: process.env.VERSION || '',
  // Boot Recovery
  markBootSuccess: () => ipcRenderer.send(ipcMessageKeys.MARK_BOOT_SUCCESS),
  setConsecutiveBootFailCount: (count: number) =>
    ipcRenderer.send(ipcMessageKeys.SET_CONSECUTIVE_BOOT_FAIL_COUNT, count),
  recoveryExportLogs: () =>
    ipcRenderer.invoke(ipcMessageKeys.RECOVERY_EXPORT_LOGS),
  recoveryTryAgain: () => ipcRenderer.invoke(ipcMessageKeys.RECOVERY_TRY_AGAIN),
  recoveryAutoRepair: () =>
    ipcRenderer.invoke(ipcMessageKeys.RECOVERY_AUTO_REPAIR),
};

// --- desktopApiBridge: invoke-based bridge for desktopApiProxy (replaces JsBridge) ---

const desktopApiBridge = {
  call: (module: string, method: string, ...params: any[]) =>
    ipcRenderer.invoke('DESKTOP_API_CALL', { module, method, params }),
};

// --- Expose everything to renderer ---

const exposeToMainWorld = (key: string, value: unknown) => {
  try {
    contextBridge.exposeInMainWorld(key, value);
  } catch (err) {
    // contextBridge requires contextIsolation; log the error for diagnostics.
    // The globalThis fallback only works when contextIsolation is disabled.
    console.error(
      `[preload] Failed to expose '${key}' via contextBridge:`,
      err,
    );
    (globalThis as any)[key] = value;
  }
};

exposeToMainWorld('desktopApi', desktopApi);
exposeToMainWorld('desktopApiBridge', desktopApiBridge);

exposeToMainWorld(
  '$mmkvSync',
  (args: { method: string; id: string; key?: string; value?: unknown }) =>
    ipcRenderer.sendSync('mmkv:sync', args),
);

// Expose getters for globals managed by IPC events
exposeToMainWorld('ONEKEY_DESKTOP_GLOBALS_GETTER', () => desktopGlobals);
exposeToMainWorld('ONEKEY_DESKTOP_DEEP_LINKS_GETTER', () => [...deepLinks]);
// Drain the deep link queue after the renderer has consumed them
exposeToMainWorld('ONEKEY_DESKTOP_DEEP_LINKS_CLEAR', () => {
  deepLinks.length = 0;
});
