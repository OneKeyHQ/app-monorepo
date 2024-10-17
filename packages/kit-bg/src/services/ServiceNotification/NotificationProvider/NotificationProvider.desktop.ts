import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  INotificationPermissionDetail,
  INotificationRemoveParams,
  INotificationSetBadgeParams,
  INotificationShowParams,
  INotificationShowResult,
} from '@onekeyhq/shared/types/notification';
import {
  ENotificationPermission,
  EPushProviderEventNames,
} from '@onekeyhq/shared/types/notification';

import NotificationProviderBase from './NotificationProviderBase';

import type { INotificationProviderBaseOptions } from './NotificationProviderBase';

export default class NotificationProvider extends NotificationProviderBase {
  constructor(options: INotificationProviderBaseOptions) {
    super(options);
    this.initWebSocketProvider();
  }

  override async getPermission(): Promise<INotificationPermissionDetail> {
    const mainProcessPermission =
      globalThis.desktopApi.getNotificationPermission();
    const permission: NotificationPermission = Notification.permission;
    console.log('Desktop -- Notification.permission', permission);

    const result = {
      // not correctly implemented by main process, always 'denied'
      // permission: mainProcessPermission.permission,

      // not correct by render process, always 'granted'
      // permission: notificationsUtils.convertWebPermissionToEnum(permission),

      permission: ENotificationPermission.default,
      isSupported: mainProcessPermission.isSupported,
    };

    console.log('Desktop -- getPermission() result', result);
    return result;
  }

  override async requestPermission(): Promise<INotificationPermissionDetail> {
    const result: NotificationPermission =
      await Notification.requestPermission();
    // requestPermission result is not correct, always 'granted'
    console.log('Desktop -- Notification.requestPermission() result', result);
    return this.getPermission();
  }

  override async openPermissionSettings(): Promise<void> {
    globalThis.desktopApi.openPreferences('notification');
  }

  override async showNotification(
    params: INotificationShowParams,
  ): Promise<INotificationShowResult> {
    this.fixShowParams(params);
    const { title, description, icon, notificationId } = params;
    let notification: Notification | undefined;

    if (params.showByElectronMainProcess) {
      // use main process Electron Notification
      globalThis.desktopApi.showNotification({
        notificationId,
        title,
        description,
        icon, // icon not support from main process
      });

      // ipcRenderer.on('notification-clicked', this.handleNotificationClick);
      // ipcRenderer.on('notification-closed', this.handleNotificationClosed);
    } else {
      // use render process Browser Notification
      notification = new Notification(title, {
        body: description,
        icon,
      });

      // @ts-ignore
      notification.customParamsData = params;

      notification.onclick = async (event: Event, ...others: any) => {
        console.log('notification.onclick', { event, others });
        this.eventEmitter.emit(EPushProviderEventNames.notification_clicked, {
          notificationId,
          params,
          webEvent: event,
        });
        await this.removeNotification({
          notificationId,
          desktopNotification: notification,
        });
      };
      notification.onclose = async (event: Event, ...others: any) => {
        console.log('notification.onclose', { event, others });
        this.eventEmitter.emit(EPushProviderEventNames.notification_closed, {
          notificationId,
          params,
          webEvent: event,
        });
      };

      // remove notification in 5s
      // setTimeout(() => {
      //   this.removeNotification({ desktopNotification: notification });
      // }, 5000);
    }

    return {
      notificationId: params.notificationId,
      desktopNotification: notification,
    };
  }

  override async removeNotification(
    params: INotificationRemoveParams,
  ): Promise<void> {
    const { desktopNotification, notificationId } = params;
    if (desktopNotification) {
      try {
        desktopNotification.close();
      } catch (error) {
        // ignore
      }
      defaultLogger.notification.common.removeNotification({
        platform: 'desktop',
        notificationId:
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          desktopNotification?.customParamsData?.notificationId ||
          notificationId,
      });
    }
  }

  override async setBadge(params: INotificationSetBadgeParams): Promise<void> {
    globalThis.desktopApi.setBadge(params);
  }

  override async showAndFocusApp(): Promise<void> {
    globalThis.desktopApi.restore();
  }

  override async clearNotificationCache(): Promise<void> {
    console.log('Desktop -- clearNotificationCache');
  }
}
