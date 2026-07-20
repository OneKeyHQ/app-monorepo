/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { TradingViewNativeContainer } from './TradingViewNativeContainer';

const mockHandleRetry = jest.fn();
let mockDataProviderKey = 'market:evm--1:0xabc:TOKEN';
let mockDataState: { error?: Error; status: string };
let mockPoints: IMarketTokenKLineDataPoint[];
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
      candleIntervalSeconds: 3600,
      dataProviderKey: mockDataProviderKey,
      dataState: mockDataState,
      handleIntervalChange: jest.fn(),
      handleRetry: mockHandleRetry,
      handleVisiblePointRangeChange: jest.fn(),
      intervalConfig: { activeInterval: '60', intervals: [] },
      isSwitchingInterval: false,
      points: mockPoints,
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
  TradingViewNativeChart: () => <div />,
}));

jest.mock('./TradingViewNativeChartControlsContainer', () => ({
  TradingViewNativeChartControlsContainer: () => null,
}));

describe('TradingViewNativeContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataProviderKey = 'market:evm--1:0xabc:TOKEN';
    mockDataState = {
      status: 'error',
      error: new Error('history unavailable'),
    };
    mockPoints = [];
    mockRealtimePointListener = undefined;
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
    mockDataState = { status: 'stale' };
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
      source: 'history',
      timestamp: historyPoint.t,
    });

    handlePriceUpdate.mockClear();
    act(() => {
      mockRealtimePointListener?.(realtimePoint);
      mockDataState = { status: 'live' };
      mockPoints = [historyPoint, realtimePoint];
    });
    rerender(renderChart());

    expect(handlePriceUpdate).toHaveBeenCalledTimes(1);
    expect(handlePriceUpdate).toHaveBeenLastCalledWith({
      price: realtimePoint.c,
      source: 'realtime',
      timestamp: realtimePoint.t,
    });
  });
});
