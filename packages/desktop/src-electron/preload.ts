/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/require-await */
import { ipcRenderer } from 'electron';

let keytar = {
  async setPassword(...args: any[]) {
    // noop
    console.error('keytar.setPassword() not working.');
  },
  async getPassword(...args: any[]) {
    console.error('keytar.getPassword() not working.');
    return Promise.resolve('');
  },
};

try {
  // eslint-disable-next-line global-require
  keytar = require('keytar');
} catch (error) {
  // Error: dlopen(//app-monorepo/node_modules/keytar/build/Release/keytar.node, 0x0001): tried: '//app-monorepo/node_modules/keytar/build/Release/keytar.node' (mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64e'))
  console.error(error);
}

export type PrefType = 'camera' | 'bluetooth' | 'location' | 'notification';
export type DesktopAPI = {
  hello: string;
  arch: string;
  platform: string;
  reload: () => void;
  ready: () => void;
  openPrefs: (prefType: PrefType) => void;
  toggleMaximizeWindow: () => void;
  onAppState: (cb: (state: 'active' | 'background') => void) => () => void;
  canPromptTouchID: () => boolean;
  promptTouchID: (msg: string) => Promise<boolean>;
  secureSetItemAsync: (key: string, value: string) => Promise<void>;
  secureGetItemAsync: (key: string) => Promise<string | null>;
  reloadBridgeProcess: () => void;
  addIpcEventListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => void;
  removeIpcEventListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => void;
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

const desktopApi = {
  hello: 'world',
  arch: process.arch,
  platform: process.platform,
  ready: () => ipcRenderer.send('app/ready'),
  reload: () => ipcRenderer.send('app/reload'),
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
  promptTouchID: async (msg: string): Promise<boolean> =>
    new Promise((resolve) => {
      ipcRenderer.once('app/promptTouchID/res', (_, arg) => {
        if (arg) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      ipcRenderer.send('app/promptTouchID', msg);
    }),
  secureSetItemAsync(key: string, value: string) {
    return keytar.setPassword('OneKey', key, value);
  },
  secureGetItemAsync(key: string) {
    return keytar.getPassword('OneKey', key);
  },
  reloadBridgeProcess: () => {
    ipcRenderer.send('app/reloadBridgeProcess');
  },
};

window.desktopApi = desktopApi;
// contextBridge.exposeInMainWorld('desktopApi', desktopApi);
