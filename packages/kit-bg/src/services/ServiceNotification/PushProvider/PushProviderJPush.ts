import JPush from 'jpush-react-native';
import { isString } from 'lodash';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IJPushNotificationLocalEvent,
  IJPushNotificationRemoteEvent,
  INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';
import { EPushProviderEventNames } from '@onekeyhq/shared/types/notification';

import { PushProviderBase } from './PushProviderBase';

import type { IPushProviderBaseProps } from './PushProviderBase';

// notifee
// expo-notifications
// jpush

export class PushProviderJPush extends PushProviderBase {
  constructor(props: IPushProviderBaseProps) {
    super(props);
    this.initJPush();
  }

  private initJPush() {
    const options = {
      appKey: process.env.JPUSH_KEY || '',
      titchannelle: process.env.JPUSH_CHANNEL || 'prod',
      channel: process.env.JPUSH_CHANNEL || 'prod',
      production: true,
    };
    if (process.env.NODE_ENV !== 'production') {
      JPush.setLoggerEnable(true);
      defaultLogger.notification.jpush.consoleLog(
        'JPush setLoggerEnable',
        true,
      );
    }
    JPush.init(options);
    defaultLogger.notification.jpush.consoleLog(
      'JPush 极光推送初始化完成',
      options,
    );
    this.addListeners();
  }

  private addListeners() {
    JPush.addConnectEventListener(this.handleConnect);
    JPush.addNotificationListener(this.handleNotification as any);
    JPush.addLocalNotificationListener(this.handleLocalNotification as any);

    try {
      JPush.addTagAliasListener((payload) => {
        defaultLogger.notification.jpush.consoleLog('JPush 收到别名:', payload);
      });
      JPush.addMobileNumberListener((payload) => {
        defaultLogger.notification.jpush.consoleLog(
          'JPush 收到手机号:',
          payload,
        );
      });
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      JPush.addCustomMessageListener((payload: any) => {
        defaultLogger.notification.jpush.consoleLog(
          'JPush 收到自定义消息:',
          payload,
        );
      });
    } catch (error) {
      defaultLogger.notification.jpush.consoleError(
        'JPush AddListeners Error >>>>> ',
        error,
      );
    }
  }

  private removeListeners() {
    JPush.removeListener(this.handleConnect);
    JPush.removeListener(this.handleNotification);
    JPush.removeListener(this.handleLocalNotification);
  }

  private handleConnect = (result: { connectEnable: boolean }) => {
    defaultLogger.notification.jpush.consoleLog('JPush 连接状态:', result);
    if (result.connectEnable) {
      JPush.getRegistrationID(async ({ registerID }) => {
        defaultLogger.notification.jpush.consoleLog(
          'JPush registerID:',
          result,
          registerID,
        );
        this.eventEmitter.emit(EPushProviderEventNames.jpush_connected, {
          jpushId: registerID,
        });
      });
    }
  };

  baseHandleNotification({
    notification,
    ignoreNotificationArrived,
  }: {
    notification: IJPushNotificationRemoteEvent | IJPushNotificationLocalEvent;
    ignoreNotificationArrived?: boolean;
  }) {
    const { notificationEventType } = notification;
    let extraParams = notification?.extras?.params;
    if (notification?.extras && extraParams) {
      if (isString(extraParams) && platformEnv.isNativeAndroid) {
        try {
          extraParams = JSON.parse(extraParams);
          if (notification.extras) {
            notification.extras.params = extraParams as any;
          }
        } catch (error) {
          //
        }
      }
    }
    const msgId =
      extraParams?.msgId ||
      notification?.extras?.msgId ||
      notification.messageID;
    const payload: INotificationPushMessageInfo = {
      pushSource: 'jpush',
      title: notification.title,
      content: notification.content,
      badge:
        (notification as IJPushNotificationRemoteEvent)?.badge ??
        notification.extras?.badge,
      extras: {
        ...notification?.extras,
        msgId,
        image: notification?.extras?.image,
        params: extraParams,
      } as any,
    };

    if (
      notificationEventType === 'notificationArrived' &&
      !ignoreNotificationArrived
    ) {
      // jpush show notification automatically, so we don't need to show it again
      this.eventEmitter.emit(
        EPushProviderEventNames.notification_received,
        payload,
      );
    }

    if (notificationEventType === 'notificationOpened') {
      this.eventEmitter.emit(EPushProviderEventNames.notification_clicked, {
        notificationId: msgId,
        params: {
          notificationId: msgId,
          title: payload.title,
          description: payload.content,
          icon: notification?.extras?.image,
          remotePushMessageInfo: payload,
        },
      });
    }
  }

  private handleNotification = (
    notification: IJPushNotificationRemoteEvent,
  ) => {
    defaultLogger.notification.jpush.consoleLog(
      'JPush 收到远程推送:',
      notification,
    );
    this.baseHandleNotification({ notification });
  };

  private handleLocalNotification = (
    notification: IJPushNotificationLocalEvent,
  ) => {
    defaultLogger.notification.jpush.consoleLog(
      'JPush 收到本地推送:',
      notification,
    );
    this.baseHandleNotification({
      notification,
      ignoreNotificationArrived: true, // websocket will handle received notification
    });
  };

  setBadge(params: { badge: number; appBadge: number }) {
    // import { getBadgeCountAsync } from 'expo-notifications';
    JPush.setBadge(params);
    defaultLogger.notification.jpush.consoleLog('JPush setBadge', params);
  }
}
