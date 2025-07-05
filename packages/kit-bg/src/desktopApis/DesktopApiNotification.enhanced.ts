import { Notification, app, ipcMain, systemPreferences } from 'electron';
import logger from 'electron-log/main';
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
 * 增强版跨平台通知权限检查
 * 使用第三方库获得更精确的权限检查
 */
async function getElectronNotificationPermissionEnhanced(): Promise<{
  isSupported: boolean;
  notificationStatus: ENotificationPermission;
  platformDetails?: any;
}> {
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
      // macOS 使用 macos-notification-state
      try {
        const { getNotificationState, getDoNotDisturb } = await import('macos-notification-state');
        
        const notificationState = await getNotificationState();
        const doNotDisturb = await getDoNotDisturb();
        
        platformDetails = {
          platform: 'macOS',
          notificationState,
          doNotDisturb,
          method: 'macos-notification-state',
        };

        // 根据状态判断权限
        if (notificationState === 'granted') {
          notificationStatus = ENotificationPermission.granted;
        } else if (notificationState === 'denied') {
          notificationStatus = ENotificationPermission.denied;
        } else {
          notificationStatus = ENotificationPermission.default;
        }
      } catch (error) {
        logger.warn('macos-notification-state not available, using fallback');
        notificationStatus = await getMacOSNotificationPermissionFallback();
        platformDetails = { platform: 'macOS', method: 'fallback' };
      }
    } else if (isWin) {
      // Windows 使用 windows-notification-state
      try {
        const { queryUserNotificationState } = await import('windows-notification-state');
        
        const state = await queryUserNotificationState();
        
        platformDetails = {
          platform: 'Windows',
          notificationState: state,
          method: 'windows-notification-state',
        };

        // 根据 Windows 状态判断权限
        if (state === 'QUNS_ACCEPTS_NOTIFICATIONS') {
          notificationStatus = ENotificationPermission.granted;
        } else if (state === 'QUNS_NOT_PRESENT' || state === 'QUNS_BUSY') {
          notificationStatus = ENotificationPermission.denied;
        } else {
          notificationStatus = ENotificationPermission.default;
        }
      } catch (error) {
        logger.warn('windows-notification-state not available, using fallback');
        const windowsResult = await getWindowsNotificationPermissionFallback();
        notificationStatus = windowsResult.status;
        platformDetails = { ...windowsResult.details, method: 'fallback' };
      }
    } else if (isLinux) {
      // Linux 使用基本检查
      const linuxResult = await getLinuxNotificationPermission();
      notificationStatus = linuxResult.status;
      platformDetails = linuxResult.details;
    }
  } catch (error) {
    logger.error('Enhanced notification permission check failed:', error);
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

/**
 * macOS 备用方案
 */
async function getMacOSNotificationPermissionFallback(): Promise<ENotificationPermission> {
  try {
    // 尝试获取应用的通知权限状态
    const bundleId = app.getName();
    const notificationSettings = systemPreferences.getUserDefault(
      `com.apple.ncprefs.${bundleId}`,
      'dictionary'
    );
    
    if (notificationSettings) {
      const flags = notificationSettings.flags;
      if (flags !== undefined) {
        return flags === 0 ? ENotificationPermission.denied : ENotificationPermission.granted;
      }
    }

    // 使用测试通知
    return await testNotificationPermission();
  } catch (error) {
    logger.error('macOS fallback permission check failed:', error);
    return ENotificationPermission.default;
  }
}

/**
 * Windows 备用方案
 */
async function getWindowsNotificationPermissionFallback(): Promise<{
  status: ENotificationPermission;
  details: any;
}> {
  try {
    // 检查 AppUserModelID
    const appId = app.getAppUserModelId();
    if (!appId) {
      return {
        status: ENotificationPermission.denied,
        details: { reason: 'no_app_user_model_id', platform: 'Windows' },
      };
    }

    // 开发模式检查
    if (!app.isPackaged) {
      return {
        status: ENotificationPermission.granted,
        details: { reason: 'development_mode', platform: 'Windows' },
      };
    }

    // 使用测试通知
    const testResult = await testNotificationPermission();
    return {
      status: testResult,
      details: { method: 'test_notification', platform: 'Windows' },
    };
  } catch (error) {
    return {
      status: ENotificationPermission.default,
      details: { error: error instanceof Error ? error.message : 'Unknown error', platform: 'Windows' },
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
    const desktopEnv = process.env.DESKTOP_SESSION || 
                      process.env.XDG_CURRENT_DESKTOP || 
                      process.env.XDG_SESSION_DESKTOP || 
                      'unknown';

    const hasDisplay = !!process.env.DISPLAY;
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

    // Linux 通常默认允许通知
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
 * 通过创建测试通知来检查权限
 */
async function testNotificationPermission(): Promise<ENotificationPermission> {
  return new Promise((resolve) => {
    try {
      const testNotification = new Notification({
        title: 'Permission Test',
        body: 'Testing notification permissions...',
        silent: true,
        timeoutType: 'never',
      });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(ENotificationPermission.default);
        }
      }, 1000);

      testNotification.on('show', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          testNotification.close();
          resolve(ENotificationPermission.granted);
        }
      });

      testNotification.on('failed', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(ENotificationPermission.denied);
        }
      });

      testNotification.show();
    } catch (error) {
      logger.error('Test notification failed:', error);
      resolve(ENotificationPermission.denied);
    }
  });
}

class DesktopApiNotificationEnhanced {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  /**
   * 获取通知权限 - 增强版
   */
  async getNotificationPermission(): Promise<INotificationPermissionDetail> {
    const electronPermission = await getElectronNotificationPermissionEnhanced();

    const result: INotificationPermissionDetail = {
      permission: electronPermission.notificationStatus,
      isSupported: electronPermission.isSupported,
    };

    // 添加详细信息
    (result as any).permissionRaw = (globalThis as any).Notification?.permission || 'undefined';
    (result as any).platformDetails = electronPermission.platformDetails;

    return result;
  }

  // 其他方法保持不变...
}

export { DesktopApiNotificationEnhanced }; 