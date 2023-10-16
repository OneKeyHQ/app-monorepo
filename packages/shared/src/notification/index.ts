import JPush from 'jpush-react-native';

import { getPermissionsAsync } from '@onekeyhq/shared/src/modules3rdParty/expo-notifications';
import type { NotificationPermissionsStatus } from '@onekeyhq/shared/src/modules3rdParty/expo-notifications/types';
import { IosAuthorizationStatus } from '@onekeyhq/shared/src/modules3rdParty/expo-notifications/types';

import { JPUSH_KEY } from '../config/appConfig';
import debugLogger from '../logger/debugLogger';
import platformEnv from '../platformEnv';

let jpushInited = false;
export const hasPermission = (settings: NotificationPermissionsStatus) =>
  settings.granted ||
  settings.ios?.status === IosAuthorizationStatus.PROVISIONAL;

// eslint-disable-next-line @typescript-eslint/require-await
export const checkPushNotificationPermission = async () => {
  const permissions = await getPermissionsAsync();
  return hasPermission(permissions);
};

export const initJpush = () => {
  if (!platformEnv.isNative) {
    return;
  }
  if (jpushInited) {
    return;
  }
  jpushInited = true;
  const config = {
    'appKey': JPUSH_KEY,
    // see: https://github.com/jpush/jpush-react-native/issues/861
    'channel': 'prod',
    'production': true,
  };
  debugLogger.notification.debug(`JPUSH:init`, config);
  // @ts-expect-error
  JPush.init(config);

  if (platformEnv.isNativeAndroid) {
    JPush.requestPermission();
  }
};
