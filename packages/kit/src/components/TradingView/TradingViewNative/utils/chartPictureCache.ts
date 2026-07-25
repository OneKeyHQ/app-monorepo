import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import type { ITradingViewNativeChartType } from '../types';

const PRICE_DOMAIN_HEADROOM_RATIO = 0.05;
const VOLUME_DOMAIN_HEADROOM_RATIO = 0.25;

export interface ITradingViewNativePicturePointsSnapshot {
  baseMaxPrice: number;
  baseMaxVolume: number;
  baseMinPrice: number;
  basePoints: IMarketTokenKLineDataPoint[];
  chartType: ITradingViewNativeChartType;
  chartPictureVersion: number;
  historicalPoints: IMarketTokenKLineDataPoint[];
}

function createPicturePointsSnapshot({
  chartType,
  chartPictureVersion,
  points,
}: {
  chartType: ITradingViewNativeChartType;
  chartPictureVersion: number;
  points: IMarketTokenKLineDataPoint[];
}): ITradingViewNativePicturePointsSnapshot {
  const basePoints = [...points];
  let maxPrice = Number.NEGATIVE_INFINITY;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxVolume = 0;

  for (const point of basePoints) {
    const pointMaxPrice = chartType === 'line' ? point.c : point.h;
    const pointMinPrice = chartType === 'line' ? point.c : point.l;
    if (Number.isFinite(pointMaxPrice)) {
      maxPrice = Math.max(maxPrice, pointMaxPrice);
    }
    if (Number.isFinite(pointMinPrice)) {
      minPrice = Math.min(minPrice, pointMinPrice);
    }
    if (Number.isFinite(point.v)) {
      maxVolume = Math.max(maxVolume, point.v);
    }
  }

  if (!Number.isFinite(maxPrice) || !Number.isFinite(minPrice)) {
    maxPrice = 0;
    minPrice = 0;
  }
  const priceRange = maxPrice - minPrice;
  const priceHeadroom =
    priceRange > 0
      ? priceRange * PRICE_DOMAIN_HEADROOM_RATIO
      : Math.max(Math.abs(maxPrice) * PRICE_DOMAIN_HEADROOM_RATIO, 1e-8);

  return {
    baseMaxPrice: maxPrice + priceHeadroom,
    baseMaxVolume: maxVolume * (1 + VOLUME_DOMAIN_HEADROOM_RATIO),
    baseMinPrice: minPrice - priceHeadroom,
    basePoints,
    chartType,
    chartPictureVersion,
    historicalPoints: basePoints.slice(0, -1),
  };
}

function isLatestPointOutsideBaseDomain({
  points,
  previous,
}: {
  points: IMarketTokenKLineDataPoint[];
  previous: ITradingViewNativePicturePointsSnapshot;
}) {
  const latestPoint = points[points.length - 1];
  if (!latestPoint) {
    return false;
  }

  return (
    (previous.chartType === 'line'
      ? latestPoint.c > previous.baseMaxPrice ||
        latestPoint.c < previous.baseMinPrice
      : latestPoint.h > previous.baseMaxPrice ||
        latestPoint.l < previous.baseMinPrice) ||
    latestPoint.v > previous.baseMaxVolume
  );
}

export function getTradingViewNativePicturePointsSnapshot({
  chartType = 'candlestick',
  chartPictureVersion,
  points,
  previous,
}: {
  chartType?: ITradingViewNativeChartType;
  chartPictureVersion: number;
  points: IMarketTokenKLineDataPoint[];
  previous?: ITradingViewNativePicturePointsSnapshot;
}): ITradingViewNativePicturePointsSnapshot {
  if (
    !previous ||
    previous.chartType !== chartType ||
    previous.chartPictureVersion !== chartPictureVersion ||
    isLatestPointOutsideBaseDomain({ points, previous })
  ) {
    return createPicturePointsSnapshot({
      chartType,
      chartPictureVersion,
      points,
    });
  }

  return previous;
}
