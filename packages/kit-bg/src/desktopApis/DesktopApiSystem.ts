import os from 'os';
import path from 'path';

import * as Sentry from '@sentry/electron/main';
import { Menu, app, shell, systemPreferences } from 'electron';
import logger from 'electron-log/main';
import si from 'systeminformation';

import type { IDesktopSystemInfo } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import type { IMacBundleInfo } from '@onekeyhq/desktop/app/libs/utils';
import {
  getBackgroundColor,
  getMacAppId,
  parseContentPList,
} from '@onekeyhq/desktop/app/libs/utils';
import { restartBridge } from '@onekeyhq/desktop/app/process';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IMediaType, IPrefType } from '@onekeyhq/shared/types/desktop';

import type { IDesktopApi } from './instance/IDesktopApi';

export type IMenuItemType = 'normal' | 'separator' | 'submenu';

export type IMenuItemRole =
  | 'about'
  | 'hide'
  | 'unhide'
  | 'quit'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'selectall'
  | 'reload'
  | 'forcereload'
  | 'toggledevtools'
  | 'resetzoom'
  | 'zoomin'
  | 'zoomout'
  | 'togglefullscreen'
  | 'minimize'
  | 'zoom'
  | 'front'
  | 'help';

export interface IMenuItem {
  label: string;
  submenu: IMenu | null;
  type: IMenuItemType;
  role: IMenuItemRole | null;
  accelerator: string | null;
  icon: string | null;
  // cspell:ignore sublabel
  sublabel: string;
  toolTip: string;
  enabled: boolean;
  visible: boolean;
  checked: boolean;
  acceleratorWorksWhenHidden: boolean;
  registerAccelerator: boolean;
  commandId: number;
  userAccelerator: string | null;
}

export interface IMenu {
  groupsMap: Record<string, unknown>;
  items: IMenuItem[];
}

class DesktopApiSystem {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  // Cache system info for 30 minutes to avoid frequent system queries
  private _getSystemInfoInternal = memoizee(
    async (): Promise<IDesktopSystemInfo> => {
      try {
        // Fetch all system information concurrently for better performance
        const [system, cpu, osInfo] = await Promise.all([
          si.system(),
          si.cpu(),
          si.osInfo(),
        ]);

        // Get Sentry data (this shouldn't fail, but wrap in try-catch just in case)
        let sentryContexts;
        try {
          const data = Sentry.getGlobalScope().getScopeData();
          sentryContexts = data.contexts;
        } catch (sentryError) {
          // If Sentry fails, log but don't fail the entire operation
          console.warn('Failed to get Sentry context data:', sentryError);
          sentryContexts = undefined;
        }

        // Only cache if we successfully got all required system info
        const result: IDesktopSystemInfo = {
          sentryContexts,
          system,
          cpu,
          os: osInfo,
        };

        return result;
      } catch (error) {
        // Don't cache failed results - rethrow error so memoizee won't cache it
        console.error('Failed to get system information:', error);
        throw error;
      }
    },
    {
      maxAge: 30 * 60 * 1000, // 30 minutes cache duration
      primitive: true, // no arguments to normalize
      promise: true, // ensure concurrent calls wait for the same promise
      max: 1, // limit to only 1 cached result (since no params)
      normalizer: () => 'system-info', // static key for single cached result
    },
  );

  async getSystemInfo(): Promise<IDesktopSystemInfo> {
    return this._getSystemInfoInternal();
  }

  async getPerfMemoryUsage(): Promise<{ rss?: number } | null> {
    try {
      if (typeof app.getAppMetrics === 'function') {
        const metrics = app.getAppMetrics();
        let workingSetKbTotal = 0;
        for (const m of metrics) {
          const ws = m?.memory?.workingSetSize;
          if (typeof ws === 'number' && Number.isFinite(ws) && ws > 0) {
            workingSetKbTotal += ws;
          }
        }
        if (workingSetKbTotal > 0) {
          return { rss: workingSetKbTotal * 1024 };
        }
      }

      if (typeof process.getProcessMemoryInfo === 'function') {
        const info = await process.getProcessMemoryInfo();
        const residentSetKb = info?.residentSet;
        if (
          typeof residentSetKb === 'number' &&
          Number.isFinite(residentSetKb) &&
          residentSetKb > 0
        ) {
          return { rss: residentSetKb * 1024 };
        }
      }
    } catch {
      // ignore
    }

    return null;
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

  async getApplicationMenu(): Promise<IMenu> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(
      JSON.stringify(Menu.getApplicationMenu(), (key: string, value: any) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        key !== 'commandsMap' && key !== 'menu' ? value : undefined,
      ),
    );
  }

  private getMenuItemByCommandId(
    id: number,
    menuToSearch: Electron.Menu | null,
  ): Electron.MenuItem | undefined {
    if (!menuToSearch) return undefined;

    for (const item of menuToSearch.items) {
      if (item.submenu) {
        const submenuItem = this.getMenuItemByCommandId(id, item.submenu);
        if (submenuItem) return submenuItem;
      } else if ((item as any).commandId === id) {
        return item;
      }
    }
    return undefined;
  }

  async executeMenuCommand(commandId: number): Promise<void> {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;

    const item = this.getMenuItemByCommandId(commandId, menu);
    if (item) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      item.click(
        undefined as any,
        globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.() as any,
        undefined as any,
      );
    }
  }

  async getMenuItemIcon(commandId: number): Promise<string | null> {
    const menu = Menu.getApplicationMenu();
    if (!menu) return null;

    const item = this.getMenuItemByCommandId(commandId, menu);
    if (item && item.icon && typeof item.icon !== 'string') {
      return item.icon.toDataURL();
    }
    return null;
  }

  async changeTheme(theme: 'light' | 'dark'): Promise<void> {
    store.setTheme(theme);
    const safelyBrowserWindow =
      globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
    safelyBrowserWindow?.setBackgroundColor(getBackgroundColor(theme));
    if (process.platform === 'win32') {
      try {
        safelyBrowserWindow?.setTitleBarOverlay({
          symbolColor: theme === 'dark' ? '#ffffff' : '#000000',
          color: '#00000000',
        });
      } catch {
        // noop
      }
    }
  }
}

export default DesktopApiSystem;
