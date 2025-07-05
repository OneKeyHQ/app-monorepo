import os from 'os';

import * as Sentry from '@sentry/electron/main';
import { app, shell, systemPreferences } from 'electron';
import si from 'systeminformation';

import type { IDesktopSystemInfo } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { getMacAppId } from '@onekeyhq/desktop/app/libs/utils';
import type { IMediaType, IPrefType } from '@onekeyhq/shared/types/desktop';

import type { IDesktopApi } from './instance/IDesktopApi';

class DesktopApiSystem {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  async getSystemInfo(): Promise<IDesktopSystemInfo> {
    const system = await si.system();
    const cpu = await si.cpu();
    const osInfo = await si.osInfo();
    const data = Sentry.getGlobalScope().getScopeData();

    const result: IDesktopSystemInfo = {
      sentryContexts: data.contexts,
      // sentryContexts: undefined,
      system,
      cpu,
      os: osInfo,
    };

    return result;
  }

  async reload(): Promise<void> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    safelyBrowserWindow?.reload();
  }

  async quitApp(): Promise<void> {
    app.quit();
  }

  async restore(): Promise<void> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    if (safelyBrowserWindow) {
      safelyBrowserWindow.show();
      safelyBrowserWindow.focus();
    }
  }

  async focus(): Promise<void> {
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    if (safelyBrowserWindow) {
      safelyBrowserWindow.show();
      safelyBrowserWindow.focus();
    }
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

  async openPreferences(prefType: IPrefType): Promise<void> {
    const platform = os.type();
    if (platform === 'Darwin') {
      if (prefType === 'notification') {
        const appId = getMacAppId();
        void shell.openExternal(
          `x-apple.systempreferences:com.apple.preference.notifications?id=${appId}`,
        );
        // old version MacOS
        // 'x-apple.systempreferences:com.apple.preference.security?Privacy_Notifications'
      } else if (prefType === 'default') {
        await shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security',
        );
      } else {
        void shell.openPath(
          '/System/Library/PreferencePanes/Security.prefPane',
        );
      }
    } else if (platform === 'Windows_NT') {
      if (prefType === 'notification') {
        void shell.openExternal('ms-settings:notifications');
      }
      // ref https://docs.microsoft.com/en-us/windows/uwp/launch-resume/launch-settings-app
      if (prefType === 'camera') {
        void shell.openExternal('ms-settings:privacy-webcam');
      }
      // BlueTooth is not supported on desktop currently
    } else {
      // Linux ??
    }
  }

  async openPrivacyPanel(): Promise<void> {
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy',
    );
  }

  async getMediaAccessStatus(
    prefType: IMediaType,
  ): Promise<
    'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'
  > {
    const result = systemPreferences?.getMediaAccessStatus?.(prefType);
    return result || 'unknown';
  }

  // TODO
  //  getEnvPath: () =>
  // ipcRenderer.sendSync(ipcMessageKeys.APP_GET_ENV_PATH) as {
  // [key: string]: string;
  // },
}

export default DesktopApiSystem;
