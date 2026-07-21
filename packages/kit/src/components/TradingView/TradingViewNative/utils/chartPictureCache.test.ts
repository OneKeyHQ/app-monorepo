import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { getTradingViewNativePicturePointsSnapshot } from './chartPictureCache';

function buildPoint(index: number): IMarketTokenKLineDataPoint {
  return {
    c: 100 + index,
    h: 101 + index,
    l: 99 + index,
    o: 100 + index,
    t: index * 60,
    v: 100 + index,
  };
}

describe('TradingViewNative picture cache', () => {
  it('keeps the historical picture inputs stable for current-candle updates', () => {
    const points = Array.from({ length: 10_000 }, (_, index) =>
      buildPoint(index),
    );
    const initial = getTradingViewNativePicturePointsSnapshot({
      chartPictureVersion: 0,
      points,
    });
    const latestPoint = points[points.length - 1];
    const updatedPoints = [
      ...points.slice(0, -1),
      {
        ...latestPoint,
        c: latestPoint.c + 0.5,
        h: latestPoint.h + 0.5,
        v: latestPoint.v + 0.5,
      },
    ];
    const updated = getTradingViewNativePicturePointsSnapshot({
      chartPictureVersion: 0,
      points: updatedPoints,
      previous: initial,
    });

    expect(updated).toBe(initial);
    expect(updated.basePoints).toBe(initial.basePoints);
    expect(updated.historicalPoints).toBe(initial.historicalPoints);
  });

  it('rebuilds cached history when a candle is appended or backfilled', () => {
    const points = [buildPoint(0), buildPoint(1), buildPoint(2)];
    const initial = getTradingViewNativePicturePointsSnapshot({
      chartPictureVersion: 0,
      points,
    });
    const appended = getTradingViewNativePicturePointsSnapshot({
      chartPictureVersion: 1,
      points: [...points, buildPoint(3)],
      previous: initial,
    });
    expect(appended.basePoints).not.toBe(initial.basePoints);
    expect(appended.historicalPoints).toEqual(points);

    const backfilledPoints = [
      { ...points[0], c: points[0].c + 1 },
      points[1],
      points[2],
    ];
    const backfilled = getTradingViewNativePicturePointsSnapshot({
      chartPictureVersion: 1,
      points: backfilledPoints,
      previous: initial,
    });
    expect(backfilled.basePoints).not.toBe(initial.basePoints);
  });

  it('rebuilds the base domain only when the latest candle exceeds headroom', () => {
    const points = [buildPoint(0), buildPoint(1), buildPoint(2)];
    const initial = getTradingViewNativePicturePointsSnapshot({
      chartPictureVersion: 0,
      points,
    });
    const latestPoint = points[points.length - 1];
    const breakout = getTradingViewNativePicturePointsSnapshot({
      chartPictureVersion: 0,
      points: [
        ...points.slice(0, -1),
        {
          ...latestPoint,
          h: initial.baseMaxPrice + 1,
        },
      ],
      previous: initial,
    });

    expect(breakout.basePoints).not.toBe(initial.basePoints);
    expect(breakout.baseMaxPrice).toBeGreaterThan(initial.baseMaxPrice);
  });
});
