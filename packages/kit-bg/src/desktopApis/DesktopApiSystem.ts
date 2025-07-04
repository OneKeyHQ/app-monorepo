import * as Sentry from '@sentry/electron/main';
import si from 'systeminformation';
import { ipcRenderer } from 'electron';

import type { IDesktopSystemInfo } from '@onekeyhq/desktop/app/config';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';

class DesktopApiSystem {
  async getSystemInfo(): Promise<IDesktopSystemInfo> {
    const system = await si.system();
    const cpu = await si.cpu();
    const os = await si.osInfo();
    const data = Sentry.getGlobalScope().getScopeData();

    const result: IDesktopSystemInfo = {
      sentryContexts: data.contexts,
      system,
      cpu,
      os,
    };

    return result;
  }

  ready(): void {
    ipcRenderer.send(ipcMessageKeys.APP_READY);
  }

  reload(): void {
    ipcRenderer.send(ipcMessageKeys.APP_RELOAD);
  }

  focus(): void {
    ipcRenderer.send(ipcMessageKeys.APP_FOCUS);
  }

  restore(): void {
    ipcRenderer.send(ipcMessageKeys.APP_RESTORE_MAIN_WINDOW);
  }

  quitApp(): void {
    ipcRenderer.send(ipcMessageKeys.APP_QUIT);
  }

  isFocused(): boolean {
    return ipcRenderer.sendSync(ipcMessageKeys.APP_IS_FOCUSED);
  }

  changeDevTools(isOpen: boolean): void {
    ipcRenderer.send(ipcMessageKeys.APP_CHANGE_DEV_TOOLS_STATUS, isOpen);
  }

  changeTheme(theme: string): void {
    ipcRenderer.send(ipcMessageKeys.THEME_UPDATE, theme);
  }

  changeLanguage(lang: string): void {
    ipcRenderer.send(ipcMessageKeys.APP_CHANGE_LANGUAGE, lang);
  }

  toggleMaximizeWindow(): void {
    ipcRenderer.send(ipcMessageKeys.APP_TOGGLE_MAXIMIZE_WINDOW);
  }

  clearWebViewCache(): void {
    ipcRenderer.send(ipcMessageKeys.CLEAR_WEBVIEW_CACHE);
  }

  reloadBridgeProcess(): void {
    ipcRenderer.send(ipcMessageKeys.APP_RELOAD_BRIDGE_PROCESS);
  }
}

export default DesktopApiSystem;
