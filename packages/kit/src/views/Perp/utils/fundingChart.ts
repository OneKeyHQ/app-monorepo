import BigNumber from 'bignumber.js';

import type { IFundingHistoryRecord } from '@onekeyhq/shared/types/hyperliquid/sdk';

export type IPerpFundingChartInterval = '1h' | '8h' | '1d';

export type IPerpFundingChartPoint = {
  time: number;
  fundingRate: number;
  cumulativeFundingRate: number;
};

export type IPerpFundingTooltipPositionParams = {
  x: number;
  y: number;
  chartWidth: number;
  chartHeight: number;
  tooltipWidth: number;
  tooltipHeight: number;
  leftPriceScaleWidth?: number;
  offset?: number;
  padding?: number;
};

const HOUR_MS = 60 * 60 * 1000;

const INTERVAL_CONFIG: Record<
  IPerpFundingChartInterval,
  {
    bucketHours: number;
    rangeHours: number;
  }
> = {
  '1h': { bucketHours: 1, rangeHours: 7 * 24 },
  '8h': { bucketHours: 8, rangeHours: 30 * 24 },
  '1d': { bucketHours: 24, rangeHours: 90 * 24 },
};

export function getPerpFundingTooltipPosition({
  x,
  y,
  chartWidth,
  chartHeight,
  tooltipWidth,
  tooltipHeight,
  leftPriceScaleWidth = 0,
  offset = 12,
  padding = 8,
}: IPerpFundingTooltipPositionParams) {
  const maxLeft = Math.max(padding, chartWidth - tooltipWidth - padding);
  const maxTop = Math.max(padding, chartHeight - tooltipHeight - padding);
  const crosshairX = x + leftPriceScaleWidth;
  const fitsToTheRight =
    crosshairX + offset + tooltipWidth + padding <= chartWidth;
  const preferredLeft = fitsToTheRight
    ? crosshairX + offset
    : crosshairX - tooltipWidth - offset;

  return {
    left: Math.min(maxLeft, Math.max(padding, preferredLeft)),
    top: Math.min(maxTop, Math.max(padding, y - tooltipHeight / 2)),
  };
}

export function buildPerpFundingChartData(
  records: IFundingHistoryRecord[],
  interval: IPerpFundingChartInterval,
): IPerpFundingChartPoint[] {
  const { bucketHours, rangeHours } = INTERVAL_CONFIG[interval];
  const bucketSizeMs = bucketHours * HOUR_MS;
  const latestRecordTime = records.reduce(
    (latestTime, record) =>
      Number.isFinite(record.time)
        ? Math.max(latestTime, record.time)
        : latestTime,
    Number.NEGATIVE_INFINITY,
  );
  const rangeStartTime = latestRecordTime - rangeHours * HOUR_MS;
  const buckets = new Map<number, BigNumber>();

  records
    .toSorted((a, b) => a.time - b.time)
    .forEach((record) => {
      const fundingRate = new BigNumber(record.fundingRate);
      if (
        !Number.isFinite(record.time) ||
        record.time < rangeStartTime ||
        !fundingRate.isFinite()
      ) {
        return;
      }

      const bucketTime = Math.floor(record.time / bucketSizeMs) * bucketSizeMs;
      buckets.set(
        bucketTime,
        (buckets.get(bucketTime) ?? new BigNumber(0)).plus(fundingRate),
      );
    });

  let cumulativeFundingRate = new BigNumber(0);
  return Array.from(buckets, ([time, fundingRate]) => {
    cumulativeFundingRate = cumulativeFundingRate.plus(fundingRate);
    return {
      time: Math.floor(time / 1000),
      fundingRate: fundingRate.multipliedBy(100).toNumber(),
      cumulativeFundingRate: cumulativeFundingRate.multipliedBy(100).toNumber(),
    };
  });
}
