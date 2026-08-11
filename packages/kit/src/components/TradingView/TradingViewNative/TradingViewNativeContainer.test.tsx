/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { TradingViewNativeContainer } from './TradingViewNativeContainer';

import type { ITradingViewNativeDataState } from './types';

const mockHandleRetry = jest.fn();
const mockHandleHistoryBoundaryPrefetch = jest.fn();
const mockHandleIntervalChange = jest.fn();
const mockHandleViewportRequestApplied = jest.fn();
const mockHandleViewportTargetChange = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);
const mockTradingViewNativeChartControlsContainer = jest.fn<null, [unknown]>(
  () => null,
);
const mockTradingViewNativeChart = jest.fn<null, [unknown]>(() => null);
let mockDataProviderKey = 'market:evm--1:0xabc:TOKEN';
let mockDataState: ITradingViewNativeDataState;
let mockActiveInterval = '60';
let mockPoints: IMarketTokenKLineDataPoint[];
let mockVisibleTimeRange: { from: number; to: number } | undefined;
let mockViewportRequest: unknown;
let mockRealtimePointListener:
  | ((point: IMarketTokenKLineDataPoint) => void)
  | undefined;
const mockUseTradingViewNativeKLine = jest.fn(
  ({
    onRealtimePoint,
  }: {
    onRealtimePoint?: (point: IMarketTokenKLineDataPoint) => void;
  }) => {
    mockRealtimePointListener = onRealtimePoint;
    return {
      calendarAvailableTimeRange: { from: 100 },
      candleIntervalSeconds: 3600,
      chartType: 'candlestick' as const,
      chartPictureVersion: 0,
      dataProviderKey: mockDataProviderKey,
      dataState: mockDataState,
      getVisibleTimeRange: () => mockVisibleTimeRange,
      handleHistoryBoundaryPrefetch: mockHandleHistoryBoundaryPrefetch,
      handleIntervalChange: mockHandleIntervalChange,
      handleRetry: mockHandleRetry,
      handleViewportTargetChange: mockHandleViewportTargetChange,
      handleViewportRequestApplied: mockHandleViewportRequestApplied,
      handleVisiblePointRangeChange: jest.fn(),
      intervalConfig: { activeInterval: mockActiveInterval, intervals: [] },
      isSwitchingInterval: false,
      points: mockPoints,
      viewportRequest: mockViewportRequest,
    };
  },
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {children}
    </button>
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

jest.mock('./data/useTradingViewNativeKLine', () => ({
  useTradingViewNativeKLine: (params: {
    onRealtimePoint?: (point: IMarketTokenKLineDataPoint) => void;
  }) => mockUseTradingViewNativeKLine(params),
}));

jest.mock('./TradingViewNativeChart', () => ({
  TradingViewNativeChart: (props: unknown) => mockTradingViewNativeChart(props),
}));

jest.mock('./TradingViewNativeChartControlsContainer', () => ({
  TradingViewNativeChartControlsContainer: (props: unknown) =>
    mockTradingViewNativeChartControlsContainer(props),
}));

jest.mock('./TradingViewNativeDebugPanel', () => ({
  TradingViewNativeDebugPanel: () => null,
}));

describe('TradingViewNativeContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataProviderKey = 'market:evm--1:0xabc:TOKEN';
    mockActiveInterval = '60';
    mockDataState = {
      status: 'error',
      error: new Error('history unavailable'),
    };
    mockPoints = [];
    mockVisibleTimeRange = undefined;
    mockRealtimePointListener = undefined;
    mockViewportRequest = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a retryable error state when history has no points', () => {
    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        testID="chart"
      />,
    );

    expect(screen.getByTestId('chart-error')).toBeTruthy();
    fireEvent.click(screen.getByTestId('chart-retry'));
    expect(mockHandleRetry).toHaveBeenCalledTimes(1);
  });

  it('passes localized candle abbreviations to the chart', () => {
    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({
        candleLabels: {
          close: 'market.close_abbr',
          high: 'market.high_abbr',
          low: 'market.low_abbr',
          open: 'market.open_abbr',
        },
      }),
    );
  });

  it('shows the volume section only when loaded candles contain volume', () => {
    mockDataState = { status: 'live' };
    mockPoints = [
      { c: 100, h: 101, l: 99, o: 100, t: 1000, v: 0 },
      { c: 101, h: 102, l: 100, o: 100, t: 2000, v: 0 },
    ];
    const source = {
      kind: 'market' as const,
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'disabled' as const,
    };
    const { rerender } = render(<TradingViewNativeContainer source={source} />);

    expect(mockTradingViewNativeChart).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasVolume: false }),
    );

    mockPoints = [...mockPoints, { ...mockPoints[1], t: 3000, v: 1 }];
    rerender(<TradingViewNativeContainer source={{ ...source }} />);

    expect(mockTradingViewNativeChart).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasVolume: true }),
    );
  });

  it('starts without indicators and updates series from indicator controls', () => {
    mockDataState = { status: 'live' };
    mockPoints = Array.from({ length: 25 }, (_, index) => ({
      c: 100 + index,
      h: 101 + index,
      l: 99 + index,
      o: 100 + index,
      t: 1000 + index,
      v: 1,
    }));

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    expect(mockTradingViewNativeChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        indicatorSeries: [],
      }),
    );

    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onIndicatorChange: (indicator: 'EMA', desiredActive: boolean) => void;
    };
    act(() => controlsProps.onIndicatorChange('EMA', true));

    const chartProps = mockTradingViewNativeChart.mock.calls.at(-1)?.[0] as {
      indicatorSeries: Array<{ key: string }>;
    };
    expect(chartProps.indicatorSeries.map(({ key }) => key)).toEqual([
      'ema-5',
      'ema-10',
      'ema-20',
    ]);
  });

  it('forwards controlled fullscreen props to chart controls', () => {
    const handleFullscreenChange = jest.fn();
    const fullscreenHeader = <div>Token info</div>;

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
        isNativeChartFullscreen
        nativeChartFullscreenHeader={fullscreenHeader}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />,
    );

    expect(mockTradingViewNativeChartControlsContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        isFullscreen: true,
        fullscreenHeader,
        onFullscreenChange: handleFullscreenChange,
      }),
    );
  });

  it('maps calendar submissions to native viewport targets', () => {
    const goToTimestamp = 1_751_328_000;
    const halfSevenDays = (7 * 24 * 60 * 60) / 2;
    mockDataState = { status: 'stale' };
    mockPoints = [
      {
        o: 100,
        h: 101,
        l: 99,
        c: 100,
        v: 10,
        t: 1000,
      },
    ];
    mockViewportRequest = {
      requestId: 1,
      target: { kind: 'timestamp', timestamp: 1000 },
    };

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );

    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelOpen: () => void;
      onCalendarPanelSubmit: (payload: {
        panel: 'goToDate' | 'timeRange';
        timestamp?: number;
        from?: number;
        to?: number;
      }) => void;
    };
    controlsProps.onCalendarPanelOpen();
    controlsProps.onCalendarPanelSubmit({
      panel: 'goToDate',
      timestamp: goToTimestamp,
    });
    controlsProps.onCalendarPanelSubmit({
      panel: 'timeRange',
      from: 100,
      to: 200,
    });

    expect(mockHandleViewportTargetChange).toHaveBeenNthCalledWith(1, {
      kind: 'timeRange',
      from: goToTimestamp - halfSevenDays,
      to: goToTimestamp + halfSevenDays,
    });
    expect(mockHandleViewportTargetChange).toHaveBeenNthCalledWith(2, {
      kind: 'timeRange',
      from: 100,
      to: 200,
    });
    expect(mockHandleHistoryBoundaryPrefetch).toHaveBeenCalledTimes(1);
    expect(controlsProps).toEqual(
      expect.objectContaining({
        calendarAvailableTimeRange: { from: 100 },
      }),
    );
    expect(mockTradingViewNativeChart).toHaveBeenCalledWith(
      expect.objectContaining({
        onViewportRequestApplied: mockHandleViewportRequestApplied,
        viewportRequest: mockViewportRequest,
      }),
    );
  });

  it('switches to the V2 adaptive interval before navigating to a date', () => {
    const timestamp = 1_751_328_000;
    const halfSevenDays = (7 * 24 * 60 * 60) / 2;
    const handleIntervalChange = jest.fn();
    mockActiveInterval = '1';
    mockDataState = { status: 'stale' };
    mockPoints = [
      {
        o: 100,
        h: 101,
        l: 99,
        c: 100,
        v: 10,
        t: timestamp,
      },
    ];

    const renderChart = () => (
      <TradingViewNativeContainer
        source={{
          kind: 'market' as const,
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled' as const,
        }}
        onIntervalChange={handleIntervalChange}
      />
    );
    const { rerender } = render(renderChart());
    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelSubmit: (payload: {
        panel: 'goToDate';
        timestamp: number;
      }) => void;
    };

    act(() => {
      controlsProps.onCalendarPanelSubmit({
        panel: 'goToDate',
        timestamp,
      });
    });

    expect(mockHandleIntervalChange).toHaveBeenCalledWith('60', {
      skipNextHistoryRequest: true,
    });
    expect(handleIntervalChange).toHaveBeenCalledWith({
      fromInterval: '1',
      toInterval: '60',
    });
    expect(mockHandleViewportTargetChange).not.toHaveBeenCalled();

    mockActiveInterval = '60';
    rerender(renderChart());

    expect(mockHandleViewportTargetChange).toHaveBeenCalledWith({
      kind: 'timeRange',
      from: timestamp - halfSevenDays,
      to: timestamp + halfSevenDays,
    });
  });

  it('switches to the V2 adaptive interval before navigating a large time range', () => {
    const from = 1_751_328_000;
    const to = from + 2 * 24 * 60 * 60;
    const handleIntervalChange = jest.fn();
    mockActiveInterval = '1';
    mockDataState = { status: 'stale' };
    mockPoints = [
      {
        o: 100,
        h: 101,
        l: 99,
        c: 100,
        v: 10,
        t: to,
      },
    ];

    const renderChart = () => (
      <TradingViewNativeContainer
        source={{
          kind: 'market' as const,
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled' as const,
        }}
        onIntervalChange={handleIntervalChange}
      />
    );
    const { rerender } = render(renderChart());
    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelSubmit: (payload: {
        panel: 'timeRange';
        from: number;
        to: number;
      }) => void;
    };

    act(() => {
      controlsProps.onCalendarPanelSubmit({
        panel: 'timeRange',
        from,
        to,
      });
    });

    expect(mockHandleIntervalChange).toHaveBeenCalledWith('15', {
      skipNextHistoryRequest: true,
    });
    expect(handleIntervalChange).toHaveBeenCalledWith({
      fromInterval: '1',
      toInterval: '15',
    });
    expect(mockHandleViewportTargetChange).not.toHaveBeenCalled();

    mockActiveInterval = '15';
    rerender(renderChart());

    expect(mockHandleViewportTargetChange).toHaveBeenCalledWith({
      kind: 'timeRange',
      from,
      to,
    });
  });

  it('uses the measured chart width when choosing an adaptive interval', () => {
    const from = 1_751_328_000;
    const to = from + 2 * 24 * 60 * 60;
    mockActiveInterval = '1';
    mockDataState = { status: 'stale' };
    mockPoints = [];

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );
    const chartProps = mockTradingViewNativeChart.mock.calls.at(-1)?.[0] as {
      onChartWidthChange: (width: number) => void;
    };
    act(() => chartProps.onChartWidthChange(320));
    const controlsProps =
      mockTradingViewNativeChartControlsContainer.mock.calls.at(-1)?.[0] as {
        onCalendarPanelSubmit: (payload: {
          panel: 'timeRange';
          from: number;
          to: number;
        }) => void;
      };
    act(() => {
      controlsProps.onCalendarPanelSubmit({
        panel: 'timeRange',
        from,
        to,
      });
    });

    expect(mockHandleIntervalChange).toHaveBeenCalledWith('15', {
      skipNextHistoryRequest: true,
    });
  });

  it('discards a pending calendar target when the data provider changes', () => {
    const from = 1_751_328_000;
    const to = from + 2 * 24 * 60 * 60;
    mockActiveInterval = '1';
    mockDataState = { status: 'stale' };
    mockPoints = [];

    const renderChart = () => (
      <TradingViewNativeContainer
        source={{
          kind: 'market' as const,
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled' as const,
        }}
      />
    );
    const { rerender } = render(renderChart());
    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelSubmit: (payload: {
        panel: 'timeRange';
        from: number;
        to: number;
      }) => void;
    };
    act(() => {
      controlsProps.onCalendarPanelSubmit({
        panel: 'timeRange',
        from,
        to,
      });
    });

    mockDataProviderKey = 'market:evm--1:0xdef:OTHER';
    mockActiveInterval = '15';
    rerender(renderChart());

    expect(mockHandleViewportTargetChange).not.toHaveBeenCalled();
  });

  it('does not replace an interval that is already coarser than the range preset', () => {
    const from = 1_751_328_000;
    const to = from + 2 * 24 * 60 * 60;
    mockActiveInterval = '240';
    mockDataState = { status: 'stale' };
    mockPoints = [
      {
        o: 100,
        h: 101,
        l: 99,
        c: 100,
        v: 10,
        t: to,
      },
    ];

    render(
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'disabled',
        }}
      />,
    );
    const controlsProps = mockTradingViewNativeChartControlsContainer.mock
      .calls[0][0] as {
      onCalendarPanelSubmit: (payload: {
        panel: 'timeRange';
        from: number;
        to: number;
      }) => void;
    };

    controlsProps.onCalendarPanelSubmit({
      panel: 'timeRange',
      from,
      to,
    });

    expect(mockHandleIntervalChange).not.toHaveBeenCalled();
    expect(mockHandleViewportTargetChange).toHaveBeenCalledWith({
      kind: 'timeRange',
      from,
      to,
    });
  });

  it('reports the same latest close rendered by the chart for history and realtime updates', () => {
    const historyPoint = {
      o: 99,
      h: 101,
      l: 98,
      c: 100,
      v: 10,
      t: 1000,
    };
    const realtimePoint = {
      o: 100,
      h: 103,
      l: 99,
      c: 102,
      v: 12,
      t: 2000,
    };
    const handlePriceUpdate = jest.fn();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1500);
    mockDataState = { status: 'stale', lastUpdatedAt: 1500 };
    mockPoints = [historyPoint];

    const renderChart = () => (
      <TradingViewNativeContainer
        source={{
          kind: 'market',
          networkId: 'evm--1',
          tokenAddress: '0xabc',
          symbol: 'TOKEN',
          realtime: 'websocket',
        }}
        onPriceUpdate={handlePriceUpdate}
      />
    );
    const { rerender } = render(renderChart());

    expect(handlePriceUpdate).toHaveBeenLastCalledWith({
      price: historyPoint.c,
      receivedAt: 1500,
      source: 'history',
      timestamp: historyPoint.t,
    });

    handlePriceUpdate.mockClear();
    dateNowSpy.mockReturnValue(2500);
    act(() => {
      mockRealtimePointListener?.(realtimePoint);
      mockDataState = { status: 'live', lastUpdatedAt: 2500 };
      mockPoints = [historyPoint, realtimePoint];
    });
    rerender(renderChart());

    expect(handlePriceUpdate).toHaveBeenCalledTimes(1);
    expect(handlePriceUpdate).toHaveBeenLastCalledWith({
      price: realtimePoint.c,
      receivedAt: 2500,
      source: 'realtime',
      timestamp: realtimePoint.t,
    });

    handlePriceUpdate.mockClear();
    dateNowSpy.mockReturnValue(3000);
    act(() => {
      mockRealtimePointListener?.(realtimePoint);
      mockDataState = { status: 'live', lastUpdatedAt: 3000 };
    });
    rerender(renderChart());

    expect(handlePriceUpdate).toHaveBeenCalledTimes(1);
    expect(handlePriceUpdate).toHaveBeenLastCalledWith({
      price: realtimePoint.c,
      receivedAt: 3000,
      source: 'realtime',
      timestamp: realtimePoint.t,
    });
  });
});
