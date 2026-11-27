import type {
  IJPushRemotePushMessageInfo,
  INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';

import { NotificationHandlerContainer } from './NotificationHandlerContainer';

export function ColdStartByNotification() {
  return <NotificationHandlerContainer />;
}

ColdStartByNotification.launchNotification =
  null as IJPushRemotePushMessageInfo | null;

ColdStartByNotification.localLaunchNotification = null as
  | (INotificationPushMessageInfo & { notificationId: string })
  | null;
