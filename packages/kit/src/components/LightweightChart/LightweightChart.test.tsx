/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';
import { createChart } from 'lightweight-charts';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { LightweightChart } from './LightweightChart';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockStack = React.forwardRef<
    HTMLDivElement,
    { children?: ReactNode; testID?: string }
  >(({ children, testID }, ref) => (
    <div ref={ref} data-testid={testID}>
      {children}
    </div>
  ));
  MockStack.displayName = 'MockStack';

  return {
    Stack: MockStack,
  };
});

jest.mock('@onekeyhq/shared/src/utils/lazySdkLoader', () => ({
  createLazySdkLoader: (loader: () => Promise<unknown>) => () => loader(),
}));

jest.mock('./hooks/useChartConfig', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const theme = {
    bgColor: 'transparent',
    textSubduedColor: '#666666',
    lineColor: '#00aa00',
    topColor: 'transparent',
    bottomColor: 'transparent',
  };
  const baselineOptions = {};

  return {
    useChartConfig: ({
      data,
      secondaryLineData,
      seriesType,
      lineType,
      priceScalePosition,
    }: {
      data: IMarketTokenChart;
      secondaryLineData?: IMarketTokenChart;
      seriesType?: 'area' | 'baseline' | 'dotted-area';
      lineType?: 'simple' | 'steps';
      priceScalePosition?: 'left' | 'right';
    }) =>
      React.useMemo(
        () => ({
          theme,
          data: data.map(([time, value]) => ({ time, value })),
          secondaryLineData: secondaryLineData?.map(([time, value]) => ({
            time,
            value,
          })),
          lineWidth: 2,
          showPriceScale: true,
          showHorzGridLines: false,
          seriesType: seriesType ?? 'area',
          lineType,
          priceScalePosition: priceScalePosition ?? 'right',
          baselineOptions,
          showTimeScale: true,
        }),
        [data, lineType, priceScalePosition, secondaryLineData, seriesType],
      ),
  };
});

jest.mock('./LightweightChartPulseDot', () => ({
  LightweightChartPulseDot: ({ x, y }: { x: number; y: number }) => (
    <div data-testid="chart-pulse-dot" data-x={x} data-y={y} />
  ),
}));

jest.mock(
  'lightweight-charts',
  () => ({
    AreaSeries: 'AreaSeries',
    BaselineSeries: 'BaselineSeries',
    LineSeries: 'LineSeries',
    LineType: { Simple: 0, WithSteps: 1 },
    createChart: jest.fn(),
  }),
  { virtual: true },
);

describe('LightweightChart', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const originalResizeObserver = globalThis.ResizeObserver;

  let animationFrameCallbacks: Map<number, FrameRequestCallback>;
  let nextAnimationFrameId: number;

  beforeEach(() => {
    animationFrameCallbacks = new Map();
    nextAnimationFrameId = 1;
    globalThis.requestAnimationFrame = jest.fn((callback) => {
      const id = nextAnimationFrameId;
      nextAnimationFrameId += 1;
      animationFrameCallbacks.set(id, callback);
      return id;
    });
    globalThis.cancelAnimationFrame = jest.fn((id) => {
      if (id != null) {
        animationFrameCallbacks.delete(id);
      }
    });
    globalThis.ResizeObserver = class ResizeObserverMock {
      observe() {}

      unobserve() {}

      disconnect() {}
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    globalThis.ResizeObserver = originalResizeObserver;
    jest.resetAllMocks();
  });

  function flushAnimationFrames() {
    const pendingCallbacks = [...animationFrameCallbacks.entries()];
    animationFrameCallbacks.clear();
    pendingCallbacks.forEach(([id, callback]) => callback(id));
  }

  it('uses the native step mode for baseline series', async () => {
    const series = {
      setData: jest.fn(),
      priceToCoordinate: jest.fn(),
    };
    const timeScale = {
      fitContent: jest.fn(),
      subscribeVisibleTimeRangeChange: jest.fn(),
      timeToCoordinate: jest.fn(),
    };
    const chart = {
      addSeries: jest.fn(() => series),
      addCustomSeries: jest.fn(() => series),
      applyOptions: jest.fn(),
      remove: jest.fn(),
      subscribeCrosshairMove: jest.fn(),
      timeScale: jest.fn(() => timeScale),
    };
    jest
      .mocked(createChart)
      .mockReturnValue(chart as unknown as ReturnType<typeof createChart>);

    render(
      <LightweightChart
        data={[
          [1, 10],
          [2, 20],
        ]}
        height={240}
        seriesType="baseline"
        lineType="steps"
        priceScalePosition="left"
      />,
    );

    await waitFor(() => expect(chart.addSeries).toHaveBeenCalledTimes(1));
    expect(chart.addSeries).toHaveBeenCalledWith(
      'BaselineSeries',
      expect.objectContaining({ lineType: 1, priceScaleId: 'left' }),
    );
  });

  it('keeps the pulse dot hidden until updated data finishes layout', async () => {
    let visibleTimeRangeListener: (() => void) | undefined;
    const timeToCoordinate = jest.fn(() => 100);
    const priceToCoordinate = jest.fn(() => 50);
    const series = {
      setData: jest.fn(),
      priceToCoordinate,
    };
    const timeScale = {
      fitContent: jest.fn(() => visibleTimeRangeListener?.()),
      subscribeVisibleTimeRangeChange: jest.fn((listener: () => void) => {
        visibleTimeRangeListener = listener;
      }),
      timeToCoordinate,
    };
    const chart = {
      addSeries: jest.fn(() => series),
      addCustomSeries: jest.fn(() => series),
      applyOptions: jest.fn(),
      remove: jest.fn(),
      subscribeCrosshairMove: jest.fn(),
      timeScale: jest.fn(() => timeScale),
    };
    jest
      .mocked(createChart)
      .mockReturnValue(chart as unknown as ReturnType<typeof createChart>);

    const initialData = [
      [1, 10],
      [2, 20],
    ] as IMarketTokenChart;
    const updatedData = [
      [1, 10],
      [2, 20],
      [3, 30],
    ] as IMarketTokenChart;
    const { rerender } = render(
      <LightweightChart
        data={initialData}
        height={240}
        preserveChartInstanceOnDataChange
        pulseLastPoint
      />,
    );

    await waitFor(() => expect(createChart).toHaveBeenCalledTimes(1));
    expect(timeToCoordinate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('chart-pulse-dot')).toBeNull();

    act(() => {
      flushAnimationFrames();
    });
    expect(timeToCoordinate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('chart-pulse-dot').getAttribute('data-x')).toBe(
      '100',
    );

    rerender(
      <LightweightChart
        data={updatedData}
        height={240}
        preserveChartInstanceOnDataChange
        pulseLastPoint
      />,
    );

    expect(series.setData).toHaveBeenCalledTimes(2);
    expect(timeToCoordinate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('chart-pulse-dot')).toBeNull();

    act(() => {
      flushAnimationFrames();
    });
    expect(timeToCoordinate).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('chart-pulse-dot').getAttribute('data-y')).toBe(
      '50',
    );
  });
});
