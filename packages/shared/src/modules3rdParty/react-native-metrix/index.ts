import { getBatteryLevelAsync } from 'expo-battery';
import {
  getTimeSinceStartup,
  onUpdate,
  start,
  stop,
} from 'react-native-metrix';

import { initLogFolder, metrixLogger, resetLogFolder, uploadMetricsLogFile } from './logger';

import type { metrixUpdateInfo } from 'react-native-metrix';

const PLACEHOLDER = -1;
const measureTime = {
  jsBundleLoadedTime: PLACEHOLDER,
  fpTime: PLACEHOLDER,
  batteryUsed: 0,
};

export const markJsBundleLoadedTime = () => {
  measureTime.jsBundleLoadedTime = getTimeSinceStartup();
};

export const markFPTime = () => {
  measureTime.fpTime = getTimeSinceStartup();
};

export const subscribeToMetrics = (
  callback: (info: metrixUpdateInfo) => void,
) => onUpdate(callback);

export const getMeasureTime = () => measureTime;

export type { metrixUpdateInfo };

let initialBatteryLevel = PLACEHOLDER;
export const markBatteryLevel = async () => {
  const batteryLevel = await getBatteryLevelAsync();
  initialBatteryLevel = batteryLevel;
};

export const getUsedBatterySinceStartup = async () => {
  const batteryLevel = await getBatteryLevelAsync();
  return initialBatteryLevel - batteryLevel;
};

let isLogging = false;
let cancelSubscription: () => void;
export const startLogging = () => {
  if (!isLogging) {
    isLogging = true;
    initLogFolder();
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

export const getLogFile = () => {};

export const startRecordingMetrics = () => {
  start();
  startLogging();
};

export const stopRecordingMetrics = () => {
  stop();
  stopLogging();
};

export const uploadMetricsInfo = async (
  unitTestName: string,
  password: string,
) => {
  await resetLogFolder();
  return uploadMetricsLogFile(
    'http://127.0.0.1:7001/api/logs/upload',
    unitTestName,
    password,
    JSON.stringify(measureTime),
  );
};
