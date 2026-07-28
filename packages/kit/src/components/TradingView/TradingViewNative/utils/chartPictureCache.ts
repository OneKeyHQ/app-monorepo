import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

const PRICE_DOMAIN_HEADROOM_RATIO = 0.05;
const VOLUME_DOMAIN_HEADROOM_RATIO = 0.25;

export interface ITradingViewNativePicturePointsSnapshot {
  baseMaxPrice: number;
  baseMaxVolume: number;
  baseMinPrice: number;
  basePoints: IMarketTokenKLineDataPoint[];
  chartPictureVersion: number;
  historicalPoints: IMarketTokenKLineDataPoint[];
}

function createPicturePointsSnapshot({
  chartPictureVersion,
  points,
}: {
  chartPictureVersion: number;
  points: IMarketTokenKLineDataPoint[];
}): ITradingViewNativePicturePointsSnapshot {
  const basePoints = [...points];
  let maxPrice = Number.NEGATIVE_INFINITY;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxVolume = 0;

  for (const point of basePoints) {
    if (Number.isFinite(point.h)) {
      maxPrice = Math.max(maxPrice, point.h);
    }
    if (Number.isFinite(point.l)) {
      minPrice = Math.min(minPrice, point.l);
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
    latestPoint.h > previous.baseMaxPrice ||
    latestPoint.l < previous.baseMinPrice ||
    latestPoint.v > previous.baseMaxVolume
  );
}

export function getTradingViewNativePicturePointsSnapshot({
  chartPictureVersion,
  points,
  previous,
}: {
  chartPictureVersion: number;
  points: IMarketTokenKLineDataPoint[];
  previous?: ITradingViewNativePicturePointsSnapshot;
}): ITradingViewNativePicturePointsSnapshot {
  if (
    !previous ||
    previous.chartPictureVersion !== chartPictureVersion ||
    isLatestPointOutsideBaseDomain({ points, previous })
  ) {
    return createPicturePointsSnapshot({ chartPictureVersion, points });
  }

  return previous;
}
