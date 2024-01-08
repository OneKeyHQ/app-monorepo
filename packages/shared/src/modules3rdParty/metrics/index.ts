// TODO: removed in React Native 0.73.x via Performance API.

import { useCallback, useState } from 'react';

import { getTimeSinceStartup, onUpdate } from './metrics';

import type { IMetricsUpdateInfo } from './type';

const PLACEHOLDER = -1;
const measureTime = {
  jsBundleLoadedTime: PLACEHOLDER,
  jsBundleLoadedTimeAt: PLACEHOLDER,
  fpTime: PLACEHOLDER,
  fpTimeAt: PLACEHOLDER,
};

const getTimeAt = () => Date.now();

export const markJsBundleLoadedTime = () => {
  measureTime.jsBundleLoadedTime = getTimeSinceStartup();
  measureTime.jsBundleLoadedTimeAt = getTimeAt();
};

export const markFPTime = () => {
  measureTime.fpTime = getTimeSinceStartup();
  measureTime.fpTimeAt = getTimeAt();
};

export const subscribeToMetrics = (
  callback: (info: IMetricsUpdateInfo) => void,
) => onUpdate(callback);

export const useMeasureTime = () => {
  const [info, setInfo] = useState({} as typeof measureTime);
  const fetchMeasure = useCallback(
    () =>
      setTimeout(() => {
        if (
          measureTime.fpTime === PLACEHOLDER ||
          measureTime.jsBundleLoadedTime === PLACEHOLDER
        ) {
          fetchMeasure();
        } else {
          setInfo(measureTime);
        }
      }, 10),
    [],
  );
  setTimeout(() => {
    fetchMeasure();
  });

  return info;
};
