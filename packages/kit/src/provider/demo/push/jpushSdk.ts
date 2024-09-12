import JPush from 'jpush-react-native';

import type { IDemoNotificationSdk } from './types';

JPush.addNotificationListener((event, ...others) => {
  console.log('JPUSH: addNotificationListener', event, ...others);
});
JPush.addLocalNotificationListener((event, ...others) => {
  console.log('JPUSH: addLocalNotificationListener', event, ...others);
});

const sdk: IDemoNotificationSdk = {
  init: async () => {
    // await JPush.init();
  },
  showNotification: async (params) => {
    // await JPush.showNotification(params);
  },
};
export default sdk;
