import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { ESwapStockTradeSide } from '../../hooks/swapStockChannelUtils';

import {
  STOCK_CHART_DEFAULT_RANGE,
  STOCK_CHART_RANGE_ITEMS,
  STOCK_DESKTOP_HEADER_SLOT_PROPS,
  getStockChartDisplayState,
  getStockDisabledActionButtonProps,
  mergeStockChartRealtimePoint,
} from './SwapStockDesktopContainer.utils';

describe('SwapStockDesktopContainer utils', () => {
  it('defaults the stock chart range to one week', () => {
    expect(STOCK_CHART_DEFAULT_RANGE).toBe('1W');
  });

  it('keeps one month as a selectable stock chart range', () => {
    expect(
      STOCK_CHART_RANGE_ITEMS.some((item) => item.label === '1M'),
    ).toBeTruthy();
  });

  it('uses the shared desktop header slot spacing for stock layout', () => {
    expect(STOCK_DESKTOP_HEADER_SLOT_PROPS).toEqual({
      width: '100%',
      alignItems: 'center',
      pt: '$8',
      pb: '$4',
    });
  });

  it('keeps disabled buy actions in the buy color family', () => {
    expect(getStockDisabledActionButtonProps(ESwapStockTradeSide.Buy)).toEqual({
      bg: '$bgSuccessStrong',
      color: '$textOnColor',
      disabledStyle: {
        opacity: 0.6,
      },
    });
  });

  it('keeps disabled sell actions in the sell color family', () => {
    expect(getStockDisabledActionButtonProps(ESwapStockTradeSide.Sell)).toEqual(
      {
        bg: '$bgCriticalStrong',
        color: '$textOnColor',
        disabledStyle: {
          opacity: 0.6,
        },
      },
    );
  });

  it('keeps the chart in loading state when only realtime price has arrived', () => {
    expect(
      getStockChartDisplayState({
        baseChartData: [],
        isChartStateForCurrentScope: false,
        isLoading: true,
        realtimeChartPoint: [1_725_000_000, 312.15],
      }),
    ).toEqual({
      chartData: [],
      shouldShowChartLoading: true,
    });
  });

  it('keeps previous chart data visible during a same-asset refresh', () => {
    const previousChartData: IMarketTokenChart = [
      [1_725_000_000, 310],
      [1_725_003_600, 311],
    ];

    expect(
      getStockChartDisplayState({
        baseChartData: [...previousChartData],
        isChartStateForCurrentScope: false,
        isLoading: true,
        realtimeChartPoint: [1_725_007_200, 312.15],
      }),
    ).toEqual({
      chartData: previousChartData,
      shouldShowChartLoading: false,
    });
  });

  it('merges realtime stock points only after chart data matches the active range', () => {
    expect(
      getStockChartDisplayState({
        baseChartData: [
          [1_725_000_000, 310],
          [1_725_003_600, 311],
        ],
        isChartStateForCurrentScope: true,
        isLoading: false,
        realtimeChartPoint: [1_725_007_200, 312.15],
      }),
    ).toEqual({
      chartData: [
        [1_725_000_000, 310],
        [1_725_003_600, 311],
        [1_725_007_200, 312.15],
      ],
      shouldShowChartLoading: false,
    });
  });

  it('merges realtime stock points into existing chart data by timestamp', () => {
    expect(
      mergeStockChartRealtimePoint({
        baseChartData: [
          [1_725_003_600_000, 311],
          [1_725_000_000, 310],
        ],
        realtimeChartPoint: [1_725_003_600, 312.15],
      }),
    ).toEqual([
      [1_725_000_000, 310],
      [1_725_003_600, 312.15],
    ]);
  });

  it('ignores invalid realtime stock points', () => {
    const chartData: IMarketTokenChart = [[1_725_000_000, 310]];

    expect(
      mergeStockChartRealtimePoint({
        baseChartData: chartData,
        realtimeChartPoint: [1_725_003_600, Number.NaN],
      }),
    ).toBe(chartData);
  });
});
