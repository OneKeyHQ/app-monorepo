import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

export function isTradingViewNativePriceUp(
  point: Pick<IMarketTokenKLineDataPoint, 'c' | 'o'>,
) {
  return point.c >= point.o;
}

export function isTradingViewNativeLinePriceUp(
  points: readonly Pick<IMarketTokenKLineDataPoint, 'c'>[],
) {
  const firstPrice = points[0]?.c;
  const latestPrice = points[points.length - 1]?.c;
  return (
    !Number.isFinite(firstPrice) ||
    !Number.isFinite(latestPrice) ||
    (latestPrice ?? 0) >= (firstPrice ?? 0)
  );
}

export function getTradingViewNativeLineColors({
  down,
  line,
  points,
  up,
}: {
  down: string;
  line: string;
  points: readonly Pick<IMarketTokenKLineDataPoint, 'c'>[];
  up: string;
}) {
  return {
    currentPrice: isTradingViewNativeLinePriceUp(points) ? up : down,
    line,
  };
}
