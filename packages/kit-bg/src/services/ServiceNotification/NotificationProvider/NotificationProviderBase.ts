// eslint-disable-next-line max-classes-per-file

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  INativeNotificationCenterMessageInfo,
  INotificationPermissionDetail,
  INotificationRemoveParams,
  INotificationSetBadgeParams,
  INotificationShowParams,
  INotificationShowResult,
} from '@onekeyhq/shared/types/notification';

import { NotificationEventEmitter } from '../NotificationEventEmitter';
import { PushProviderWebSocket } from '../PushProvider/PushProviderWebSocket';

export type INotificationProviderBaseOptions = {
  disabledWebSocket?: boolean;
  disabledJPush?: boolean;
  instanceId: string;
};
export default abstract class NotificationProviderBase {
  constructor(options: INotificationProviderBaseOptions) {
    this.options = options;
  }

  options: INotificationProviderBaseOptions;

  eventEmitter: NotificationEventEmitter = new NotificationEventEmitter();

  webSocketProvider: PushProviderWebSocket | undefined;

  initWebSocketProvider() {
    if (this.options.disabledWebSocket) {
      return;
    }
    this.webSocketProvider = new PushProviderWebSocket({
      eventEmitter: this.eventEmitter,
      instanceId: this.options.instanceId,
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

  abstract showAndFocusApp(): Promise<void>;

  abstract clearNotificationCache(): Promise<void>;

  fixShowParams(params: INotificationShowParams) {
    // ONEKEY_LOGO_ICON_URL
    params.icon = params.remotePushMessageInfo?.extras?.image || params.icon;
    params.notificationId = params.notificationId || generateUUID();
    params.time = params.time || Date.now();
    return params;
  }

  async getNativeNotifications(): Promise<
    INativeNotificationCenterMessageInfo[]
  > {
    return [];
  }
}
