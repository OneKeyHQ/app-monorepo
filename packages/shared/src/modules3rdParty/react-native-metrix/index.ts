import {
  getTimeSinceStartup,
  onUpdate,
  start,
  stop,
} from 'react-native-metrix';

import platformEnv from '../../platformEnv';

import {
  clearLogFolder,
  initLogFolder,
  metrixLogger,
  uploadMetricsLogFile,
} from './logger';

import type { metrixUpdateInfo } from 'react-native-metrix';

const PLACEHOLDER = -1;
const measureTime = {
  jsBundleLoadedTime: PLACEHOLDER,
  jsBundleLoadedTimeAt: '',
  fpTime: PLACEHOLDER,
  fpTimeAt: '',
};

if (platformEnv.isDev) {
  global.$$metroHostIP = process.env.METRO_HOST_IP as string;
}

const getTimeAt = () => new Date().toISOString();

export const markJsBundleLoadedTime = () => {
  measureTime.jsBundleLoadedTime = getTimeSinceStartup();
  measureTime.jsBundleLoadedTimeAt = getTimeAt();
};

export const markFPTime = () => {
  measureTime.fpTime = getTimeSinceStartup();
  measureTime.fpTimeAt = getTimeAt();
};

export const subscribeToMetrics = (
  callback: (info: metrixUpdateInfo) => void,
) => onUpdate(callback);

export const getMeasureTime = () => measureTime;

export type { metrixUpdateInfo };

let isLogging = false;
let cancelSubscription: () => void;
export const startLogging = () => {
  if (!isLogging) {
    isLogging = true;
    void initLogFolder();
    cancelSubscription = onUpdate((info) => {
      metrixLogger.info(JSON.stringify(info));
    });
  }
};

export const stopLogging = () => {
  if (isLogging && cancelSubscription) {
    isLogging = false;
    cancelSubscription();
  }
};

export const startRecordingMetrics = () => {
  start();
  startLogging();
};

export const stopRecordingMetrics = () => {
  stop();
  stopLogging();
};

export type IMetrixDeviceInfo = {
  commitHash: string;
  brand: string;
  buildNumber: string;
  deviceId: string;
  model: string;
  systemName: string;
  systemVersion: string;
};

export const uploadMetricsInfo = async (
  unitTestName: string,
  password: string,
  deviceInfo: IMetrixDeviceInfo,
) =>
  uploadMetricsLogFile(
    'https://perf.onekeytest.com/api/logs/upload',
    unitTestName,
    password,
    JSON.stringify({
      ...measureTime,
      ...deviceInfo,
    }),
  );

export { clearLogFolder };
