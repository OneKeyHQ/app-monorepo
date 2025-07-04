import { Notification, app, systemPreferences } from 'electron';
import logger from 'electron-log/main';
import { isNil } from 'lodash';

import type {
  INotificationPermissionDetail,
  INotificationSetBadgeParams,
  INotificationShowParams,
} from '@onekeyhq/shared/types/notification';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

class DesktopApiNotification {
  async showNotification(params: INotificationShowParams): Promise<void> {
    const { title, description, icon } = params;
    console.log('NOTIFICATION_SHOW ', params);
    
    const notification = new Notification({
      title,
      body: description,
      icon,
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
      const safelyBrowserWindow =
        globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
      if (safelyBrowserWindow) {
        if (!isNil(count) && count > 0) {
          // TaskBarBadgeWindows will handle badge count render
        } else {
          safelyBrowserWindow.setOverlayIcon(null, '');
        }
      }
    }
  }

  async getNotificationPermission(): Promise<INotificationPermissionDetail> {
    const electronPermission = await this.getElectronNotificationPermission();

    const result: INotificationPermissionDetail = {
      permission: electronPermission.notificationStatus,
      isSupported: electronPermission.isSupported,
    };
    
    (result as any).permissionRaw = Notification.permission || 'undefined';
    return result;
  }

  private async getElectronNotificationPermission() {
    let macOsNotificationState: any;
    const isSupported = Notification.isSupported();
    let notificationStatus: ENotificationPermission = ENotificationPermission.default;

    if (isMac) {
      try {
        const notificationCenter = systemPreferences.getUserDefault(
          'com.apple.notificationcenterui',
          'string',
        );
        if (notificationCenter === 'true') {
          notificationStatus = ENotificationPermission.granted;
        } else {
          notificationStatus = ENotificationPermission.denied;
        }
      } catch (error) {
        console.error('Error checking notification permission:', error);
        notificationStatus = ENotificationPermission.default;
      }
    }

    return {
      isSupported,
      notificationStatus,
      macOsNotificationState,
    };
  }
}

export default DesktopApiNotification;
