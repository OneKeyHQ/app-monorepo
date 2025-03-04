import JPush from 'jpush-react-native';

import type { IDemoNotificationSdk } from './types';

JPush.addNotificationListener(() => {});
JPush.addLocalNotificationListener(() => {});

const sdk: IDemoNotificationSdk = {
  init: async () => {},
  showNotification: async () => {},
};
export default sdk;
