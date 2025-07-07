import os from 'os';
import path from 'path';

import * as Sentry from '@sentry/electron/main';
import { app, shell, systemPreferences } from 'electron';
import logger from 'electron-log/main';
import si from 'systeminformation';

import type { IDesktopSystemInfo } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import type { IMacBundleInfo } from '@onekeyhq/desktop/app/libs/utils';
import {
  getMacAppId,
  parseContentPList,
} from '@onekeyhq/desktop/app/libs/utils';
import { restartBridge } from '@onekeyhq/desktop/app/process';
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
    globalThis.$desktopMainAppFunctions?.quitOrMinimizeApp?.();
  }

  async restore(): Promise<boolean> {
    globalThis.$desktopMainAppFunctions?.showMainWindow?.();
    return true;
  }

  async focus(): Promise<void> {
    globalThis.$desktopMainAppFunctions?.showMainWindow?.();
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

  async getVersion(): Promise<string> {
    return app.getVersion();
  }

  async getEnvPath(): Promise<{ [key: string]: string }> {
    const home: string = app.getPath('home');
    const appData: string = app.getPath('appData');
    const userData: string = app.getPath('userData');
    const sessionData: string = app.getPath('sessionData');
    const exe: string = app.getPath('exe');
    const temp: string = app.getPath('temp');
    const module: string = app.getPath('module');
    const desktop: string = app.getPath('desktop');
    const appPath: string = app.getAppPath();
    return {
      userData,
      appPath,
      home,
      appData,
      sessionData,
      exe,
      temp,
      module,
      desktop,
    };
  }

  async getBundleInfo(): Promise<IMacBundleInfo | undefined> {
    return parseContentPList();
  }

  async openLoggerFile(): Promise<void> {
    await shell.openPath(path.dirname(logger.transports.file.getFile().path));
  }

  async reloadBridgeProcess(): Promise<boolean> {
    await restartBridge();
    return true;
  }

  async getAppName(): Promise<string> {
    return (
      globalThis.$desktopMainAppFunctions?.getAppName?.() || 'OneKey Wallet'
    );
  }

  async disableShortcuts(params: {
    disableAllShortcuts?: boolean;
  }): Promise<void> {
    store.setDisableKeyboardShortcuts(params);
  }
}

export default DesktopApiSystem;
