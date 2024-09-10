import { PermissionStatus } from 'expo-modules-core';
import {
  AndroidNotificationPriority,
  IosAuthorizationStatus,
  addNotificationResponseReceivedListener,
  cancelScheduledNotificationAsync,
  dismissNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationHandler,
} from 'expo-notifications';

import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { setBadgeCountAsync } from '@onekeyhq/shared/src/modules3rdParty/expo-notifications';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
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

import { PushProviderJPush } from '../PushProvider/PushProviderJPush';

import NotificationProviderBase from './NotificationProviderBase';

import type {
  NotificationContentInput,
  NotificationPermissionsStatus,
} from 'expo-notifications';

export default class NotificationProvider extends NotificationProviderBase {
  constructor() {
    super();
    void this.configureNotifications();
    this.initWebSocketProvider();
    this.initJPushProvider();
  }

  jpushProvider: PushProviderJPush | undefined;

  initJPushProvider() {
    this.jpushProvider = new PushProviderJPush({
      eventEmitter: this.eventEmitter,
    });
  }

  private async configureNotifications() {
    // add notification close event

    // const sub3 = addNotificationsDroppedListener(() => {
    //   console.log('Notifications dropped');
    // });

    const sub1 = addNotificationResponseReceivedListener(async (event) => {
      defaultLogger.notification.common.consoleLog(
        'native addNotificationResponseReceivedListener',
        event.actionIdentifier, // TODO notification_closed
      );
      const data = event?.notification?.request?.content
        ?.data as INotificationShowParams;
      if (data) {
        const notificationId =
          data.notificationId || event.notification.request.identifier;
        this.eventEmitter.emit(EPushProviderEventNames.notification_clicked, {
          notificationId,
          params: data,
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
    // const codeStartNotification: NotificationResponse | null =
    //   await getLastNotificationResponseAsync();
    // console.log('codeStartNotification', codeStartNotification);
    // if (codeStartNotification) {
    //   const data = codeStartNotification?.notification?.request?.content
    //     ?.data as INotificationShowParams;
    //   this.eventEmitter.emit(EPushProviderEventNames.notification_clicked, {
    //     notificationId: codeStartNotification.actionIdentifier,
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
    const content: NotificationContentInput = {
      title,
      body: description,
      data: params,
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
}
