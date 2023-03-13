/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/require-await */
import { ipcRenderer } from 'electron';

import type { UpdateSettings } from './libs/store';

let keytar = {
  async setPassword(...args: any[]) {
    // noop
    console.error('keytar.setPassword() not working.');
  },
  async getPassword(...args: any[]) {
    console.error('keytar.getPassword() not working.');
    return Promise.resolve('');
  },
  async deletePassword(...args: any[]) {
    console.error('keytar.deletePassword() not working.');
    return Promise.resolve('');
  },
};

try {
  // eslint-disable-next-line global-require
  keytar = require('keytar');
} catch (error: any) {
  // Error: dlopen(//app-monorepo/node_modules/keytar/build/Release/keytar.node, 0x0001): tried: '//app-monorepo/node_modules/keytar/build/Release/keytar.node' (mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64e'))
  console.error(error);
}

export type PrefType =
  | 'camera'
  | 'bluetooth'
  | 'location'
  | 'notification'
  | 'locationService';
export type DesktopAPI = {
  on: (channel: string, func: (...args: any[]) => any) => void;
  hello: string;
  arch: string;
  platform: string;
  isMas: boolean;
  channel?: string;
  reload: () => void;
  ready: () => void;
  focus: () => void;
  openPrefs: (prefType: PrefType) => void;
  toggleMaximizeWindow: () => void;
  onAppState: (cb: (state: 'active' | 'background') => void) => () => void;
  canPromptTouchID: () => boolean;
  promptTouchID: (msg: string) => Promise<{ success: boolean; error?: string }>;
  secureSetItemAsync: (key: string, value: string) => Promise<void>;
  secureGetItemAsync: (key: string) => Promise<string | null>;
  secureDelItemAsync: (key: string) => Promise<string | null>;
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
  setAutoUpdateSettings: (settings: UpdateSettings) => void;
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
};
declare global {
  interface Window {
    desktopApi: DesktopAPI;
    INJECT_PATH: string;
  }
}

ipcRenderer.on(
  'SET_ONEKEY_DESKTOP_GLOBALS',
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
ipcRenderer.on('OPEN_URL_DEEP_LINK_MESSAGE', (event, data) => {
  if (window.ONEKEY_DESKTOP_DEEP_LINKS) {
    window.ONEKEY_DESKTOP_DEEP_LINKS.push(data);
  }
  window.ONEKEY_DESKTOP_DEEP_LINKS = window.ONEKEY_DESKTOP_DEEP_LINKS.slice(-5);
});

const validChannels = [
  // Update events
  'update/checking',
  'update/available',
  'update/not-available',
  'update/error',
  'update/downloading',
  'update/downloaded',
  'touch/update-res-success',
  'touch/update-progress',
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
  ready: () => ipcRenderer.send('app/ready'),
  reload: () => ipcRenderer.send('app/reload'),
  focus: () => ipcRenderer.send('app/focus'),
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
    ipcRenderer.addListener('appState', handler);
    return () => {
      ipcRenderer.removeListener('appState', handler);
    };
  },
  openPrefs: () => ipcRenderer.send('app/openPrefs'),
  toggleMaximizeWindow: () => ipcRenderer.send('app/toggleMaximizeWindow'),
  canPromptTouchID: () =>
    ipcRenderer.sendSync('app/canPromptTouchID') as boolean,
  promptTouchID: async (
    msg: string,
  ): Promise<{ success: boolean; error?: string }> =>
    new Promise((resolve) => {
      ipcRenderer.once('app/promptTouchID/res', (_, arg) => {
        resolve(arg);
      });
      ipcRenderer.send('app/promptTouchID', msg);
    }),
  secureSetItemAsync(key: string, value: string) {
    return keytar.setPassword('OneKey', key, value);
  },
  secureGetItemAsync(key: string) {
    return keytar.getPassword('OneKey', key);
  },
  secureDelItemAsync(key: string) {
    return keytar.deletePassword('OneKey', key);
  },
  reloadBridgeProcess: () => {
    ipcRenderer.send('app/reloadBridgeProcess');
  },

  // Updater
  checkForUpdates: (isManual?: boolean) =>
    ipcRenderer.send('update/check', isManual),
  downloadUpdate: () => ipcRenderer.send('update/download'),
  installUpdate: () => ipcRenderer.send('update/install'),
  setAutoUpdateSettings: (settings: UpdateSettings) =>
    ipcRenderer.send('update/settings', settings),
  clearAutoUpdateSettings: () => ipcRenderer.send('update/clearSettings'),

  touchUpdateResource: (params: {
    resourceUrl: string;
    dialogTitle: string;
    buttonLabel: string;
  }) => ipcRenderer.send('touch/res', params),
  openPrivacyPanel: () => ipcRenderer.send('touch/openPrivacyPanel'),

  restore: () => {
    ipcRenderer.send('app/restoreMainWindow');
  },

  startServer: (port: number, cb: (data: string, success: boolean) => void) => {
    ipcRenderer.on('server/start/res', (_, arg) => {
      const { data, success } = arg;
      cb(data, success);
    });
    ipcRenderer.send('server/start', port);
  },

  stopServer: () => {
    ipcRenderer.send('server/stop');
    ipcRenderer.removeAllListeners('server/start/res');
    ipcRenderer.removeAllListeners('server/listener');
  },
  serverListener: (
    cb: (request: {
      requestId: string;
      postData: any;
      type: string;
      url: string;
    }) => void,
  ) => {
    ipcRenderer.on('server/listener', (_, arg) => {
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
    ipcRenderer.send('server/respond', { requestId, code, type, body });
  },
  quitApp: () => {
    ipcRenderer.send('app/quit');
  },
};

window.desktopApi = desktopApi;
// contextBridge.exposeInMainWorld('desktopApi', desktopApi);
