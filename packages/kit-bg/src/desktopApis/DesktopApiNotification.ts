import { Notification, app, ipcMain, systemPreferences } from 'electron';
import logger from 'electron-log/main';
import TaskBarBadgeWindows from 'electron-taskbar-badge';
import { isNil } from 'lodash';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import type {
  INotificationPermissionDetail,
  INotificationSetBadgeParams,
  INotificationShowParams,
} from '@onekeyhq/shared/types/notification';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import type { IDesktopApi } from './instance/IDesktopApi';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

/**
 * 通过创建测试通知来检查权限
 * not working, use third-party library instead:
 * https://www.electronjs.org/docs/latest/tutorial/notifications
 * - Mac:  macos-notification-state.
 * - Windows: windows-notification-state.
 * - Linux: libnotify.
 */
async function testNotificationPermission(): Promise<ENotificationPermission> {
  return ENotificationPermission.default;

  // return new Promise((resolve) => {
  //   try {
  //     const testNotification = new Notification({
  //       title: 'Permission Test',
  //       body: 'Testing notification permissions...',
  //       silent: true, // 静默通知，不打扰用户
  //       timeoutType: 'never', // 不自动消失
  //     });

  //     // 监听通知事件
  //     let resolved = false;
  //     const timeout = setTimeout(() => {
  //       if (!resolved) {
  //         resolved = true;
  //         resolve(ENotificationPermission.default);
  //       }
  //     }, 1000);

  //     testNotification.on('show', () => {
  //       if (!resolved) {
  //         resolved = true;
  //         clearTimeout(timeout);
  //         // 立即关闭测试通知
  //         testNotification.close();
  //         resolve(ENotificationPermission.granted);
  //       }
  //     });

  //     testNotification.on('failed', () => {
  //       if (!resolved) {
  //         resolved = true;
  //         clearTimeout(timeout);
  //         resolve(ENotificationPermission.denied);
  //       }
  //     });

  //     // 显示测试通知
  //     testNotification.show();
  //   } catch (error) {
  //     logger.error('Test notification failed:', error);
  //     resolve(ENotificationPermission.denied);
  //   }
  // });
}

/**
 * macOS 通知权限检查
 */
async function getMacOSNotificationPermission(): Promise<ENotificationPermission> {
  try {
    // 方法1: 检查系统通知设置
    const hasNotificationSettings = systemPreferences.getUserDefault(
      'com.apple.notificationcenterui',
      'dictionary',
    );

    if (hasNotificationSettings) {
      // 方法2: 尝试获取应用的通知权限状态
      // 通过检查 NSUserNotificationCenter 的 deliveredNotifications
      const bundleId = app.getName();
      const notificationSettings = systemPreferences.getUserDefault(
        `com.apple.ncprefs.${bundleId}`,
        'dictionary',
      );

      if (notificationSettings) {
        const flags = notificationSettings.flags;
        if (flags !== undefined) {
          // flags 为 0 表示被拒绝，非 0 表示被允许
          return flags === 0
            ? ENotificationPermission.denied
            : ENotificationPermission.granted;
        }
      }
    }

    // 方法3: 使用 Notification.permission (Web API 兼容)
    const webPermission = globalThis.Notification?.permission;
    if (webPermission === 'granted') {
      return ENotificationPermission.granted;
    }
    if (webPermission === 'denied') {
      return ENotificationPermission.denied;
    }

    // 方法4: 尝试创建测试通知来判断权限
    return await testNotificationPermission();
  } catch (error) {
    logger.error('macOS notification permission check failed:', error);
    return ENotificationPermission.default;
  }
}

/**
 * Windows 通知权限检查
 */
async function getWindowsNotificationPermission(): Promise<{
  status: ENotificationPermission;
  details: any;
}> {
  try {
    // 使用 Windows 原生 API 检查通知状态
    // 这里可以集成 windows-notification-state 库
    // 目前先使用基本的检查方法

    // 检查是否在开始菜单中有快捷方式
    const isPackaged = app.isPackaged;
    if (!isPackaged) {
      // 开发模式下的权限检查
      return {
        status: ENotificationPermission.granted,
        details: { reason: 'development_mode', platform: 'Windows' },
      };
    }

    // 尝试使用 Web API 检查权限
    const webPermission = globalThis.Notification?.permission;
    if (webPermission === 'granted') {
      return {
        status: ENotificationPermission.granted,
        details: { method: 'web_api', platform: 'Windows' },
      };
    }
    if (webPermission === 'denied') {
      return {
        status: ENotificationPermission.denied,
        details: { method: 'web_api', platform: 'Windows' },
      };
    }

    // 默认尝试测试通知
    const testResult = await testNotificationPermission();
    return {
      status: testResult,
      details: { method: 'test_notification', platform: 'Windows' },
    };
  } catch (error) {
    logger.error('Windows notification permission check failed:', error);
    return {
      status: ENotificationPermission.default,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'Windows',
      },
    };
  }
}

/**
 * Linux 通知权限检查
 */
async function getLinuxNotificationPermission(): Promise<{
  status: ENotificationPermission;
  details: any;
}> {
  try {
    // Linux 使用 libnotify，通常默认允许通知
    // 检查桌面环境
    const desktopEnv =
      process.env.DESKTOP_SESSION ||
      process.env.XDG_CURRENT_DESKTOP ||
      process.env.XDG_SESSION_DESKTOP ||
      'unknown';

    // 检查是否有 DISPLAY 环境变量（X11）
    const hasDisplay = !!process.env.DISPLAY;

    // 检查是否有 WAYLAND_DISPLAY 环境变量（Wayland）
    const hasWaylandDisplay = !!process.env.WAYLAND_DISPLAY;

    if (!hasDisplay && !hasWaylandDisplay) {
      return {
        status: ENotificationPermission.denied,
        details: {
          reason: 'no_display_server',
          platform: 'Linux',
          desktopEnv,
        },
      };
    }

    // 尝试测试通知权限
    const testResult = await testNotificationPermission();
    return {
      status: testResult,
      details: {
        method: 'test_notification',
        platform: 'Linux',
        desktopEnv,
        hasDisplay,
        hasWaylandDisplay,
      },
    };
  } catch (error) {
    logger.error('Linux notification permission check failed:', error);
    return {
      status: ENotificationPermission.default,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'Linux',
      },
    };
  }
}

/**
 * 跨平台获取通知权限状态
 * 兼容 Windows、macOS、Linux
 */
async function getElectronNotificationPermission(): Promise<{
  isSupported: boolean;
  notificationStatus: ENotificationPermission;
  platformDetails?: any;
}> {
  // 检查是否支持通知
  const isSupported = Notification.isSupported();

  if (!isSupported) {
    return {
      isSupported: false,
      notificationStatus: ENotificationPermission.denied,
      platformDetails: { reason: 'notifications_not_supported' },
    };
  }

  let notificationStatus = ENotificationPermission.default;
  let platformDetails: any = {};

  try {
    if (isMac) {
      // macOS 平台权限检查
      notificationStatus = await getMacOSNotificationPermission();
      platformDetails = { platform: 'macOS' };
    } else if (isWin) {
      // Windows 平台权限检查
      const windowsResult = await getWindowsNotificationPermission();
      notificationStatus = windowsResult.status;
      platformDetails = windowsResult.details;
    } else if (isLinux) {
      // Linux 平台权限检查
      const linuxResult = await getLinuxNotificationPermission();
      notificationStatus = linuxResult.status;
      platformDetails = linuxResult.details;
    }
  } catch (error) {
    logger.error('Error checking notification permission:', error);
    notificationStatus = ENotificationPermission.default;
    platformDetails = {
      error: error instanceof Error ? error.message : 'Unknown error',
      platform: process.platform,
    };
  }

  return {
    isSupported,
    notificationStatus,
    platformDetails,
  };
}

class DesktopApiNotification {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    this.initWin32TaskBarBadge(
      globalThis.$desktopMainAppFunctions?.getAppName?.() || 'OneKey Wallet',
    );
  }

  desktopApi: IDesktopApi;

  private initWin32TaskBarBadge(APP_NAME: string) {
    if (process.platform === 'win32') {
      app.setAppUserModelId(APP_NAME);
      const safelyMainWindow =
        globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();

      if (safelyMainWindow) {
        // TODO not working on Windows 11 (UTM)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const badge = new TaskBarBadgeWindows(safelyMainWindow, {
          fontColor: '#000000',
          font: '62px Microsoft Yahei',
          color: '#000000',
          radius: 48,
          updateBadgeEvent: ipcMessageKeys.NOTIFICATION_SET_BADGE_WINDOWS,
          badgeDescription: '',
          invokeType: 'handle', // handle -> ipcRenderer.invoke,  send -> ipcRenderer.sendSync
          max: 99,
          fit: false,
          useSystemAccentTheme: true,
          additionalFunc: (count: number) => {
            console.log(`Received ${count} new notifications!`);
          },
        });
        console.log('TaskBarBadgeWindows init', badge);
      }
    }
  }

  async showNotification(params: INotificationShowParams): Promise<void> {
    const { title, description, icon } = params;
    console.log('NOTIFICATION_SHOW ', params);

    const notification = new Notification({
      title,
      body: description,
      icon, // base64 or remote url not working
    });

    notification.show();
    console.log('notification show', notification);

    notification.on('click', () => {
      logger.info('notification clicked');
    });

    notification.on('close', () => {
      logger.info('notification closed');
    });
  }

  async setBadge(params: INotificationSetBadgeParams): Promise<void> {
    const count = params.count === null ? 0 : params.count;

    if (isMac) {
      app.setBadgeCount(count);
    }

    if (isLinux) {
      app.setBadgeCount(count);
    }

    if (isWin) {
      const win = globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
      if (win) {
        if (!isNil(count) && count > 0) {
          // TaskBarBadgeWindows will handle badge count render
        } else {
          win.setOverlayIcon(null, '');
        }
      }

      /* 
      // If invokeType is set to "handle"
      // Replace 8 with whatever number you want the badge to display
      ipcRenderer.invoke('notificationCount', 8); 
      */
      // handle -> ipcRenderer.invoke
      void ipcMain.emit(
        ipcMessageKeys.NOTIFICATION_SET_BADGE_WINDOWS,
        params.count ?? 0,
      );
    }
  }

  async getNotificationPermission(): Promise<INotificationPermissionDetail> {
    const electronPermission = await getElectronNotificationPermission();

    const result: INotificationPermissionDetail = {
      permission: electronPermission.notificationStatus,
      isSupported: electronPermission.isSupported,
    };

    // 添加原始权限信息用于调试
    // @ts-ignore
    result.$$permissionRaw =
      globalThis?.Notification?.permission || 'undefined';
    // @ts-ignore
    result.$$electronPermission = electronPermission;

    return result;
  }

  async openPermissionSettings(): Promise<void> {
    await this.desktopApi.system.openPreferences('notification');
  }
}

export default DesktopApiNotification;
