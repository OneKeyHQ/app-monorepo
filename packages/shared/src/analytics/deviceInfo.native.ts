import { Dimensions } from 'react-native';
import {
  getInstanceId,
  getManufacturer,
  getModel,
  getSystemName,
  getSystemVersion,
  getUniqueId,
  supportedAbis,
} from 'react-native-device-info';

import platformEnv from '../platformEnv';

import type { IGetDeviceInfo } from './type';

export const getDeviceInfo: IGetDeviceInfo = async () => ({
  deviceId:
    platformEnv.isNativeAndroidHuawei || platformEnv.isNativeAndroidGooglePlay
      ? await getUniqueId()
      : await getInstanceId(),
  arch: (await supportedAbis()).join(','),
  manufacturer: await getManufacturer(),
  model: getModel(),
  os: getSystemName(),
  osVersion: getSystemVersion(),
  screenHeight: Dimensions.get('window').height,
  screenWidth: Dimensions.get('window').width,
});
