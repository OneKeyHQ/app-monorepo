import {
  ENotificationPushTopicTypes,
  type INotificationPushMessageListItem,
} from '@onekeyhq/shared/types/notification';

export const ENotificationListTab = {
  all: 'all',
  accountActivity: 'accountActivity',
  alertsAndUpdates: 'alertsAndUpdates',
} as const;

export type INotificationListTab =
  (typeof ENotificationListTab)[keyof typeof ENotificationListTab];

export function getNotificationListTopicTypes(
  tabId: INotificationListTab,
): ENotificationPushTopicTypes[] | undefined {
  if (tabId === ENotificationListTab.all) {
    return undefined;
  }
  if (tabId === ENotificationListTab.accountActivity) {
    return [ENotificationPushTopicTypes.accountActivity];
  }
  return [
    ENotificationPushTopicTypes.coinPriceAlert,
    ENotificationPushTopicTypes.system,
  ];
}

export function applyNotificationReadState(
  notifications: INotificationPushMessageListItem[],
  readedMap: Record<string, boolean>,
) {
  return notifications.map((item) =>
    item.readed || !readedMap[item.msgId] ? item : { ...item, readed: true },
  );
}

export function markNotificationItemsRead(
  notifications: INotificationPushMessageListItem[],
) {
  return notifications.map((item) =>
    item.readed ? item : { ...item, readed: true },
  );
}

export function markNotificationItemRead(
  notifications: INotificationPushMessageListItem[],
  msgId: string,
) {
  return notifications.map((item) =>
    item.msgId === msgId && !item.readed ? { ...item, readed: true } : item,
  );
}

export function isNotificationListResponseCurrent({
  requestId,
  latestRequestId,
  requestMutationVersion,
  currentMutationVersion,
  requestTabId,
  activeTabId,
}: {
  requestId: number;
  latestRequestId: number;
  requestMutationVersion: number;
  currentMutationVersion: number;
  requestTabId: INotificationListTab;
  activeTabId: INotificationListTab;
}) {
  return (
    requestId === latestRequestId &&
    requestMutationVersion === currentMutationVersion &&
    requestTabId === activeTabId
  );
}
