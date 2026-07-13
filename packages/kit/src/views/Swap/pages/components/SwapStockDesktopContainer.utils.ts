import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { ESwapStockTradeSide } from '../../hooks/swapStockChannelUtils';
import { normalizeSwapKLineWalletChartTimestamp } from '../modal/swapKLineChartUtils';

export type IStockChartRange = '1D' | '1W' | '1M' | '1Y';

export const STOCK_CHART_DEFAULT_RANGE: IStockChartRange = '1W';

export const STOCK_DESKTOP_HEADER_SLOT_PROPS = {
  width: '100%',
  alignItems: 'center',
  pt: '$8',
  pb: '$4',
} as const;

export const STOCK_CHART_RANGE_ITEMS: {
  label: IStockChartRange;
  interval: string;
  seconds: number;
}[] = [
  { label: '1D', interval: '1m', seconds: 24 * 60 * 60 },
  { label: '1W', interval: '1H', seconds: 7 * 24 * 60 * 60 },
  { label: '1M', interval: '4H', seconds: 30 * 24 * 60 * 60 },
  { label: '1Y', interval: '1D', seconds: 365 * 24 * 60 * 60 },
];

export function getStockDisabledActionButtonProps(
  tradeSide: ESwapStockTradeSide,
) {
  return {
    bg:
      tradeSide === ESwapStockTradeSide.Sell
        ? '$bgCriticalStrong'
        : '$bgSuccessStrong',
    color: '$textOnColor',
    disabledStyle: {
      opacity: 0.6,
    },
  } as const;
}

export function mergeStockChartRealtimePoint({
  baseChartData,
  realtimeChartPoint,
}: {
  baseChartData: IMarketTokenChart;
  realtimeChartPoint?: IMarketTokenChart[number];
}): IMarketTokenChart {
  if (baseChartData.length === 0 || !realtimeChartPoint) {
    return baseChartData;
  }

  const [timestamp, price] = realtimeChartPoint;
  const normalizedTimestamp = normalizeSwapKLineWalletChartTimestamp(timestamp);
  const normalizedPrice = Number(price);
  if (
    !Number.isFinite(normalizedTimestamp) ||
    !Number.isFinite(normalizedPrice)
  ) {
    return baseChartData;
  }

  const pointsByTimestamp = new Map<number, number>();
  for (const [pointTimestamp, pointPrice] of baseChartData) {
    const normalizedPointTimestamp =
      normalizeSwapKLineWalletChartTimestamp(pointTimestamp);
    const normalizedPointPrice = Number(pointPrice);
    if (
      Number.isFinite(normalizedPointTimestamp) &&
      Number.isFinite(normalizedPointPrice)
    ) {
      pointsByTimestamp.set(normalizedPointTimestamp, normalizedPointPrice);
    }
  }
  pointsByTimestamp.set(normalizedTimestamp, normalizedPrice);

  return Array.from(pointsByTimestamp.entries()).toSorted(
    (a, b) => a[0] - b[0],
  );
}

export function getStockChartDisplayState({
  baseChartData,
  isChartStateForCurrentScope,
  isLoading,
  realtimeChartPoint,
}: {
  baseChartData: IMarketTokenChart;
  isChartStateForCurrentScope: boolean;
  isLoading?: boolean;
  realtimeChartPoint?: IMarketTokenChart[number];
}) {
  return {
    chartData: mergeStockChartRealtimePoint({
      baseChartData,
      realtimeChartPoint: isChartStateForCurrentScope
        ? realtimeChartPoint
        : undefined,
    }),
    shouldShowChartLoading:
      baseChartData.length === 0 &&
      (Boolean(isLoading) || !isChartStateForCurrentScope),
  };
}
