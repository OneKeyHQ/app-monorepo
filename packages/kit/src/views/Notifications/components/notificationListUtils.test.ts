import { ENotificationPushTopicTypes } from '@onekeyhq/shared/types/notification';
import type { INotificationPushMessageListItem } from '@onekeyhq/shared/types/notification';

import {
  ENotificationListTab,
  getNotificationListTopicTypes,
  isNotificationListResponseCurrent,
  markNotificationItemRead,
} from './notificationListUtils';

function buildMessage({
  msgId,
  topicType,
  readed = false,
}: {
  msgId: string;
  topicType: ENotificationPushTopicTypes;
  readed?: boolean;
}): INotificationPushMessageListItem {
  return {
    msgId,
    topicType,
    readed,
    body: {
      title: msgId,
      content: msgId,
    },
    referId: msgId,
    createdAt: '2026-08-12T00:00:00.000Z',
    icon: 'BellOutline',
  };
}

describe('notificationListUtils', () => {
  it('maps each client tab to one server request without inventing a topic', () => {
    expect(getNotificationListTopicTypes(ENotificationListTab.all)).toBe(
      undefined,
    );
    expect(
      getNotificationListTopicTypes(ENotificationListTab.accountActivity),
    ).toEqual([ENotificationPushTopicTypes.accountActivity]);
    expect(
      getNotificationListTopicTypes(ENotificationListTab.alertsAndUpdates),
    ).toEqual([
      ENotificationPushTopicTypes.coinPriceAlert,
      ENotificationPushTopicTypes.system,
    ]);
  });

  it('marks matching cached copies read and rejects stale list responses', () => {
    const notification = buildMessage({
      msgId: 'message',
      topicType: ENotificationPushTopicTypes.system,
    });
    expect(
      markNotificationItemRead([notification], notification.msgId)[0],
    ).toMatchObject({ readed: true });

    const currentRequest = {
      requestId: 2,
      latestRequestId: 2,
      requestMutationVersion: 1,
      currentMutationVersion: 1,
      requestTabId: ENotificationListTab.alertsAndUpdates,
      activeTabId: ENotificationListTab.alertsAndUpdates,
    };
    expect(isNotificationListResponseCurrent(currentRequest)).toBe(true);
    expect(
      isNotificationListResponseCurrent({
        ...currentRequest,
        requestId: 1,
      }),
    ).toBe(false);
    expect(
      isNotificationListResponseCurrent({
        ...currentRequest,
        currentMutationVersion: 2,
      }),
    ).toBe(false);
    expect(
      isNotificationListResponseCurrent({
        ...currentRequest,
        activeTabId: ENotificationListTab.all,
      }),
    ).toBe(false);
  });
});
