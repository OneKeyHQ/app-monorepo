import { useEffect, useRef, useState } from 'react';

import { monotoneCubicInterpolation } from '@onekeyfe/react-native-animated-charts';
import { debounce } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

export const POINT_LIMITS = platformEnv.isNativeIOSPad ? 300 : 100;
const DUMMY_POINTS = 10;

interface IPoint {
  x: number;
  y: number;
}
interface IAnimatedChartData {
  nativePoints: IPoint[];
  points: IPoint[];
}
const traverseData = (prev: IAnimatedChartData, data: IMarketTokenChart) => {
  if (!data || data.length === 0) {
    return prev;
  }
  // some data only has one point like "frapped usdt"
  if (data.length === 1) {
    const dummyData = new Array(DUMMY_POINTS)
      .fill(0)
      .map(() => ({ x: data[0][0], y: data[0][1] }));
    return {
      nativePoints: dummyData,
      points: dummyData,
    };
  }
  const filtered = data
    .filter(([, value]) => value)
    .map(([time, value]) => ({ x: time, y: value }));
  if (
    filtered[0]?.y === prev?.nativePoints[0]?.y &&
    filtered[0]?.x === prev?.nativePoints[0]?.x
  ) {
    return prev;
  }
  return {
    nativePoints: filtered,
    points:
      filtered.length > POINT_LIMITS
        ? monotoneCubicInterpolation({
            data: filtered,
            includeExtremes: true,
            range: POINT_LIMITS,
          })
        : filtered,
  };
};

const initPoints = new Array(DUMMY_POINTS)
  .fill(0)
  .map((_, index) => ({ x: index, y: 0 }));
const initData = {
  nativePoints: initPoints,
  points: initPoints,
};

export default function useChartThrottledPoints({
  originData,
  fetchingCharts,
}: {
  originData: MarketApiData[];
  fetchingCharts?: boolean;
}) {
  const [throttledPoints, setThrottledPoints] = useState(initData);

  useEffect(() => {
    setThrottledPoints((prev) => traverseData(prev, originData));
  }, [originData]);

  const [throttledData, setThrottledData] = useState({
    nativePoints: throttledPoints.nativePoints,
    points: throttledPoints.points,
    smoothingStrategy: 'bezier',
  });

  const debouncedSetThrottledData = useRef(
    debounce(setThrottledData, 30),
  ).current;

  useEffect(() => {
    if (throttledPoints.points && !fetchingCharts) {
      debouncedSetThrottledData({
        nativePoints: throttledPoints.nativePoints,
        points: throttledPoints.points,
        smoothingStrategy: 'bezier',
      });
    }
  }, [throttledPoints, fetchingCharts, debouncedSetThrottledData]);

  return {
    throttledData,
  };
}
