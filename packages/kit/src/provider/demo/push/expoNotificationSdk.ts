import {
  AndroidNotificationPriority,
  addNotificationResponseReceivedListener,
  scheduleNotificationAsync,
  setNotificationHandler,
} from 'expo-notifications';

import type { IDemoNotificationSdk } from './types';
import type { NotificationContentInput } from 'expo-notifications';

addNotificationResponseReceivedListener(async (event, ...others) => {
  console.log(
    'EXPO: addNotificationResponseReceivedListener ',
    event,
    ...others,
  );
});

setNotificationHandler({
  handleNotification: async ({ request }) => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: AndroidNotificationPriority.DEFAULT,
  }),
});

const sdk: IDemoNotificationSdk = {
  async init() {
    //
  },
  async showNotification(params) {
    const { title, content, uuid } = params;
    const payload: NotificationContentInput = {
      title,
      body: content,
      data: {
        uuid,
        // ios 的通知横幅点击事件被 jpush 接管了， expo 的 addNotificationResponseReceivedListener 不会触发
        // 所以参数要放到 extras 里,用 JPush.addLocalNotificationListener 接收横幅点击事件
        extras: {
          uuid,
          customName: 'customName',
          customValue: 'customValue',
          customValue2: 'customValue2',
          nest2: {
            hello: {
              world: 'world',
            },
          },
        },
      },
      sound: true,
    };
    console.log('EXPO: scheduleNotificationAsync', payload);
    await scheduleNotificationAsync({
      identifier: uuid,
      content: payload,
      trigger: null,
    });
  },
};

export default sdk;
