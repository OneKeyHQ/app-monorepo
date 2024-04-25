/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/require-await */
import { ipcRenderer } from 'electron';

import type {
  IDesktopAppState,
  IPrefType,
} from '@onekeyhq/shared/types/desktop';

import { ipcMessageKeys } from './config';

import type { IUpdateSettings } from './libs/store';

export type IDesktopAPI = {
  on: (channel: string, func: (...args: any[]) => any) => void;
  hello: string;
  arch: string;
  platform: string;
  isMas: boolean;
  channel?: string;
  reload: () => void;
  ready: () => void;
  focus: () => void;
  openPreferences: (prefType: IPrefType) => void;
  toggleMaximizeWindow: () => void;
  onAppState: (cb: (state: IDesktopAppState) => void) => () => void;
  canPromptTouchID: () => boolean;
  promptTouchID: (msg: string) => Promise<{ success: boolean; error?: string }>;
  secureSetItemAsync: (key: string, value: string) => Promise<void>;
  secureGetItemAsync: (key: string) => Promise<string | null>;
  secureDelItemAsync: (key: string) => Promise<void>;
  reloadBridgeProcess: () => void;
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
  installUpdate: () => void;
  setAutoUpdateSettings: (settings: IUpdateSettings) => void;
  touchUpdateResource: (params: {
    resourceUrl: string;
    dialogTitle: string;
    buttonLabel: string;
  }) => void;
  openPrivacyPanel: () => void;
  clearAutoUpdateSettings: () => void;
  restore: () => void;
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
  quitApp: () => void;
  clearWebViewData: () => void;
  setSystemIdleTime: (idleTime: number, cb?: () => void) => void;
  setAllowedPhishingUrls: (urls: string[]) => void;
};
declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    desktopApi: IDesktopAPI;
    INJECT_PATH: string;
  }
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
    window.ONEKEY_DESKTOP_GLOBALS = globals;
    // contextBridge.exposeInMainWorld('ONEKEY_DESKTOP_GLOBALS', globals);
  },
);

window.ONEKEY_DESKTOP_DEEP_LINKS = window.ONEKEY_DESKTOP_DEEP_LINKS || [];
ipcRenderer.on(ipcMessageKeys.OPEN_DEEP_LINK_URL, (event, data) => {
  if (window.ONEKEY_DESKTOP_DEEP_LINKS) {
    window.ONEKEY_DESKTOP_DEEP_LINKS.push(data);
  }
  window.ONEKEY_DESKTOP_DEEP_LINKS = window.ONEKEY_DESKTOP_DEEP_LINKS.slice(-5);
});

const validChannels = [
  // Update events
  ipcMessageKeys.UPDATE_CHECKING,
  ipcMessageKeys.UPDATE_AVAILABLE,
  ipcMessageKeys.UPDATE_NOT_AVAILABLE,
  ipcMessageKeys.UPDATE_ERROR,
  ipcMessageKeys.UPDATE_DOWNLOADING,
  ipcMessageKeys.UPDATE_DOWNLOADED,
  ipcMessageKeys.TOUCH_UPDATE_RES_SUCCESS,
  ipcMessageKeys.TOUCH_UPDATE_PROGRESS,
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

const desktopApi = {
  getVersion: () => ipcRenderer.sendSync(ipcMessageKeys.APP_VERSION) as string,
  on: (channel: string, func: (...args: any[]) => any) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => func(...args));
    }
  },
  hello: 'world',
  arch: process.arch,
  platform: process.platform,
  isMas: process.mas,
  channel: getChannel(),
  ready: () => ipcRenderer.send(ipcMessageKeys.APP_READY),
  reload: () => ipcRenderer.send(ipcMessageKeys.APP_RELOAD),
  focus: () => ipcRenderer.send(ipcMessageKeys.APP_FOCUS),
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
  openPreferences: () => ipcRenderer.send(ipcMessageKeys.APP_OPEN_PREFERENCES),
  toggleMaximizeWindow: () =>
    ipcRenderer.send(ipcMessageKeys.APP_TOGGLE_MAXIMIZE_WINDOW),
  canPromptTouchID: () =>
    ipcRenderer.sendSync(ipcMessageKeys.TOUCH_ID_CAN_PROMPT) as boolean,
  promptTouchID: async (
    msg: string,
  ): Promise<{ success: boolean; error?: string }> =>
    new Promise((resolve) => {
      ipcRenderer.once(ipcMessageKeys.TOUCH_ID_PROMPT_RES, (_, arg) => {
        resolve(arg);
      });
      ipcRenderer.send(ipcMessageKeys.TOUCH_ID_PROMPT, msg);
    }),
  secureSetItemAsync(key: string, value: string) {
    return ipcRenderer.sendSync(ipcMessageKeys.SECURE_SET_ITEM_ASYNC, {
      key,
      value,
    });
  },
  secureGetItemAsync(key: string) {
    return ipcRenderer.sendSync(ipcMessageKeys.SECURE_GET_ITEM_ASYNC, { key });
  },
  secureDelItemAsync(key: string) {
    return ipcRenderer.sendSync(ipcMessageKeys.SECURE_DEL_ITEM_ASYNC, { key });
  },
  reloadBridgeProcess: () => {
    ipcRenderer.send(ipcMessageKeys.APP_RELOAD_BRIDGE_PROCESS);
  },

  // Updater
  checkForUpdates: (isManual?: boolean) =>
    ipcRenderer.send(ipcMessageKeys.UPDATE_CHECK, isManual),
  downloadUpdate: () => ipcRenderer.send(ipcMessageKeys.UPDATE_DOWNLOAD),
  installUpdate: () => ipcRenderer.send(ipcMessageKeys.UPDATE_INSTALL),
  setAutoUpdateSettings: (settings: IUpdateSettings) =>
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

  restore: () => {
    ipcRenderer.send(ipcMessageKeys.APP_RESTORE_MAIN_WINDOW);
  },

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
  quitApp: () => {
    ipcRenderer.send(ipcMessageKeys.APP_QUIT);
  },
  clearWebViewData: () => {
    ipcRenderer.send(ipcMessageKeys.APP_CLEAR_WEBVIEW_DATA);
  },
  setSystemIdleTime: (idleTime: number, cb?: () => void) => {
    ipcRenderer.on(ipcMessageKeys.APP_IDLE, () => {
      cb?.();
    });
    ipcRenderer.send(ipcMessageKeys.APP_SET_IDLE_TIME, idleTime);
  },
  setAllowedPhishingUrls: (urls: string[]) => {
    ipcRenderer.send(ipcMessageKeys.SET_ALLOWED_PHISHING_URLS, urls);
  },
};

window.desktopApi = desktopApi;
// contextBridge.exposeInMainWorld('desktopApi', desktopApi);
