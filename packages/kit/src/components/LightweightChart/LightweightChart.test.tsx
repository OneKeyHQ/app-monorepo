/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';
import { createChart } from 'lightweight-charts';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { LightweightChart } from './LightweightChart';
import { getChartColorWithAlpha } from './utils/chartColor';
import { createHistogramSeriesPaneView } from './utils/histogramSeries';

import type { IHistogramData } from './utils/histogramSeries';
import type { PaneRendererCustomData, Time } from 'lightweight-charts';
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
      showHorzGridLines,
      horzLineColor,
      horzLineStyle,
      histogramOptions,
      referenceLine,
    }: {
      data: IMarketTokenChart;
      secondaryLineData?: IMarketTokenChart;
      seriesType?: 'area' | 'baseline' | 'dotted-area' | 'histogram';
      lineType?: 'simple' | 'steps';
      priceScalePosition?: 'left' | 'right';
      showHorzGridLines?: boolean;
      horzLineColor?: string;
      horzLineStyle?: number;
      histogramOptions?: {
        positiveColor: string;
        negativeColor: string;
        base?: number;
        barWidthRatio?: number;
        maxBarWidth?: number;
      };
      referenceLine?: {
        price: number;
        color: string;
        lineWidth?: 1 | 2 | 3 | 4;
        lineStyle?: 'solid' | 'dotted' | 'dashed';
        axisLabelVisible?: boolean;
      };
    }) => {
      // Mirrors the real hook: each source array is mapped on its own, so
      // replacing only the overlay leaves the primary data referentially stable.
      const chartData = React.useMemo(
        () =>
          data.map(([time, value]) => ({
            time,
            value,
            ...(seriesType === 'histogram'
              ? {
                  color:
                    value >= (histogramOptions?.base ?? 0)
                      ? histogramOptions?.positiveColor
                      : histogramOptions?.negativeColor,
                }
              : {}),
          })),
        [data, histogramOptions, seriesType],
      );
      const chartSecondaryLineData = React.useMemo(
        () => secondaryLineData?.map(([time, value]) => ({ time, value })),
        [secondaryLineData],
      );
      return React.useMemo(
        () => ({
          theme,
          data: chartData,
          secondaryLineData: chartSecondaryLineData,
          lineWidth: 2,
          showPriceScale: true,
          showHorzGridLines: !!showHorzGridLines,
          horzLineColor,
          horzLineStyle,
          seriesType: seriesType ?? 'area',
          lineType,
          priceScalePosition: priceScalePosition ?? 'right',
          baselineOptions,
          histogramOptions,
          referenceLine,
          showTimeScale: true,
        }),
        [
          chartData,
          chartSecondaryLineData,
          histogramOptions,
          horzLineColor,
          horzLineStyle,
          lineType,
          priceScalePosition,
          referenceLine,
          seriesType,
          showHorzGridLines,
        ],
      );
    },
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
    LineStyle: {
      Solid: 0,
      Dotted: 1,
      Dashed: 2,
      LargeDashed: 3,
      SparseDotted: 4,
    },
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
  let resizeObserverCallback: ResizeObserverCallback | undefined;
  let resizeObserverTarget: Element | undefined;

  beforeEach(() => {
    animationFrameCallbacks = new Map();
    nextAnimationFrameId = 1;
    resizeObserverCallback = undefined;
    resizeObserverTarget = undefined;
    globalThis.requestAnimationFrame = jest.fn((callback) => {
      const id = nextAnimationFrameId;
      nextAnimationFrameId += 1;
      animationFrameCallbacks.set(id, callback);
      return id;
    });
    globalThis.cancelAnimationFrame = jest.fn((id) => {
      if (id !== null && id !== undefined) {
        animationFrameCallbacks.delete(id);
      }
    });
    globalThis.ResizeObserver = class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      observe(target: Element) {
        resizeObserverTarget = target;
      }

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

  it('normalizes alpha hex colors for the chart runtime', () => {
    expect(getChartColorWithAlpha('#008f4acf', 0.82)).toBe(
      'rgba(0, 143, 74, 0.6656)',
    );
    expect(getChartColorWithAlpha('#db0007b7', 0.82)).toBe(
      'rgba(219, 0, 7, 0.5885)',
    );
    expect(getChartColorWithAlpha('#0f08', 0.5)).toBe(
      'rgba(0, 255, 0, 0.2667)',
    );
    expect(getChartColorWithAlpha('#0000001f', 1)).toBe(
      'rgba(0, 0, 0, 0.1216)',
    );
    expect(getChartColorWithAlpha('#ffffff22', 1)).toBe(
      'rgba(255, 255, 255, 0.1333)',
    );
  });

  it('uses the native step mode for baseline series', async () => {
    const createPriceLine = jest.fn();
    const series = {
      createPriceLine,
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
        showHorzGridLines
        horzLineColor="#123456"
        horzLineStyle={1}
        referenceLine={{
          price: 0,
          color: '#555555',
          lineWidth: 1,
          lineStyle: 'dashed',
          axisLabelVisible: false,
        }}
      />,
    );

    await waitFor(() => expect(chart.addSeries).toHaveBeenCalledTimes(1));
    expect(chart.addSeries).toHaveBeenCalledWith(
      'BaselineSeries',
      expect.objectContaining({ lineType: 1, priceScaleId: 'left' }),
    );
    expect(createPriceLine).toHaveBeenCalledWith({
      price: 0,
      color: '#555555',
      lineWidth: 1,
      lineStyle: 2,
      lineVisible: true,
      axisLabelVisible: false,
      title: '',
    });
    expect(createChart).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        grid: {
          vertLines: { visible: false },
          horzLines: {
            visible: true,
            color: '#123456',
            style: 1,
          },
        },
      }),
    );
  });

  it('renders signed histogram points with the configured colors', async () => {
    const series = {
      applyOptions: jest.fn(),
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
          [1, 2],
          [2, -3],
        ]}
        height={240}
        seriesType="histogram"
        histogramOptions={{
          positiveColor: '#00aa00',
          negativeColor: '#ee0000',
          base: 0,
          barWidthRatio: 0.5,
          maxBarWidth: 24,
        }}
      />,
    );

    await waitFor(() => expect(chart.addCustomSeries).toHaveBeenCalledTimes(1));
    expect(chart.addSeries).not.toHaveBeenCalled();
    expect(chart.addCustomSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultOptions: expect.any(Function),
        priceValueBuilder: expect.any(Function),
      }),
      expect.objectContaining({
        base: 0,
        barWidthRatio: 0.5,
        maxBarWidth: 24,
        color: '#00aa00',
        lastValueVisible: false,
        priceLineVisible: false,
      }),
    );
    expect(series.applyOptions).toHaveBeenCalledWith({
      priceScaleId: 'right',
    });
    expect(series.setData).toHaveBeenCalledWith([
      { time: 1, value: 2, color: '#00aa00' },
      { time: 2, value: -3, color: '#ee0000' },
    ]);
  });

  it('draws narrow histogram columns and leaves exact-zero buckets empty', () => {
    const paneView = createHistogramSeriesPaneView();
    const fillStyles: string[] = [];
    const context = {
      fillStyle: '',
      fillRect: jest.fn(),
    };
    context.fillRect.mockImplementation(() => {
      fillStyles.push(context.fillStyle);
    });
    const fillRect = context.fillRect;
    const rendererData: PaneRendererCustomData<Time, IHistogramData> = {
      bars: [
        {
          x: 10,
          time: 0,
          originalData: { time: 1 as Time, value: 0 },
          barColor: '#00aa00',
        },
        {
          x: 30,
          time: 1,
          originalData: { time: 2 as Time, value: 2 },
          barColor: '#00aa00',
        },
        {
          x: 50,
          time: 2,
          originalData: { time: 3 as Time, value: -3 },
          barColor: '#ee0000',
        },
      ],
      barSpacing: 20,
      visibleRange: { from: 0, to: 3 },
      conflationFactor: 1,
    };
    paneView.update(rendererData, {
      ...paneView.defaultOptions(),
      base: 0,
      barWidthRatio: 0.5,
      maxBarWidth: 24,
    });

    const renderer = paneView.renderer();
    type IDrawTarget = Parameters<typeof renderer.draw>[0];
    type IPriceConverter = Parameters<typeof renderer.draw>[1];
    const target = {
      useBitmapCoordinateSpace: (
        draw: (scope: {
          context: { fillStyle: string; fillRect: typeof fillRect };
          horizontalPixelRatio: number;
          verticalPixelRatio: number;
        }) => void,
      ) =>
        draw({
          context,
          horizontalPixelRatio: 1,
          verticalPixelRatio: 1,
        }),
    } as unknown as IDrawTarget;
    const priceConverter = ((value: number) =>
      100 - value * 10) as IPriceConverter;

    renderer.draw(target, priceConverter, false);

    expect(fillRect).toHaveBeenCalledTimes(2);
    expect(fillRect).toHaveBeenNthCalledWith(1, 25, 80, 10, 20);
    expect(fillRect).toHaveBeenNthCalledWith(2, 45, 100, 10, 30);
    expect(fillStyles).toEqual(['#00aa00', '#ee0000']);
  });

  it('resizes the chart height without recreating the chart instance', async () => {
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

    const data = [
      [1, 10],
      [2, 20],
    ] as IMarketTokenChart;
    const { rerender } = render(<LightweightChart data={data} height={240} />);

    await waitFor(() => expect(createChart).toHaveBeenCalledTimes(1));
    rerender(<LightweightChart data={data} height={360} />);
    expect(resizeObserverCallback).toBeDefined();
    expect(resizeObserverTarget).toBeDefined();

    act(() => {
      resizeObserverCallback?.(
        [
          {
            contentRect: { height: 360, width: 600 },
            target: resizeObserverTarget,
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(chart.remove).not.toHaveBeenCalled();
    expect(chart.applyOptions).toHaveBeenCalledWith({
      height: 360,
      width: 600,
    });
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

  it('replaces the overlay data without re-fitting the chart', async () => {
    let visibleTimeRangeListener: (() => void) | undefined;
    const timeToCoordinate = jest.fn(() => 100);
    const priceToCoordinate = jest.fn(() => 50);
    const primarySeries = {
      setData: jest.fn(),
      priceToCoordinate,
    };
    const secondarySeries = {
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
    const addSeries = jest
      .fn()
      .mockReturnValueOnce(primarySeries)
      .mockReturnValue(secondarySeries);
    const chart = {
      addSeries,
      addCustomSeries: jest.fn(() => primarySeries),
      applyOptions: jest.fn(),
      remove: jest.fn(),
      subscribeCrosshairMove: jest.fn(),
      timeScale: jest.fn(() => timeScale),
    };
    jest
      .mocked(createChart)
      .mockReturnValue(chart as unknown as ReturnType<typeof createChart>);

    const data = [
      [1, 10],
      [2, 20],
      [3, 30],
    ] as IMarketTokenChart;
    const fullOverlay = data;
    // What a chart scrubbing its crosshair hands back: the same range, cut at
    // the hovered point.
    const cutOverlay = [
      [1, 10],
      [2, 20],
    ] as IMarketTokenChart;

    const { rerender } = render(
      <LightweightChart
        data={data}
        height={240}
        secondaryLineData={fullOverlay}
        preserveChartInstanceOnDataChange
        pulseLastPoint
      />,
    );

    await waitFor(() => expect(createChart).toHaveBeenCalledTimes(1));
    act(() => {
      flushAnimationFrames();
    });
    expect(screen.getByTestId('chart-pulse-dot')).not.toBeNull();
    const fitContentCallsBeforeScrub = timeScale.fitContent.mock.calls.length;
    const primarySetDataCallsBeforeScrub =
      primarySeries.setData.mock.calls.length;

    rerender(
      <LightweightChart
        data={data}
        height={240}
        secondaryLineData={cutOverlay}
        preserveChartInstanceOnDataChange
        pulseLastPoint
      />,
    );

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(secondarySeries.setData).toHaveBeenLastCalledWith([
      { time: 1, value: 10 },
      { time: 2, value: 20 },
    ]);
    // The main series and the time scale are left alone, so the pulse dot keeps
    // its anchor instead of blinking on every crosshair step.
    expect(primarySeries.setData).toHaveBeenCalledTimes(
      primarySetDataCallsBeforeScrub,
    );
    expect(timeScale.fitContent).toHaveBeenCalledTimes(
      fitContentCallsBeforeScrub,
    );
    expect(screen.getByTestId('chart-pulse-dot')).not.toBeNull();
  });
});
