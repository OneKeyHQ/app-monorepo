import { NotImplemented } from '@onekeyhq/shared/src/errors';
import type {
  INotificationPermissionDetail,
  INotificationRemoveParams,
  INotificationSetBadgeParams,
  INotificationShowParams,
  INotificationShowResult,
} from '@onekeyhq/shared/types/notification';

import NotificationProviderBase from './NotificationProviderBase';

import type { INotificationProviderBaseParams } from './NotificationProviderBase';

export default class NotificationProviderWeb extends NotificationProviderBase {
  constructor(params: INotificationProviderBaseParams) {
    super(params);
    this.initWebSocketProvider();
  }

  override showAndFocusApp(): Promise<void> {
    throw new NotImplemented();
  }

  override requestPermission(): Promise<INotificationPermissionDetail> {
    throw new NotImplemented();
  }

  override getPermission(): Promise<INotificationPermissionDetail> {
    throw new NotImplemented();
  }

  override showNotification(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: INotificationShowParams,
  ): Promise<INotificationShowResult> {
    this.fixShowParams(params);
    throw new NotImplemented();
  }

  override removeNotification(
    _params: INotificationRemoveParams,
  ): Promise<void> {
    throw new NotImplemented();
  }

  override openPermissionSettings(): Promise<void> {
    throw new NotImplemented();
  }

  override async setBadge(_params: INotificationSetBadgeParams): Promise<void> {
    console.log('Web -- setBadge');
  }

  override async clearNotificationCache(): Promise<void> {
    console.log('Web -- clearNotificationCache');
  }
}
