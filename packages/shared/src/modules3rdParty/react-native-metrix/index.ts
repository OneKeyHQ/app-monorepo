import { getBatteryLevelAsync } from 'expo-battery';
import {
  getTimeSinceStartup,
  onUpdate,
  start,
  stop,
} from 'react-native-metrix';

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

export const startRecordingMetrics = () => {
  start();
};

export const stopRecordingMetrics = () => {
  stop();
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

const isLogging = false;
export const startLogging = () => {
  if (isLogging) {
    // return;
  }
};

export const stopLogging = () => {
  if (!isLogging) {
    // return;
  }
};

export const getLogFile = () => {};
