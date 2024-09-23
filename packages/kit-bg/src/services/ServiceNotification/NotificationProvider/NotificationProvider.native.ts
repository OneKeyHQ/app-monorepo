import { PermissionStatus } from 'expo-modules-core';
import {
  AndroidNotificationPriority,
  DEFAULT_ACTION_IDENTIFIER,
  IosAuthorizationStatus,
  addNotificationResponseReceivedListener,
  cancelScheduledNotificationAsync,
  dismissNotificationAsync,
  getPermissionsAsync,
  getPresentedNotificationsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationHandler,
} from 'expo-notifications';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { setBadgeCountAsync } from '@onekeyhq/shared/src/modules3rdParty/expo-notifications';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IJPushNotificationLocalEvent,
  INativeNotificationCenterMessageInfo,
  INotificationPermissionDetail,
  INotificationPushMessageExtras,
  INotificationRemoveParams,
  INotificationSetBadgeParams,
  INotificationShowParams,
  INotificationShowResult,
} from '@onekeyhq/shared/types/notification';
import {
  ENotificationPermission,
  EPushProviderEventNames,
} from '@onekeyhq/shared/types/notification';

import { PushProviderJPush } from '../PushProvider/PushProviderJPush';

import NotificationProviderBase from './NotificationProviderBase';

import type { INotificationProviderBaseOptions } from './NotificationProviderBase';
import type {
  NotificationContentInput,
  NotificationPermissionsStatus,
} from 'expo-notifications';

export default class NotificationProvider extends NotificationProviderBase {
  constructor(options: INotificationProviderBaseOptions) {
    super(options);
    void this.configureNotifications();
    this.initWebSocketProvider();
    this.initJPushProvider();
  }

  jpushProvider: PushProviderJPush | undefined;

  initJPushProvider() {
    if (this.options.disabledJPush) {
      return;
    }
    this.jpushProvider = new PushProviderJPush({
      eventEmitter: this.eventEmitter,
      instanceId: this.options.instanceId,
    });
  }

  private async configureNotifications() {
    // add notification close event

    // const sub3 = addNotificationsDroppedListener(() => {
    //   console.log('Notifications dropped');
    // });

    // iOS: not working when jpush enabled, use JPush.addLocalNotificationListener instead
    // Android: working
    const sub1 = addNotificationResponseReceivedListener(async (event) => {
      const data = event?.notification?.request?.content?.data as
        | IJPushNotificationLocalEvent
        | undefined;
      defaultLogger.notification.common.consoleLog(
        'native addNotificationResponseReceivedListener',
        event.actionIdentifier, // TODO notification_closed
        data?.extras,
      );
      if (data && event.actionIdentifier === DEFAULT_ACTION_IDENTIFIER) {
        const notificationId =
          data?.extras?.params?.msgId ||
          data?.extras?.msgId ||
          data?.messageID ||
          event.notification.request.identifier;
        const showParams: INotificationShowParams = {
          notificationId,
          icon: data.extras?.image,
          title: data.title,
          description: data.content,
          time: Date.now(),

          remotePushMessageInfo: data,
        };
        this.eventEmitter.emit(EPushProviderEventNames.notification_clicked, {
          notificationId,
          params: showParams,
          eventSource: 'notificationClick',
        });
        await this.removeNotification({
          notificationId,
        });
      }
    });
    const sub2 = setNotificationHandler({
      handleNotification: async ({ request }) => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: AndroidNotificationPriority.DEFAULT,
      }),
    });

    // Notifications.removeNotificationSubscription(sub1);
    // Notifications.removeNotificationSubscription(sub2);

    // not working
    // const col dStartNotification: NotificationResponse | null =
    //   await getLastNotificationResponseAsync();
    // console.log('coldStartNotification', coldStartNotification);
    // if (coldStartNotification) {
    //   const data = coldStartNotification?.notification?.request?.content
    //     ?.data as INotificationShowParams;
    //   this.eventEmitter.emit(EPushProviderEventNames.notification_clicked, {
    //     notificationId: coldStartNotification.actionIdentifier,
    //     params: data,
    //   });
    // }
  }

  convertExpoPermissionStatus({
    status,
  }: {
    status: NotificationPermissionsStatus;
  }): INotificationPermissionDetail {
    let permission: ENotificationPermission = ENotificationPermission.default;

    if (
      status.status === PermissionStatus.GRANTED ||
      status.granted ||
      status.ios?.status === IosAuthorizationStatus.PROVISIONAL
    ) {
      permission = ENotificationPermission.granted;
    } else if (status.status === PermissionStatus.DENIED) {
      permission = ENotificationPermission.denied;
    }

    return {
      isSupported: true,
      permission,
    };
  }

  override async getPermission(): Promise<INotificationPermissionDetail> {
    const status: NotificationPermissionsStatus = await getPermissionsAsync();
    return this.convertExpoPermissionStatus({ status });
  }

  override async requestPermission(): Promise<INotificationPermissionDetail> {
    const status: NotificationPermissionsStatus =
      await requestPermissionsAsync();
    return this.convertExpoPermissionStatus({ status });
  }

  override async openPermissionSettings() {
    try {
      openUrlUtils.openSettings('notification');
    } catch (error) {
      console.error('无法打开设置:', error);
    }
  }

  override async showNotification(
    params: INotificationShowParams,
  ): Promise<INotificationShowResult> {
    this.fixShowParams(params);
    const { icon, notificationId, title, description } = params;
    const uuid = notificationId || generateUUID();
    const data: IJPushNotificationLocalEvent = {
      messageID: uuid,
      title,
      content: description,
      extras: params?.remotePushMessageInfo?.extras,
    };
    const content: NotificationContentInput = {
      title,
      body: description,
      data,
      sound: true,
      // attachments: icon
      //   ? [
      //       {
      //         identifier: generateUUID(),
      //         url: icon,
      //         type: 'image/png',
      //       },
      //     ]
      //   : [],
      // icon, // icon is not supported on native
    };

    console.log('showNotification native scheduleNotificationAsync', content);
    // JPush.addLocalNotification
    await scheduleNotificationAsync({
      identifier: uuid,
      content,
      trigger: null,
    });

    // 5秒后移除expo通知
    // setTimeout(async () => {
    //   await cancelScheduledNotificationAsync(uuid);
    // }, 5000);

    return { notificationId: uuid };
  }

  override async removeNotification(
    params: INotificationRemoveParams,
  ): Promise<void> {
    const { notificationId } = params;
    if (notificationId) {
      try {
        await cancelScheduledNotificationAsync(notificationId);
      } catch (error) {
        // ignore
      }
      try {
        await dismissNotificationAsync(notificationId);
      } catch (error) {
        // ignore
      }
      defaultLogger.notification.common.removeNotification({
        platform: 'native',
        notificationId,
      });
    }
  }

  override async setBadge(params: INotificationSetBadgeParams) {
    const { count } = params;
    const countNum = count ?? 0;

    // not working on Android
    await setBadgeCountAsync(countNum);

    if (platformEnv.isNativeAndroid) {
      // not working on Android
      this.jpushProvider?.setBadge({ badge: countNum, appBadge: countNum });
    }
  }

  override async showAndFocusApp(): Promise<void> {
    //
  }

  override async clearNotificationCache(): Promise<void> {
    console.log('Native -- clearNotificationCache');
  }

  override async getNativeNotifications(): Promise<
    INativeNotificationCenterMessageInfo[]
  > {
    const notifications = await getPresentedNotificationsAsync();
    return notifications.map((n) => {
      const extras = // @ts-ignore
        n?.request?.trigger?.payload as INotificationPushMessageExtras;

      return {
        notificationId:
          extras?.params?.msgId ||
          extras?.msgId ||
          n?.request?.identifier ||
          '',
        title: n.request.content?.title || '',
        content: n.request.content?.body || '',
      };
    });
  }
}
