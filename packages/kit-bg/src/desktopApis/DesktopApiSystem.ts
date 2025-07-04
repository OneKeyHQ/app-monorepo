import * as Sentry from '@sentry/electron/main';
import { app } from 'electron';
import si from 'systeminformation';

import type { IDesktopSystemInfo } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';

class DesktopApiSystem {
  async getSystemInfo(): Promise<IDesktopSystemInfo> {
    const system = await si.system();
    const cpu = await si.cpu();
    const os = await si.osInfo();
    const data = Sentry.getGlobalScope().getScopeData();

    const result: IDesktopSystemInfo = {
      sentryContexts: data.contexts,
      // sentryContexts: undefined,
      system,
      cpu,
      os,
    };

    return result;
  }

  async reload(): Promise<void> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    safelyBrowserWindow?.reload();
  }

  async focus(): Promise<void> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    if (safelyBrowserWindow) {
      safelyBrowserWindow.show();
      safelyBrowserWindow.focus();
    }
  }

  async restore(): Promise<void> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    if (safelyBrowserWindow) {
      safelyBrowserWindow.show();
      safelyBrowserWindow.focus();
    }
  }

  async quitApp(): Promise<void> {
    app.quit();
  }

  async isFocused(): Promise<boolean> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    const result = safelyBrowserWindow?.isFocused() || false;
    console.log('isFocused', result);
    return result;
  }

  async changeDevTools(isOpen: boolean): Promise<void> {
    store.setDevTools(isOpen);
    globalThis.$desktopMainAppFunctions?.refreshMenu?.();
  }

  async changeLanguage(lang: string): Promise<void> {
    store.setLanguage(lang);
    globalThis.$desktopMainAppFunctions?.refreshMenu?.();
  }

  async toggleMaximizeWindow(): Promise<void> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    const isMaximized = safelyBrowserWindow?.isMaximized();
    console.log('toggleMaximizeWindow', isMaximized);
    if (isMaximized) {
      // Restore the original window size
      safelyBrowserWindow?.unmaximize();
    } else {
      // Maximized window
      safelyBrowserWindow?.maximize();
    }
  }
}

export default DesktopApiSystem;
