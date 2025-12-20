import type { IJPushRemotePushMessageInfo } from '@onekeyhq/shared/types/notification';

import { NotificationHandlerContainer } from './NotificationHandlerContainer';

export function ColdStartByNotification() {
  return <NotificationHandlerContainer />;
}

ColdStartByNotification.launchNotification =
  null as IJPushRemotePushMessageInfo | null;
