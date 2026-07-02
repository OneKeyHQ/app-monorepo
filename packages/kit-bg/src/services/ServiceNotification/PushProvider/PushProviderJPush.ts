import JPush from 'jpush-react-native';
import { isString } from 'lodash';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import LaunchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';
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

const JPUSH_REGISTER_ID_RETRY_DELAYS_MS = [1000, 3000, 10_000, 30_000];

export class PushProviderJPush extends PushProviderBase {
  private loggedRegisterID = '';

  private connectedRegisterID = '';

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
    defaultLogger.notification.jpush.consoleLog('JPush setLoggerEnable', true);
    void LaunchOptionsManager.registerDeviceToken();
    JPush.init(options);
    defaultLogger.notification.jpush.consoleLog(
      'JPush 极光推送初始化完成',
      options,
    );
    this.addListeners();
    void this.resolveRegisterID({
      source: 'startup',
    });
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

  private getRegistrationID() {
    return new Promise<string>((resolve) => {
      try {
        JPush.getRegistrationID(({ registerID }) => {
          resolve(registerID || '');
        });
      } catch (error) {
        defaultLogger.notification.jpush.consoleError(
          'JPush getRegistrationID Error >>>>> ',
          error,
        );
        resolve('');
      }
    });
  }

  private logRegisterIDToLocal(registerID: string) {
    defaultLogger.notification.jpush.logRegisterRidToLocal(registerID);
  }

  private async resolveRegisterID({
    source,
    shouldEmitConnected = true,
    attempt = 0,
  }: {
    source: string;
    shouldEmitConnected?: boolean;
    attempt?: number;
  }) {
    const registerID = await this.getRegistrationID();
    if (registerID) {
      defaultLogger.notification.jpush.consoleLog(
        'JPush registerID:',
        {
          source,
          attempt,
        },
        registerID,
      );

      if (this.loggedRegisterID !== registerID) {
        this.loggedRegisterID = registerID;
        this.logRegisterIDToLocal(registerID);
      }

      if (shouldEmitConnected && this.connectedRegisterID !== registerID) {
        this.connectedRegisterID = registerID;
        this.eventEmitter.emit(EPushProviderEventNames.jpush_connected, {
          jpushId: registerID,
        });
      }
      return;
    }

    const retryDelay = JPUSH_REGISTER_ID_RETRY_DELAYS_MS[attempt];
    if (retryDelay) {
      setTimeout(() => {
        void this.resolveRegisterID({
          source,
          shouldEmitConnected,
          attempt: attempt + 1,
        });
      }, retryDelay);
    }
  }

  private handleConnect = (result: { connectEnable: boolean }) => {
    defaultLogger.notification.jpush.consoleLog('JPush 连接状态:', result);
    if (result.connectEnable) {
      void this.resolveRegisterID({
        source: 'connect',
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
        } catch (_error) {
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
