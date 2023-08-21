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
