import { useEffect, useRef, useState } from 'react';

import { monotoneCubicInterpolation } from '@onekeyfe/react-native-animated-charts';
import { debounce } from 'lodash';

import { MarketApiData } from '../chartService';

export const UniBalanceHeightDifference = 100;

interface Point {
  x: number;
  y: number;
}
interface AnimatedChartData {
  nativePoints: Point[];
  points: Point[];
}
const traverseData = (prev: AnimatedChartData, data: MarketApiData[]) => {
  if (!data || data.length === 0) {
    return prev;
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const points: Point[] = monotoneCubicInterpolation({
    data: filtered,
    includeExtremes: true,
    range: 100,
  });
  return {
    nativePoints: filtered,
    points,
  };
};

export default function useChartThrottledPoints({
  originData,
  fetchingCharts,
}: {
  originData: MarketApiData[];
  fetchingCharts?: boolean;
}) {
  const [throttledPoints, setThrottledPoints] = useState(() => {
    const initPoints = new Array(100)
      .fill(0)
      .map((_, index) => ({ x: index, y: 0 }));
    const initData = {
      nativePoints: initPoints,
      points: initPoints,
    };
    return traverseData(initData, originData);
  });

  useEffect(() => {
    // @ts-ignore
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
