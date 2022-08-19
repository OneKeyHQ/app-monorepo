import {
  IosAuthorizationStatus,
  NotificationPermissionsStatus,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications';
import JPush from 'jpush-react-native';
import { NativeModules } from 'react-native';

import { JPUSH_KEY } from '@onekeyhq/kit/src/config';

import debugLogger from '../logger/debugLogger';
import platformEnv from '../platformEnv';

let jpushInited = false;

const hasPermission = (settings: NotificationPermissionsStatus) =>
  settings.granted ||
  settings.ios?.status === IosAuthorizationStatus.PROVISIONAL;

export const checkPushNotificationPermission = async () => {
  const permissions = await getPermissionsAsync();
  return hasPermission(permissions);
};

export const initJpush = async () => {
  if (jpushInited) {
    return;
  }
  jpushInited = true;
  await requestPermissionsAsync();
  const config = {
    'appKey': JPUSH_KEY,
    // see: https://github.com/jpush/jpush-react-native/issues/861
    'channel': 'prod',
    'production': true,
  };
  debugLogger.common.debug(`JPUSH:init`, config);
  // @ts-expect-error
  JPush.init(config);
  if (platformEnv.isNativeIOS) {
    // eslint-disable-next-line
    NativeModules.JPushManager.registerNotification();
  }
};
