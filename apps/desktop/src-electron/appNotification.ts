import {
  Notification,
  app,
  ipcMain,
  nativeImage,
  systemPreferences,
} from 'electron';
import logger from 'electron-log';
import { isNil } from 'lodash';

import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IDesktopSubModuleInitParams } from '@onekeyhq/shared/types/desktop';
import type {
  INotificationPermissionDetail,
  INotificationSetBadgeParams,
  INotificationShowParams,
} from '@onekeyhq/shared/types/notification';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import { ipcMessageKeys } from './config';

async function getElectronNotificationPermission() {
  let macOsNotificationState: any;

  const isSupported = Notification.isSupported();

  //   let notificationStatus:
  //     | 'not-determined'
  //     | 'granted'
  //     | 'denied'
  //     | 'restricted'
  //     | 'unknown' = 'unknown';

  let notificationStatus: ENotificationPermission =
    ENotificationPermission.default;

  if (process.platform === 'darwin') {
    try {
      /*
        import {
            getDoNotDisturb,
            getNotificationState,
            getSessionState,
        } from 'macos-notification-state';
        */
      // TODO cause app crash
      // Error: [macos-notification-state] notificationstate addon not loaded
      // const doNotDisturb = await getDoNotDisturb();
      // const notificationState = await getNotificationState();
      // const sessionState = getSessionState();
      // macOsNotificationState = {
      //   doNotDisturb,
      //   notificationState,
      //   sessionState,
      // };
    } catch (error) {
      console.error(error);
    }

    try {
      const notificationCenter = systemPreferences.getUserDefault(
        'com.apple.notificationcenterui',
        'string',
      );
      if (notificationCenter === 'true') {
        // 通知中心已启用，但这并不意味着我们的应用被允许发送通知
        // 我们可以尝试创建一个测试通知来进一步确认
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

function init({ APP_NAME, getSafelyMainWindow }: IDesktopSubModuleInitParams) {
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_NAME);
  }

  ipcMain.on(ipcMessageKeys.NOTIFICATION_GET_PERMISSION, async (event) => {
    const electronPermission = await getElectronNotificationPermission();

    const result: INotificationPermissionDetail = {
      permission: electronPermission.notificationStatus,
      isSupported: electronPermission.isSupported,
    };
    // @ts-ignore
    result.permissionRaw = Notification.permission || 'undefined';

    event.returnValue = result;
  });

  ipcMain.on(
    ipcMessageKeys.NOTIFICATION_SHOW,
    async (event, params: INotificationShowParams) => {
      // electron show notification
      const { notificationId, title, description, icon } = params;
      console.log('NOTIFICATION_SHOW ', params);
      const uuid = notificationId || generateUUID();
      const notification = new Notification({
        title,
        body: description,
        icon, // base64 or remote url not working
      });
      notification.show();

      console.log('notification show', notification);

      notification.on('click', () => {
        logger.info('notification clicked');
        // 可以在这里处理通知被点击的事件
        const safelyMainWindow = getSafelyMainWindow();
        // safelyMainWindow?.webContents.send(ipcMessageKeys.NOTIFICATION_CLICKED, uuid);
        // showMainWindow(); // 例如，显示主窗口
      });

      notification.on('close', () => {
        logger.info('notification closed');
        // 可以在这里处理通知被关闭的事件
      });
    },
  );

  ipcMain.on(
    ipcMessageKeys.NOTIFICATION_SET_BADGE,
    (event, payload: INotificationSetBadgeParams) => {
      const count = payload.count === null ? 0 : payload.count;

      if (process.platform === 'darwin') {
        // app.dock.setBadge(count.toString());
        app.setBadgeCount(count);
      }

      if (process.platform === 'linux') {
        app.setBadgeCount(count);
      }

      if (process.platform === 'win32') {
        const win = getSafelyMainWindow();
        if (win) {
          if (!isNil(count) && count > 0) {
            // 创建一个带有数字的覆盖图标
            const canvas = document.createElement('canvas');
            canvas.height = 140;
            canvas.width = 140;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              return;
            }
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.ellipse(70, 70, 70, 70, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.font = 'bold 80px Arial';
            ctx.fillText(count.toString(), 70, 98);

            const image = nativeImage.createFromDataURL(canvas.toDataURL());
            win.setOverlayIcon(image, count.toString());
          } else {
            win.setOverlayIcon(null, '');
          }
        }
      }
    },
  );
}

export default {
  init,
};
