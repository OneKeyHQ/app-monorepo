/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/require-await */
import path from 'path';

import { EOneKeyBleMessageKeys } from '@onekeyfe/hd-shared';
import { Titlebar, TitlebarColor } from 'custom-electron-titlebar';
import { ipcRenderer, nativeImage } from 'electron';

import type { DesktopApiProxy } from '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy';
import desktopApiProxy from '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy';
import type {
  IDesktopAppState,
  IDesktopStoreUpdateSettings,
} from '@onekeyhq/shared/types/desktop';

import { ipcMessageKeys } from './config';

import type { NobleBleAPI } from '@onekeyfe/hd-transport-electron';

export interface IVerifyUpdateParams {
  downloadedFile?: string;
  downloadUrl?: string;
}

export interface IInstallUpdateParams extends IVerifyUpdateParams {
  buildNumber: string;
}

type IDesktopAPILegacy = {
  on: (channel: string, func: (...args: any[]) => any) => void;
  arch: string;
  platform: string;
  systemVersion: string;
  isMas: boolean;
  isDev: boolean;
  channel?: string;
  ready: () => void;
  onAppState: (cb: (state: IDesktopAppState) => void) => () => void;
  isFocused: () => boolean;
  changeTheme: (theme: string) => void;

  addIpcEventListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => void;
  removeIpcEventListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => void;

  // Updater
  checkForUpdates: (isManual?: boolean) => void;
  downloadUpdate: () => void;
  downloadASC: (event: IVerifyUpdateParams) => void;
  verifyASC: (event: IVerifyUpdateParams) => void;
  verifyUpdate: (event: IVerifyUpdateParams) => void;
  installUpdate: (event: IInstallUpdateParams) => void;
  manualInstallPackage: (event: IInstallUpdateParams) => void;
  getPreviousUpdateBuildNumber: () => string;
  clearUpdate: () => void;
  setAutoUpdateSettings: (settings: IDesktopStoreUpdateSettings) => void;
  touchUpdateResource: (params: {
    resourceUrl: string;
    dialogTitle: string;
    buttonLabel: string;
  }) => void;
  openPrivacyPanel: () => void;
  clearAutoUpdateSettings: () => void;
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
      preloadJsUrl: string;
    },
  ) => {
    // for DesktopWebView:
    //    const { preloadJsUrl } = window.ONEKEY_DESKTOP_GLOBALS;
    globalThis.ONEKEY_DESKTOP_GLOBALS = globals;
    // contextBridge.exposeInMainWorld('ONEKEY_DESKTOP_GLOBALS', globals);
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

const validChannels = [
  // Update events
  ipcMessageKeys.UPDATE_CHECKING,
  ipcMessageKeys.UPDATE_AVAILABLE,
  ipcMessageKeys.UPDATE_DOWNLOAD_FILE_INFO,
  ipcMessageKeys.UPDATE_NOT_AVAILABLE,
  ipcMessageKeys.UPDATE_VERIFIED,
  ipcMessageKeys.UPDATE_ERROR,
  ipcMessageKeys.UPDATE_DOWNLOADING,
  ipcMessageKeys.UPDATE_DOWNLOADED,
  ipcMessageKeys.UPDATE_DOWNLOAD_ASC,
  ipcMessageKeys.UPDATE_DOWNLOAD_ASC_DONE,
  ipcMessageKeys.UPDATE_VERIFY_ASC_DONE,
  ipcMessageKeys.UPDATE_VERIFY_ASC,
  ipcMessageKeys.UPDATE_MANUAL_INSTALLATION,
  ipcMessageKeys.CHECK_FOR_UPDATES,
  ipcMessageKeys.APP_OPEN_SETTINGS,
  ipcMessageKeys.APP_LOCK_NOW,
  ipcMessageKeys.TOUCH_UPDATE_RES_SUCCESS,
  ipcMessageKeys.TOUCH_UPDATE_PROGRESS,
  ipcMessageKeys.SHOW_ABOUT_WINDOW,
  ipcMessageKeys.UPDATE_GET_PREVIOUS_UPDATE_BUILD_NUMBER,
];

const getChannel = () => {
  let channel;
  try {
    if (process.platform === 'linux' && process.env.APPIMAGE) {
      channel = 'appImage';
    } else if (process.platform === 'linux' && process.env.SNAP) {
      channel = 'snap';
    }
  } catch (e) {
    // ignore
  }
  return channel;
};

let globalTitleBar: Titlebar | null = null;

const isDev = ipcRenderer.sendSync(ipcMessageKeys.IS_DEV);
// packages/components/tamagui.config.ts
// lightColors.bgApp
const lightColor = '#ffffff';
// packages/components/tamagui.config.ts
// darkColors.bgApp
const darkColor = '#0f0f0f';

const isMac = process.platform === 'darwin';

const updateGlobalTitleBarBackgroundColor = () => {
  if (globalTitleBar) {
    setTimeout(() => {
      let color = lightColor;
      const theme = localStorage.getItem('ONEKEY_THEME_PRELOAD');
      if (theme === 'dark') {
        color = darkColor;
      } else if (theme === 'light') {
        color = lightColor;
      } else if (globalThis.matchMedia) {
        color = globalThis.matchMedia('(prefers-color-scheme: dark)').matches
          ? darkColor
          : lightColor;
      } else {
        color = lightColor;
      }
      globalTitleBar?.updateBackground(TitlebarColor.fromHex(color));
    }, 0);
  }
};

const desktopApi: IDesktopAPILegacy = Object.freeze({
  on: (channel: string, func: (...args: any[]) => any) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => func(...args));
    }
  },
  arch: process.arch,
  platform: process.platform,
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
  changeTheme: (theme: string) => {
    ipcRenderer.send(ipcMessageKeys.THEME_UPDATE, theme);
    updateGlobalTitleBarBackgroundColor();
  },
  isFocused: () => ipcRenderer.sendSync(ipcMessageKeys.APP_IS_FOCUSED),
  testCrash: () => ipcRenderer.send(ipcMessageKeys.APP_TEST_CRASH),

  // Updater
  checkForUpdates: (isManual?: boolean) =>
    ipcRenderer.send(ipcMessageKeys.UPDATE_CHECK, isManual),
  downloadUpdate: () => ipcRenderer.send(ipcMessageKeys.UPDATE_DOWNLOAD),
  downloadASC: (params: IVerifyUpdateParams) =>
    ipcRenderer.send(ipcMessageKeys.UPDATE_DOWNLOAD_ASC, params),
  verifyUpdate: (params: IVerifyUpdateParams) =>
    ipcRenderer.send(ipcMessageKeys.UPDATE_VERIFY, params),
  verifyASC: (params: IVerifyUpdateParams) =>
    ipcRenderer.send(ipcMessageKeys.UPDATE_VERIFY_ASC, params),
  installUpdate: (params: IInstallUpdateParams) =>
    ipcRenderer.send(ipcMessageKeys.UPDATE_INSTALL, params),
  manualInstallPackage: (params: IInstallUpdateParams) =>
    ipcRenderer.send(ipcMessageKeys.UPDATE_MANUAL_INSTALLATION, params),
  getPreviousUpdateBuildNumber: () =>
    ipcRenderer.sendSync(
      ipcMessageKeys.UPDATE_GET_PREVIOUS_UPDATE_BUILD_NUMBER,
    ),
  clearUpdate: () => ipcRenderer.send(ipcMessageKeys.UPDATE_CLEAR),
  setAutoUpdateSettings: (settings: IDesktopStoreUpdateSettings) =>
    ipcRenderer.send(ipcMessageKeys.UPDATE_SETTINGS, settings),
  clearAutoUpdateSettings: () =>
    ipcRenderer.send(ipcMessageKeys.UPDATE_CLEAR_SETTINGS),

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
});

globalThis.desktopApi = desktopApi;
// contextBridge.exposeInMainWorld('desktopApi', desktopApi);
globalThis.desktopApiProxy = desktopApiProxy;

if (!isMac) {
  globalThis.addEventListener('DOMContentLoaded', () => {
    // eslint-disable-next-line no-new
    globalTitleBar = new Titlebar({
      icon: nativeImage.createFromPath(
        path.join(
          __dirname,
          isDev
            ? '../public/static/images/icons/round_icon.png'
            : '../build/static/images/icons/round_icon.png',
        ),
      ),
    });
    globalTitleBar.updateTitle('');
    updateGlobalTitleBarBackgroundColor();
  });
}
