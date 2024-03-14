import {
  getBuildNumber,
  getDeviceId,
  getIncrementalSync,
  getModel,
  getSystemName,
  getSystemVersion,
  getTotalMemorySync,
  getUsedMemorySync,
} from 'react-native-device-info';

export const getDeviceInfo = () =>
  [
    `Device: ${getModel()} ${getDeviceId()}`,
    `System: ${getSystemName()} ${getSystemVersion()}`,
    `Version Hash: ${process.env.COMMITHASH || ''}`,
    `Build Number: ${getBuildNumber()} ${getIncrementalSync()}`,
    `Memory: ${getUsedMemorySync()}/${getTotalMemorySync()}`,
  ].join(',');
