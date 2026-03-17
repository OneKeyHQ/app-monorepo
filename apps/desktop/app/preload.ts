/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/require-await */
import path from 'path';

import { EOneKeyBleMessageKeys } from '@onekeyfe/hd-shared';
import { ipcRenderer, nativeImage } from 'electron';

import type { DesktopApiProxy } from '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy';
import desktopApiProxy from '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy';
import type { IDesktopAppState } from '@onekeyhq/shared/types/desktop';

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

type IDesktopAPILegacy = {
  on: (
    channel: string,
    func: (...args: any[]) => any,
  ) => IDesktopEventUnSubscribe | undefined;
  arch: string;
  platform: string;
  systemVersion: string;
  logDirectory: string;
  deskChannel: string;
  isMas: boolean;
  isDev: boolean;
  channel?: string;
  ready: () => void;
  onAppState: (cb: (state: IDesktopAppState) => void) => () => void;
  isFocused: () => boolean;

  addIpcEventListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => void;
  removeIpcEventListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => void;
  touchUpdateResource: (params: {
    resourceUrl: string;
    dialogTitle: string;
    buttonLabel: string;
  }) => void;
  openPrivacyPanel: () => void;
  // startServer: (port: number) => Promise<{ success: boolean; error?: string }>;
  startServer: (
    port: number,
    cb: (data: string, success: boolean) => void,
  ) => void;
  serverListener: (
    cb: (request: {
      requestId: string;
      postData: any;
      type: string;
      url: string;
    }) => void,
  ) => void;
  serverRespond: (
    requestId: string,
    code: number,
    type: string,
    body: string,
  ) => void;
  stopServer: () => void;
  setSystemIdleTime: (idleTime: number, cb?: () => void) => void;
  testCrash: () => void;
  nobleBle: NobleBleAPI;
  getCpuUsage: () => Promise<{ usage: number }>;
  getMemoryUsage: () => Promise<{
    private: number;
    residentSet: number | undefined;
    blink: {
      allocated: string;
      total: string;
    };
  }>;
  appVersion: string;
  // Boot Recovery
  markBootSuccess: () => void;
  setConsecutiveBootFailCount: (count: number) => void;
  recoveryExportLogs: () => Promise<{ error?: string }>;
  recoveryTryAgain: () => Promise<void>;
  recoveryAutoRepair: () => Promise<{ error?: string }>;
};
declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    desktopApi: IDesktopAPILegacy;
    desktopApiProxy: DesktopApiProxy;
    INJECT_PATH: string;
  }

  // eslint-disable-next-line vars-on-top, no-var
  var desktopApi: IDesktopAPILegacy;
  // eslint-disable-next-line vars-on-top, no-var
  var desktopApiProxy: DesktopApiProxy;
}

ipcRenderer.on(
  ipcMessageKeys.SET_ONEKEY_DESKTOP_GLOBALS,
  (
    _,
    globals: {
      sdkConnectSrc: string;
    },
  ) => {
    globalThis.ONEKEY_DESKTOP_GLOBALS = globals;
  },
);

globalThis.ONEKEY_DESKTOP_DEEP_LINKS =
  globalThis.ONEKEY_DESKTOP_DEEP_LINKS || [];
ipcRenderer.on(ipcMessageKeys.OPEN_DEEP_LINK_URL, (event, data) => {
  if (globalThis.ONEKEY_DESKTOP_DEEP_LINKS) {
    globalThis.ONEKEY_DESKTOP_DEEP_LINKS.push(data);
  }
  globalThis.ONEKEY_DESKTOP_DEEP_LINKS =
    globalThis.ONEKEY_DESKTOP_DEEP_LINKS.slice(-5);
});

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

const getChannel = () => {
  let channel;
  try {
    if (process.platform === 'linux') {
      if (process.env.APPIMAGE) {
        channel = 'appImage';
      } else if (process.env.SNAP) {
        channel = 'snap';
      } else if (process.env.FLATPAK) {
        channel = 'flatpak';
      }
    }
  } catch (e) {
    // ignore
  }
  return channel;
};

const isDev = ipcRenderer.sendSync(ipcMessageKeys.IS_DEV);
// packages/components/tamagui.config.ts
// lightColors.bgApp
const lightColor = '#ffffff';
// packages/components/tamagui.config.ts
// darkColors.bgApp
const darkColor = '#0f0f0f';

const isMac = process.platform === 'darwin';

const desktopApi: IDesktopAPILegacy = Object.freeze({
  on: (channel: string, func: (...args: any[]) => any) => {
    if (validChannels.has(channel)) {
      const callback = (_: any, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, callback);
      return () => {
        ipcRenderer.removeListener(channel, callback);
      };
    }
  },
  arch: process.arch,
  platform: process.platform,
  logDirectory: ipcRenderer.sendSync(ipcMessageKeys.LOG_DIRECTORY),
  deskChannel: process.env.DESK_CHANNEL || '',
  systemVersion: process.getSystemVersion(),
  isMas: process.mas,
  isDev,
  channel: getChannel(),
  ready: () => ipcRenderer.send(ipcMessageKeys.APP_READY),
  addIpcEventListener: (event: string, listener: (...args: any[]) => void) => {
    ipcRenderer.addListener(event, listener);
  },
  removeIpcEventListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => {
    ipcRenderer.removeListener(event, listener);
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
  },
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
});

globalThis.desktopApi = desktopApi;
// contextBridge.exposeInMainWorld('desktopApi', desktopApi);
globalThis.desktopApiProxy = desktopApiProxy;

// Expose synchronous MMKV IPC bridge for renderer-side syncStorage.
// The main process registers the handler in react-native-mmkv-desktop-main.ts.
(globalThis as any).$mmkvSync = (args: {
  method: string;
  id: string;
  key?: string;
  value?: unknown;
}) => ipcRenderer.sendSync('mmkv:sync', args);
