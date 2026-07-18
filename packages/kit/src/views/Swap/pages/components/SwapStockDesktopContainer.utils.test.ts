import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { ESwapStockChannelStage } from '../../hooks/swapStockChannelUtils';

import {
  STOCK_CHART_DEFAULT_RANGE,
  STOCK_CHART_RANGE_ITEMS,
  STOCK_DESKTOP_HEADER_SLOT_PROPS,
  canMountStockSwapActions,
  getStockAmountInputInteractionProps,
  getStockChartDisplayState,
  getStockMaxAmountState,
  isStockMarketPanelLoadingStage,
  mergeStockChartRealtimePoint,
  resolveStockChartControlRange,
  resolveStockTokenNetworkLogoURI,
  shouldDiscardRestoredStockChart,
  shouldHideStockEstimatedReceive,
  shouldRenderStockMarketHeaderSkeleton,
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

  it('labels retained chart data with its visible range while a new range is pending', () => {
    expect(
      resolveStockChartControlRange({
        requestedRange: '1M',
        visibleRange: '1W',
      }),
    ).toBe('1W');
    expect(
      resolveStockChartControlRange({
        requestedRange: '1M',
      }),
    ).toBe('1M');
  });

  it('uses the shared desktop header slot spacing for stock layout', () => {
    expect(STOCK_DESKTOP_HEADER_SLOT_PROPS).toEqual({
      width: '100%',
      alignItems: 'center',
      pt: '$8',
      pb: '$4',
    });
  });

  it('keeps the Stock Max affordance visible while its live balance refreshes', () => {
    expect(getStockMaxAmountState({ balanceReadyForExecution: false })).toEqual(
      {
        enableMaxAmount: true,
        canPressMaxAmount: false,
      },
    );
  });

  it('enables the persistent Stock Max affordance after the live balance lands', () => {
    expect(getStockMaxAmountState({ balanceReadyForExecution: true })).toEqual({
      enableMaxAmount: true,
      canPressMaxAmount: true,
    });
  });

  it('gates Stock input interaction without painting a disabled input layer', () => {
    const pendingProps = getStockAmountInputInteractionProps(false);
    const readyProps = getStockAmountInputInteractionProps(true);

    expect(pendingProps).toEqual({ readonly: true });
    expect(readyProps).toEqual({ readonly: false });
    expect(pendingProps).not.toHaveProperty('editable');
    expect(readyProps).not.toHaveProperty('editable');
  });

  it('uses the current Stock token network logo on the first frame', () => {
    expect(
      resolveStockTokenNetworkLogoURI({
        currentToken: {
          networkId: 'evm--1',
          networkLogoURI: 'current-network-logo',
        },
        localNetworkLogoURI: 'local-network-logo',
        networkId: 'evm--1',
        snapshotToken: {
          networkId: 'evm--1',
          networkLogoURI: 'snapshot-network-logo',
        },
      }),
    ).toBe('current-network-logo');
  });

  it('restores the matching snapshot network logo before the live token enriches', () => {
    expect(
      resolveStockTokenNetworkLogoURI({
        currentToken: {
          networkId: 'evm--1',
        },
        localNetworkLogoURI: 'local-network-logo',
        networkId: 'evm--1',
        snapshotToken: {
          networkId: 'evm--1',
          networkLogoURI: 'snapshot-network-logo',
        },
      }),
    ).toBe('snapshot-network-logo');
  });

  it('rejects a stale snapshot logo and falls back to local network info', () => {
    expect(
      resolveStockTokenNetworkLogoURI({
        currentToken: {
          networkId: 'evm--1',
        },
        localNetworkLogoURI: 'local-network-logo',
        networkId: 'evm--1',
        snapshotToken: {
          networkId: 'sol--101',
          networkLogoURI: 'stale-network-logo',
        },
      }),
    ).toBe('local-network-logo');
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

  it('shows market skeletons only while Stock identity is initializing', () => {
    expect(
      isStockMarketPanelLoadingStage(ESwapStockChannelStage.InitializingStock),
    ).toBe(true);
    expect(
      isStockMarketPanelLoadingStage(
        ESwapStockChannelStage.CheckingMarketStatus,
      ),
    ).toBe(true);
    expect(
      isStockMarketPanelLoadingStage(ESwapStockChannelStage.MissingStock),
    ).toBe(false);
    expect(
      isStockMarketPanelLoadingStage(ESwapStockChannelStage.MarketUnavailable),
    ).toBe(false);
  });

  it.each([
    {
      channelStage: ESwapStockChannelStage.MarketClosed,
      expectedWithoutBlocker: true,
      state: 'closed',
    },
    {
      channelStage: ESwapStockChannelStage.Ready,
      expectedWithoutBlocker: false,
      state: 'ready',
    },
    {
      channelStage: ESwapStockChannelStage.MarketUnavailable,
      expectedWithoutBlocker: false,
      state: 'market detail unavailable',
    },
  ])(
    'resolves estimated receive visibility for $state',
    ({ channelStage, expectedWithoutBlocker }) => {
      expect(
        shouldHideStockEstimatedReceive({
          channelStage,
          hasQuoteBlocker: false,
        }),
      ).toBe(expectedWithoutBlocker);
      expect(
        shouldHideStockEstimatedReceive({
          channelStage,
          hasQuoteBlocker: true,
        }),
      ).toBe(true);
    },
  );

  it('settles closed-market receive state without making a ready amount input readonly', () => {
    expect(
      shouldHideStockEstimatedReceive({
        channelStage: ESwapStockChannelStage.MarketClosed,
        hasQuoteBlocker: false,
      }),
    ).toBe(true);
    expect(getStockAmountInputInteractionProps(true)).toEqual({
      readonly: false,
    });
  });

  it('keeps Stock header content visible while detail and images load for a known token', () => {
    expect(
      shouldRenderStockMarketHeaderSkeleton({
        hasDisplayToken: true,
        loading: true,
      }),
    ).toBe(false);
  });

  it('shows the Stock header skeleton only while no token identity is available', () => {
    expect(
      shouldRenderStockMarketHeaderSkeleton({
        hasDisplayToken: false,
        loading: true,
      }),
    ).toBe(true);
    expect(
      shouldRenderStockMarketHeaderSkeleton({
        hasDisplayToken: false,
        loading: false,
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

  it('drops a restored chart after its first live refresh fails', () => {
    expect(
      shouldDiscardRestoredStockChart({
        phase: 'stale-error',
        source: 'snapshot',
      }),
    ).toBe(true);
    expect(
      shouldDiscardRestoredStockChart({
        phase: 'stale-empty',
        source: 'snapshot',
      }),
    ).toBe(true);
    expect(
      shouldDiscardRestoredStockChart({
        phase: 'stale-error',
        source: 'live',
      }),
    ).toBe(false);
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
