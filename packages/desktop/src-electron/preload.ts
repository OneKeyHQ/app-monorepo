import { ipcRenderer } from 'electron';

// export type PrefType = 'camera' | 'bluetooth';
export type PrefType = 'camera';
export type DesktopAPI = {
  hello: string;
  reload: () => void;
  openPrefs: (prefType: PrefType) => void;
  onAppState: (cb: (state: 'active' | 'background') => void) => void;
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
  reload: () => ipcRenderer.send('app/reload'),
  onAppState: (cb: (state: 'active' | 'background') => void) => {
    ipcRenderer.on('appState', (_, value) => {
      cb(value);
    });
  },
  openPrefs: () => ipcRenderer.send('app/openPrefs'),
};

window.desktopApi = desktopApi;
// contextBridge.exposeInMainWorld('desktopApi', desktopApi);
