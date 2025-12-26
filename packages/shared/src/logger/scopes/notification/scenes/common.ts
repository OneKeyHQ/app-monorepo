import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';
import type {
  ENotificationPushTopicTypes,
  INotificationPermissionDetail,
  INotificationPushMessageAckParams,
  INotificationPushMessageInfo,
  INotificationPushRegisterParams,
  INotificationSetBadgeParams,
  INotificationShowParams,
} from '@onekeyhq/shared/types/notification';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

export class CommonScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  logSensitiveMessage(a: number, b: number) {
    return [a, b, devOnlyData('this is a sensitive message')];
  }

  @LogToLocal()
  notificationInitOk() {
    return true;
  }

  @LogToLocal()
  pushProviderConnected({
    jpushId,
    socketId,
  }: {
    jpushId?: string;
    socketId?: string;
  }) {
    return { jpushId, socketId };
  }

  @LogToLocal()
  registerClient(
    params: INotificationPushRegisterParams,
    apiResult: any,
    instanceId: string,
  ) {
    const { client, syncAccounts, syncMethod } = params;
    return [
      {
        jpushId: client.jpushId,
        socketId: client.socketId,
        syncMethod,
        syncAccountsCount: syncAccounts?.length,
        firstAccountAddress: syncAccounts?.[0]?.accountAddress,
        instanceId,
      },
      devOnlyData(apiResult),
    ];
  }

  @LogToConsole()
  ackNotificationMessage(
    params: INotificationPushMessageAckParams,
    apiResult: any,
    ackBy: 'webSocket' | 'http' | 'unknown',
  ) {
    return [
      {
        msgId: params.msgId,
        action: params.action,
        title: params.remotePushMessageInfo?.title,
        content: params.remotePushMessageInfo?.content,
      },
      ackBy,
      devOnlyData(apiResult),
    ];
  }

  @LogToConsole()
  notificationClosed(params: {
    notificationId: string | undefined;
    title: string | undefined;
    content: string | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  notificationClicked({
    notificationId,
    title,
    content,
    params,
    eventSource,
  }: {
    eventSource: 'coldStartByNotification' | 'notificationClick' | undefined;
    notificationId: string | undefined;
    title: string | undefined;
    content: string | undefined;
    params: INotificationShowParams | undefined;
  }) {
    return [
      eventSource,
      notificationId,
      title,
      content,
      devOnlyData(params),
      devOnlyData(params?.remotePushMessageInfo?.extras?.params),
    ];
  }

  @LogToConsole()
  notificationReceived(params: {
    notificationId: string | undefined;
    title: string | undefined;
    content: string | undefined;
    topic: ENotificationPushTopicTypes | undefined;
    messageInfo: INotificationPushMessageInfo | undefined;
  }) {
    const { notificationId, title, content, topic, messageInfo } = params;
    return [messageInfo?.pushSource, notificationId, title, content, topic];
  }

  @LogToLocal()
  removeNotification(params: {
    platform: string;
    notificationId: string | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  setBadge({ count }: INotificationSetBadgeParams) {
    return [count];
  }

  @LogToLocal()
  clearBadge() {
    return true;
  }

  @LogToLocal()
  requestPermission(params: INotificationPermissionDetail) {
    return [params.permission, params.isSupported];
  }

  @LogToLocal()
  getPermission(params: INotificationPermissionDetail) {
    return [params.permission, params.isSupported];
  }
}
