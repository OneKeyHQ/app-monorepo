import { getAndroidId, getIosIdForVendorAsync } from 'expo-application';
import {
  manufacturer,
  modelName,
  osName,
  osVersion,
  supportedCpuArchitectures,
} from 'expo-device';
import { Dimensions } from 'react-native';

import platformEnv from '../platformEnv';

import type { IGetDeviceInfo } from './type';

export const getDeviceInfo: IGetDeviceInfo = async () => ({
  deviceId:
    (platformEnv.isNativeIOS
      ? await getIosIdForVendorAsync()
      : getAndroidId()) ?? '',
  arch: supportedCpuArchitectures ? supportedCpuArchitectures?.join(',') : '',
  manufacturer: manufacturer ?? '',
  model: modelName ?? '',
  os: osName ?? '',
  osVersion: osVersion ?? '',
  screenHeight: Dimensions.get('window').height,
  screenWidth: Dimensions.get('window').width,
});
