import type { IEndpointInfo } from './endpoint';
import type { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';
import type { Socket } from 'socket.io-client';

export enum ENotificationPermission {
  default = 'default', // unknown, ask
  granted = 'granted',
  denied = 'denied',
}

export type INotificationShowResult = {
  notificationId: string | undefined;
  desktopNotification?: Notification;
};
export type INotificationShowParams = {
  // swapTxid?: string;
  notificationId?: string;
  icon?: string; // base64 or remote url
  title: string;
  description: string;
  time?: number;

  remotePushMessageInfo?: INotificationPushMessageInfo;

  showByElectronMainProcess?: boolean;
  showByExtUiNotification?: boolean;
};
export type INotificationRemoveParams = {
  notificationId?: string;
  desktopNotification?: Notification;
};
export type INotificationPermissionDetail = {
  permission: ENotificationPermission;
  isSupported: boolean;
};
export type INotificationSetBadgeParams = {
  // null: clear badge
  // undefined: dot badge
  // number: number badge
  count: number | undefined | null;
};

export enum EPushProviderEventNames {
  // socket.io internal events
  // error = 'error',
  // disconnect = 'disconnect',
  // reconnect = 'reconnect',
  // connect = 'connect',
  // connect_error = 'connect_error',
  // notification = 'notification',

  ws_connected = 'ws_connected',
  jpush_connected = 'jpush_connected',

  notification_received = 'notification_received',
  notification_clicked = 'notification_clicked',
  notification_closed = 'notification_closed',
}

export type INotificationClickParams = {
  notificationId: string | undefined;
  params: INotificationShowParams | undefined;
  eventSource?: 'coldStartByNotification' | 'notificationClick';
  webEvent?: Event;
};

export interface IPushProviderEventPayload {
  [EPushProviderEventNames.ws_connected]: {
    socketId: string | undefined;
    socket: Socket | null;
  };
  [EPushProviderEventNames.jpush_connected]: {
    jpushId: string;
  };
  [EPushProviderEventNames.notification_received]: INotificationPushMessageInfo;
  [EPushProviderEventNames.notification_clicked]: INotificationClickParams;
  [EPushProviderEventNames.notification_closed]: {
    notificationId: string | undefined;
    params: INotificationShowParams | undefined;
    webEvent?: Event;
  };
}

export type INotificationProviderInitParams = {
  eventEmitter: CrossEventEmitter;
  websocketEndpointInfo: IEndpointInfo;
  jpushEndpointInfo: IEndpointInfo;
  instanceId: string;
};

export type INotificationPushClient = {
  instanceId?: string;
  jpushId?: string; // jpush registration id
  socketId?: string; // socket.io id
  apnsId?: string; // apple push notification service id
  wnsId?: string; // windows push notification service id
  webPushId?: string; // web push notification service id
};
export type INotificationPushSyncAccount = {
  networkId: string | undefined;
  networkImpl: string | undefined;
  accountAddress: string;
  accountId: string;
  accountName: string | undefined;
};
export enum ENotificationPushSyncMethod {
  override = 'override',
  append = 'append',
  replace = 'replace',
}
export enum ENotificationPushTopicTypes {
  accountActivity = 'accountActivity',
  coinPriceAlert = 'coinPriceAlert',
}
// /notification/v1/account/register
// /notification/v1/account/unregister
export type INotificationPushRegisterParams = {
  client: INotificationPushClient;
  syncMethod: ENotificationPushSyncMethod;
  syncAccounts: INotificationPushSyncAccount[];
};
// /notification/v1/config/update
// /notification/v1/config/query
export type INotificationPushSettings = {
  pushEnabled?: boolean;
  accountActivityPushEnabled?: boolean;
  // announcementEnabled?: boolean;
  // coinPriceAlertEnabled?: boolean;
  // coinVolatilityAlertEnabled?: boolean;
  // presetCoinsVolatilityAlertEnabled?: boolean;
};
export type INotificationPushTopic =
  | {
      once?: boolean;
      type: ENotificationPushTopicTypes.accountActivity;
      payload: {
        networkId: string;
        accountAddress: string;
      };
    }
  | {
      once?: boolean;
      type: ENotificationPushTopicTypes.coinPriceAlert;
      payload: {
        coinId: string;
      };
    };

// /notification/v1/account/subscribe
export type INotificationPushSubscribeParams = {
  topics: INotificationPushTopic[];
};
// /notification/v1/account/unsubscribe
export type INotificationPushUnSubscribeParams = {
  topicIds: string[]; // topicIds
};
// /notification/v1/account/subscribed-list
export type INotificationPushSubscribedListParams = {
  topicTypes: ENotificationPushTopicTypes[];
};
// /notification/v1/message/list
export type INotificationPushMessageListParams = {
  topicTypes: ENotificationPushTopicTypes[];
};

// export enum ENotificationAckAction {
//   sent = 'sent',
//   arrived = 'arrived',
//   clicked = 'clicked',
//   show = 'show',
//   withdraw = 'withdraw',
// }
export enum ENotificationPushMessageAckAction {
  // clicked, show, arrived
  arrived = 'arrived',
  show = 'show',
  clicked = 'clicked',
  readed = 'readed',
}
// /notification/v1/message/ack
export type INotificationPushMessageAckParams = {
  remotePushMessageInfo?: INotificationPushMessageInfo;
  msgId: string | undefined;
  action: ENotificationPushMessageAckAction;
};
export type INotificationPushMessageExtras = {
  badge?: string;
  msgId: string; // TODO obsoleted, use params.msgId instead
  topic: ENotificationPushTopicTypes.accountActivity;
  image?: string;
  // params is a json string on Android
  params: {
    msgId: string; // msgId
    accountAddress: string;
    accountId: string;
    networkId: string;
    transactionHash: string;
  };
};
export type IJPushRemotePushMessageInfo = INotificationPushMessageExtras & {
  _j_msgid: number;
  aps?: {
    badge?: number;
    alert?: {
      body?: string;
      title?: string;
    };
  };
};
export type IJPushNotificationRemoteEvent = {
  title: string;
  content: string;
  extras: INotificationPushMessageExtras | undefined;
  //
  badge: string;
  ring: string;
  messageID: string;
  notificationEventType?: 'notificationArrived' | 'notificationOpened';
};
export type IJPushNotificationLocalEvent = {
  title: string;
  content: string;
  extras: INotificationPushMessageExtras | undefined;
  //
  messageID: string;
  notificationEventType?: 'notificationArrived' | 'notificationOpened';
};
export type INotificationPushMessageInfo = {
  title: string;
  content: string;
  extras?: INotificationPushMessageExtras;
  //
  badge?: string;
  pushSource?: 'jpush' | 'websocket' | undefined;
};
export type INativeNotificationCenterMessageInfo = {
  notificationId: string;
  title: string;
  content: string;
};
export type INotificationPushMessageListItem = {
  msgId: string;
  topicType: string;
  body: INotificationPushMessageInfo;
  referId: string;
  readed: boolean | undefined;
  createdAt: string;
};
