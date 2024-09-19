import { isNil } from 'lodash';

import { BLANK_ICON_BASE64 } from '@onekeyhq/shared/src/consts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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
    this.addNotificationListeners();
  }

  private addNotificationListeners() {
    // TODO remove listeners
    chrome.notifications.onClicked.addListener(this.handleNotificationClick);
    chrome.notifications.onClosed.addListener(this.handleNotificationClosed);

    // Deprecated since Chrome 65
    chrome.notifications.onShowSettings.addListener(
      this.handleNotificationShowSettings,
    );
    // not working for clicking settings Button
    // chrome.notifications.onButtonClicked.addListener(
    //   this.handleNotificationShowSettings,
    // );
  }

  notificationCache = new Map<string, INotificationShowParams>();

  override async clearNotificationCache() {
    const oneDayAgo = Date.now() - timerUtils.getTimeDurationMs({ day: 1 });
    if (this.notificationCache) {
      this.notificationCache.forEach((notification, id) => {
        if (!notification.time || notification.time < oneDayAgo) {
          this.notificationCache.delete(id);
        }
      });
    }
  }

  handleNotificationClick = async (notificationId: string, ...others: any) => {
    // 处理通知点击的逻辑
    console.log(`Ext 通知 ${notificationId} 被点击了`, {
      notificationId,
      others,
    });

    this.eventEmitter.emit(EPushProviderEventNames.notification_clicked, {
      notificationId,
      params: this.notificationCache.get(notificationId),
    });

    // 点击后关闭通知
    await this.removeNotification({ notificationId });

    //  chrome.notifications.clear won't trigger close event
    await this.handleNotificationClosed(notificationId, true);
  };

  handleNotificationClosed = async (
    notificationId: string,
    byUser: boolean,
    ...others: any
  ) => {
    console.log(`Ext 通知 ${notificationId} 被关闭了`, {
      notificationId,
      byUser,
      others,
    });
    this.eventEmitter.emit(EPushProviderEventNames.notification_closed, {
      notificationId,
      params: this.notificationCache.get(notificationId),
    });
    this.notificationCache.delete(notificationId);
  };

  handleNotificationShowSettings = async () => {
    console.log(`通知 设置被点击了`);
    await this.openPermissionSettings();
  };

  async checkPermissionDefinedInManifest() {
    const isNotificationsPermissionDefined: boolean =
      await chrome.permissions.contains({
        permissions: ['notifications'],
      });
    if (!isNotificationsPermissionDefined) {
      throw new Error('notifications permissions not defined in manifest.json');
    }
  }

  override async getPermission(): Promise<INotificationPermissionDetail> {
    await this.checkPermissionDefinedInManifest();
    const isSupported = true;

    // https://developer.chrome.com/docs/extensions/reference/api/notifications#type-PermissionLevel
    const permissionLevel = await new Promise<'granted' | 'denied'>(
      (resolve) => {
        chrome.notifications.getPermissionLevel(resolve as any);
      },
    );
    if (permissionLevel === 'granted') {
      return {
        permission: ENotificationPermission.granted,
        isSupported,
      };
    }
    if (permissionLevel === 'denied') {
      return {
        permission: ENotificationPermission.denied,
        isSupported,
      };
    }
    return {
      permission: ENotificationPermission.default,
      isSupported,
    };
  }

  override async requestPermission(): Promise<INotificationPermissionDetail> {
    await this.checkPermissionDefinedInManifest();
    const isSupported = true;

    // Ext always return granted
    const currentPermission = await this.getPermission();
    // already granted, do not need to request permission
    if (currentPermission.permission === ENotificationPermission.granted) {
      return currentPermission;
    }

    // TODO call request ext permission from background is not allowed
    //    Uncaught Error: This function must be called during a user gesture
    const granted: boolean = await chrome.permissions.request({
      permissions: ['notifications'],
    });
    return granted
      ? {
          permission: ENotificationPermission.granted,
          isSupported,
        }
      : {
          permission: ENotificationPermission.denied,
          isSupported,
        };
  }

  override async openPermissionSettings(): Promise<void> {
    await extUtils.openPermissionSettings();
  }

  override async showNotification(
    params: INotificationShowParams,
  ): Promise<INotificationShowResult> {
    this.fixShowParams(params);
    const {
      notificationId = generateUUID(),
      icon,
      title,
      description,
    } = params;
    // eslint-disable-next-line spellcheck/spell-checker
    /*
    iconUrl
    - base64 img
    - https url img
    - ext relative path: /static/media/logo-press.bb2d6e4c531cd3679c26.png
    */
    if (params?.showByExtUiNotification) {
      // const notification = new Notification(title, {
      //   body: description,
      //   icon,
      // });
      // notification.onclick = () => {
      //   console.log('notification clicked');
      // };
      // return { notificationId: '' };
    }

    await new Promise<string>((resolve) => {
      const options: chrome.notifications.NotificationOptions<true> = {
        // export type TemplateType = "basic" | "image" | "list" | "progress";
        type: 'basic',
        iconUrl: icon || BLANK_ICON_BASE64, // ONEKEY_LOGO_ICON_URL
        title,
        message: description,
        silent: false,
      };
      chrome.notifications.create(notificationId, options, (id) => {
        if (!id) {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.error(
              'chrome.notifications.create Error:',
              lastError?.message,
            );
          }
          chrome.notifications.create(
            notificationId,
            {
              ...options,
              // image url may be invalid, use blank icon as default
              iconUrl: BLANK_ICON_BASE64, // ONEKEY_LOGO_ICON_URL
            },
            (id2) => {
              resolve(id2);
            },
          );
        } else {
          resolve(id);
        }
      });
    });

    // TODO save cache only if payload exists
    this.notificationCache.set(notificationId, params);
    return { notificationId };
  }

  override async removeNotification(
    params: INotificationRemoveParams,
  ): Promise<void> {
    const { notificationId } = params;
    if (notificationId) {
      try {
        this.notificationCache.delete(notificationId);
      } catch (error) {
        // ignore
      }
      try {
        chrome.notifications.clear(notificationId);
      } catch (error) {
        // ignore
      }
      defaultLogger.notification.common.removeNotification({
        platform: 'ext',
        notificationId,
      });
    }
  }

  override async setBadge(params: INotificationSetBadgeParams): Promise<void> {
    if (
      isNil(params.count) ||
      params.count === 0 ||
      (params.count as unknown as string) === '0'
    ) {
      void chrome.action.setBadgeTextColor({ color: [0, 0, 0, 255] }); // black
      void chrome.action.setBadgeBackgroundColor({
        color: [190, 190, 190, 255],
      }); // gray
      return chrome.action.setBadgeText({ text: '' });
    }
    // chrome extension set badge
    void chrome.action.setBadgeTextColor({ color: '#ffffff' });
    void chrome.action.setBadgeBackgroundColor({ color: '#eb5b4a' });
    return chrome.action.setBadgeText({
      text: notificationsUtils.formatBadgeNumber(params.count),
    });
  }

  override async showAndFocusApp(): Promise<void> {
    //
  }
}
