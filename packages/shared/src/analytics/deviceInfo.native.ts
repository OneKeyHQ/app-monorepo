import { getAndroidId, getIosIdForVendorAsync } from 'expo-application';
import {
  manufacturer,
  modelName,
  osName,
  osVersion,
  supportedCpuArchitectures,
} from 'expo-device';
import { getCalendars } from 'expo-localization';
import { Dimensions } from 'react-native';

import platformEnv from '../platformEnv';
import {
  getDeviceTimeZone,
  getDeviceUtcOffsetMinutes,
} from '../utils/timeZoneUtils';

import type { IGetDeviceInfo } from './type';

export const getDeviceInfo: IGetDeviceInfo = async () => {
  const deviceTimeZone = getCalendars()?.[0]?.timeZone;

  return {
    deviceId:
      (platformEnv.isNativeIOS
        ? await getIosIdForVendorAsync()
        : getAndroidId()) ?? '',
    deviceTimeZone: getDeviceTimeZone(deviceTimeZone),
    deviceUtcOffsetMinutes: getDeviceUtcOffsetMinutes(),
    arch: supportedCpuArchitectures ? supportedCpuArchitectures?.join(',') : '',
    manufacturer: manufacturer ?? '',
    model: modelName ?? '',
    os: osName ?? '',
    osVersion: osVersion ?? '',
    screenHeight: Dimensions.get('window').height,
    screenWidth: Dimensions.get('window').width,
  };
};
