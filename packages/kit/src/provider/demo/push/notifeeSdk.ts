import notifee from '@notifee/react-native';

import { ONEKEY_LOGO_ICON_URL } from '@onekeyhq/shared/src/consts';

import type { IDemoNotificationSdk } from './types';
import type { EventType } from '@notifee/react-native';

notifee.onForegroundEvent((event, ...others) => {
  const type: EventType = event.type;
  console.log('notifee.onForegroundEvent >>> ', event, ...others);
});

notifee.onBackgroundEvent(async (event, ...others) => {
  console.log('notifee.onBackgroundEvent >>> ', event, ...others);
});

const sdk: IDemoNotificationSdk = {
  async init() {
    //
  },
  async showNotification(params) {
    const { title, content, uuid } = params;
    console.log('notifee.displayNotification >>> ', params);
    await notifee.displayNotification({
      id: uuid,
      title,
      subtitle: `${title} -- `,
      body: content,
      data: {
        messageID: uuid,
        title,
        content,
        // ios 的通知横幅点击事件被 jpush 接管了，notifee 的 onForegroundEvent 和 onBackgroundEvent 都不会触发
        // 所以参数要放到 extras 里,用 JPush.addLocalNotificationListener 接收横幅点击事件
        extras: {
          uuid,
          customName: 'customName',
          customValue: 'customValue',
          customValue2: 'customValue2',
        },
        // notificationEventType // readOnly
      },
      android: {
        channelId: 'default',
        // 设置自定义图片（Android） 待定
        largeIcon: ONEKEY_LOGO_ICON_URL, // 可以是网络图片 URL 或本地图片路径
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        // 设置自定义图片（iOS） working
        attachments: [
          {
            url: ONEKEY_LOGO_ICON_URL, // 可以是网络图片 URL 或本地图片路径
          },
        ],
      },
    });
  },
};

export default sdk;
