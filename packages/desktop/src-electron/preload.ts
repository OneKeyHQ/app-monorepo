import { ipcRenderer } from 'electron';
import keytar from 'keytar';

export type PrefType = 'camera' | 'bluetooth' | 'location';
export type DesktopAPI = {
  hello: string;
  arch: string;
  platform: string;
  reload: () => void;
  openPrefs: (prefType: PrefType) => void;
  toggleMaximizeWindow: () => void;
  onAppState: (cb: (state: 'active' | 'background') => void) => () => void;
  canPromptTouchID: () => boolean;
  promptTouchID: (msg: string) => Promise<boolean>;
  secureSetItemAsync: (key: string, value: string) => Promise<void>;
  secureGetItemAsync: (key: string) => Promise<string | null>;
  reloadBridgeProcess: () => void;
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

const desktopApi = {
  hello: 'world',
  arch: process.arch,
  platform: process.platform,
  reload: () => ipcRenderer.send('app/reload'),
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
