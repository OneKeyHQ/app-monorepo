import { ipcRenderer } from 'electron';

declare global {
  interface Window {
    desktopApi: any;
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
  // module (auto-updater)
  checkForUpdates: (isManual?: boolean) =>
    ipcRenderer.send('update/check', isManual),
  downloadUpdate: () => ipcRenderer.send('update/download'),
  installUpdate: () => ipcRenderer.send('update/install'),
  cancelUpdate: () => ipcRenderer.send('update/cancel'),
  skipUpdate: (version: string) => ipcRenderer.send('update/skip', version),

  // module (window-controls)
  windowClose: () => ipcRenderer.send('window/close'),
  windowFocus: () => ipcRenderer.send('window/focus'),
  windowMinimize: () => ipcRenderer.send('window/minimize'),
  windowMaximize: () => ipcRenderer.send('window/maximize'),
  windowUnmaximize: () => ipcRenderer.send('window/unmaximize'),
};

export const DesktopAPI = typeof desktopApi;

window.desktopApi = desktopApi;
// contextBridge.exposeInMainWorld('desktopApi', desktopApi);
