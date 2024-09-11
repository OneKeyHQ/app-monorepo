// eslint-disable-next-line max-classes-per-file

import { ONEKEY_LOGO_ICON_URL } from '@onekeyhq/shared/src/consts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  INotificationPermissionDetail,
  INotificationRemoveParams,
  INotificationSetBadgeParams,
  INotificationShowParams,
  INotificationShowResult,
} from '@onekeyhq/shared/types/notification';

import { NotificationEventEmitter } from '../NotificationEventEmitter';
import { PushProviderWebSocket } from '../PushProvider/PushProviderWebSocket';

export default abstract class NotificationProviderBase {
  constructor() {
    console.log('NotificationProviderBase constructor');
  }

  eventEmitter: NotificationEventEmitter = new NotificationEventEmitter();

  webSocketProvider: PushProviderWebSocket | undefined;

  initWebSocketProvider() {
    this.webSocketProvider = new PushProviderWebSocket({
      eventEmitter: this.eventEmitter,
    });
  }

  abstract getPermission(): Promise<INotificationPermissionDetail>;

  abstract requestPermission(): Promise<INotificationPermissionDetail>;

  abstract openPermissionSettings(): Promise<void>;

  // showLocalNotification
  abstract showNotification(
    params: INotificationShowParams,
  ): Promise<INotificationShowResult>;

  abstract removeNotification(params: INotificationRemoveParams): Promise<void>;

  // StateActiveContainer, JPush, Ext, Electron
  abstract setBadge(params: INotificationSetBadgeParams): Promise<void>;
  // TODO getBadgeCount

  async clearBadge() {
    await this.setBadge({ count: null });
    defaultLogger.notification.common.clearBadge();
  }

  abstract showAndFocusApp(): Promise<void>;

  abstract clearNotificationCache(): Promise<void>;

  fixShowParams(params: INotificationShowParams) {
    params.icon = params.icon || ONEKEY_LOGO_ICON_URL;
    params.notificationId = params.notificationId || generateUUID();
    params.time = params.time || Date.now();
    return params;
  }
}
