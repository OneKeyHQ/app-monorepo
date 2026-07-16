import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { ESwapStockTradeSide } from '../../hooks/swapStockChannelUtils';

import {
  type IStockChartState,
  STOCK_CHART_DEFAULT_RANGE,
  STOCK_CHART_RANGE_ITEMS,
  STOCK_DESKTOP_HEADER_SLOT_PROPS,
  canMountStockSwapActions,
  createStockChartStateFromSnapshot,
  getStockChartDisplayState,
  getStockChartVisibleState,
  getStockDisabledActionButtonProps,
  mergeStockChartRealtimePoint,
  shouldShowStockBalanceRetryAction,
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

  it('restores an account-scoped chart snapshot on the first frame', () => {
    const snapshotData: IMarketTokenChart = [
      [1_725_000_000, 310],
      [1_725_003_600, 311],
    ];

    expect(
      createStockChartStateFromSnapshot({
        displayScope: 'account-a:stock-a:usd',
        snapshot: {
          data: snapshotData,
          range: '1M',
          updatedAt: 1_725_000_000_000,
        },
      }),
    ).toEqual({
      displayScope: 'account-a:stock-a:usd',
      requestScope: '',
      data: snapshotData,
      range: '1M',
      status: 'settled',
    });
  });

  it('replaces a restored chart only with the exact settled live request', () => {
    const retainedState: IStockChartState = {
      displayScope: 'account-a:stock-a:usd',
      requestScope: '',
      data: [[1_725_000_000, 310]],
      range: '1W',
      status: 'settled',
    };
    const requestState: IStockChartState = {
      displayScope: 'account-a:stock-a:usd',
      requestScope: 'stock-a:usd:1W',
      data: [[1_725_003_600, 312]],
      range: '1W',
      status: 'settled',
    };

    expect(
      getStockChartVisibleState({
        displayScope: 'account-a:stock-a:usd',
        range: '1W',
        requestScope: 'stock-a:usd:1W',
        requestState,
        retainedState,
      }),
    ).toBe(requestState);
  });

  it('keeps the restored chart when the exact live request fails', () => {
    const retainedState: IStockChartState = {
      displayScope: 'account-a:stock-a:usd',
      requestScope: '',
      data: [[1_725_000_000, 310]],
      range: '1W',
      status: 'settled',
    };
    const failedRequestState: IStockChartState = {
      displayScope: 'account-a:stock-a:usd',
      requestScope: 'stock-a:usd:1W',
      data: [],
      range: '1W',
      status: 'failed',
    };

    expect(
      getStockChartVisibleState({
        displayScope: 'account-a:stock-a:usd',
        range: '1W',
        requestScope: 'stock-a:usd:1W',
        requestState: failedRequestState,
        retainedState,
      }),
    ).toBe(retainedState);
  });

  it('rejects a retained chart from a different display identity', () => {
    const retainedState: IStockChartState = {
      displayScope: 'account-a:stock-a:usd',
      requestScope: '',
      data: [[1_725_000_000, 310]],
      range: '1W',
      status: 'settled',
    };

    expect(
      getStockChartVisibleState({
        displayScope: 'account-b:stock-a:usd',
        range: '1W',
        requestScope: 'stock-a:usd:1W',
        retainedState,
      }),
    ).toBeUndefined();
  });

  it('settles an exact empty live chart without returning to a skeleton', () => {
    const emptyRequestState: IStockChartState = {
      displayScope: 'account-a:stock-a:usd',
      requestScope: 'stock-a:usd:1W',
      data: [],
      range: '1W',
      status: 'settled',
    };
    const visibleState = getStockChartVisibleState({
      displayScope: 'account-a:stock-a:usd',
      range: '1W',
      requestScope: 'stock-a:usd:1W',
      requestState: emptyRequestState,
    });

    expect(visibleState).toBe(emptyRequestState);
    expect(
      getStockChartDisplayState({
        baseChartData: visibleState?.data ?? [],
        isChartStateForCurrentScope: true,
      }),
    ).toEqual({
      chartData: [],
      shouldShowChartLoading: false,
    });
  });

  it('retains the previous range until the requested range settles', () => {
    const retainedState: IStockChartState = {
      displayScope: 'account-a:stock-a:usd',
      requestScope: '',
      data: [[1_725_000_000, 310]],
      range: '1W',
      status: 'settled',
    };
    const staleRangeRequestState: IStockChartState = {
      displayScope: 'account-a:stock-a:usd',
      requestScope: 'stock-a:usd:1W',
      data: [[1_725_003_600, 312]],
      range: '1W',
      status: 'settled',
    };

    expect(
      getStockChartVisibleState({
        displayScope: 'account-a:stock-a:usd',
        range: '1M',
        requestScope: 'stock-a:usd:1M',
        requestState: staleRangeRequestState,
        retainedState,
      }),
    ).toBe(retainedState);
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

  it('mounts Stock review actions only after the exact live balance lands', () => {
    expect(
      canMountStockSwapActions({
        balanceReadyForExecution: true,
        readyForQuote: true,
      }),
    ).toBe(true);
    expect(
      canMountStockSwapActions({
        balanceReadyForExecution: false,
        readyForQuote: true,
      }),
    ).toBe(false);
  });

  it('shows a retry action only for a failed balance request on a ready channel', () => {
    expect(
      shouldShowStockBalanceRetryAction({
        balanceFailed: true,
        readyForQuote: true,
      }),
    ).toBe(true);
    expect(
      shouldShowStockBalanceRetryAction({
        balanceFailed: true,
        readyForQuote: false,
      }),
    ).toBe(false);
  });

  it('keeps the chart in loading state when only realtime price has arrived', () => {
    expect(
      getStockChartDisplayState({
        baseChartData: [],
        isChartStateForCurrentScope: false,
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
