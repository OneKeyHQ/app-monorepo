import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { getTradingViewNativeCurrentPriceLabel } from './chartLayout';

export function formatTradingViewNativeCandleCountdown({
  candleIntervalSeconds,
  candleTimestamp,
  now,
}: {
  candleIntervalSeconds: number;
  candleTimestamp: number;
  now: number;
}): string {
  if (
    !Number.isFinite(candleIntervalSeconds) ||
    candleIntervalSeconds <= 0 ||
    !Number.isFinite(candleTimestamp) ||
    !Number.isFinite(now)
  ) {
    return '';
  }

  const remainingSeconds = Math.max(
    Math.ceil(candleTimestamp + candleIntervalSeconds - now / 1000),
    0,
  );
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}

export function getTradingViewNativeCurrentPriceDisplayLabel({
  candleIntervalSeconds,
  countdown,
  now,
  points,
}: {
  candleIntervalSeconds: number;
  countdown: boolean;
  now: number;
  points: IMarketTokenKLineDataPoint[];
}): string {
  const priceLabel = getTradingViewNativeCurrentPriceLabel(points);
  const latestPoint = points[points.length - 1];
  if (!countdown || !priceLabel || !latestPoint) {
    return priceLabel;
  }

  const countdownLabel = formatTradingViewNativeCandleCountdown({
    candleIntervalSeconds,
    candleTimestamp: latestPoint.t,
    now,
  });
  return countdownLabel ? `${priceLabel} ${countdownLabel}` : priceLabel;
}
