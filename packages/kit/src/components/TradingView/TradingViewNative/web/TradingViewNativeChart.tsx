import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { Stack, useTheme, useThemeName } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_DOWN_COLOR as CHART_DOWN_COLOR,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_UP_COLOR as CHART_UP_COLOR,
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_DARK_OPACITY as WATERMARK_DARK_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_LIGHT_OPACITY as WATERMARK_LIGHT_OPACITY,
} from '../chartConstants';
import {
  type ITradingViewNativeIndicatorSeries,
  getTradingViewNativeIndicatorPriceAxisLabel,
} from '../utils/chartIndicators';
import {
  getTradingViewNativeChartWidth,
  getTradingViewNativeCurrentPriceLabel,
  getTradingViewNativePriceAxisLabel,
  getTradingViewNativePriceAxisWidth,
} from '../utils/chartLayout';
import { getTradingViewNativeVolumeAxisLabel } from '../utils/chartLegend';
import {
  type ITradingViewNativeChartRuntimeState,
  createTradingViewNativeChartRuntimeState,
  getTradingViewNativeChartRuntimeVisiblePointRange,
  reduceTradingViewNativeChartRuntime,
} from '../utils/chartRuntime';
import {
  type ITradingViewNativeChartSceneColors,
  buildTradingViewNativeChartScene,
} from '../utils/chartScene';
import {
  type ITradingViewNativeViewportRequest,
  type ITradingViewNativeVisiblePointRange,
  getTradingViewNativeDataUpdateMetadata,
  getTradingViewNativeViewportPointRange,
} from '../utils/chartViewport';
import { getTradingViewNativeSubIndicatorAxisLabel } from '../utils/subIndicatorRender/coordinates';

import {
  drawTradingViewNativeCanvasScene,
  getTradingViewNativeCanvasFont,
} from './chartCanvasRenderer';
import {
  TradingViewNativeWheelDeltaNormalizer,
  getTradingViewNativeWheelPanOffsetDelta,
  getTradingViewNativeWheelZoomAnchorX,
  getTradingViewNativeWheelZoomScale,
} from './chartWheel';

import type {
  ITradingViewNativeCandleLabels,
  ITradingViewNativeChartType,
  ITradingViewNativeInitialRightOffset,
} from '../types';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

const ONEKEY_WATERMARK_ASSET =
  require('@onekeyhq/components/svg/illus/logo.svg') as
    | string
    | { default: string };
const ONEKEY_WATERMARK_URI =
  typeof ONEKEY_WATERMARK_ASSET === 'string'
    ? ONEKEY_WATERMARK_ASSET
    : ONEKEY_WATERMARK_ASSET.default;

interface ITradingViewNativeChartProps {
  candleIntervalSeconds: number;
  chartType: ITradingViewNativeChartType;
  chartPictureVersion: number;
  hasVolume: boolean;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
  isSwitchingInterval: boolean;
  onChartWidthChange?: (width: number) => void;
  onViewportRequestApplied?: (requestId: number) => void;
  onVisiblePointRangeChange?: (
    range: ITradingViewNativeVisiblePointRange,
  ) => void;
  candleLabels: ITradingViewNativeCandleLabels;
  points: IMarketTokenKLineDataPoint[];
  subIndicatorPanes?: readonly ITradingViewNativeSubIndicatorRenderPane[];
  testID?: string;
  viewportRequest?: ITradingViewNativeViewportRequest | null;
}

interface IPointerDragState {
  currentClientX: number;
  pointerId: number;
  startClientX: number;
  startOffset: number;
  zoomScale: number;
}

interface IDrawKLineChartOptions {
  candleIntervalSeconds: number;
  canvas: HTMLCanvasElement;
  chartType: ITradingViewNativeChartType;
  colors: ITradingViewNativeChartSceneColors;
  hasVolume: boolean;
  candleLabels: ITradingViewNativeCandleLabels;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  points: IMarketTokenKLineDataPoint[];
  priceAxisWidth: number;
  runtimeState: ITradingViewNativeChartRuntimeState;
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  watermarkImage: HTMLImageElement | null;
  watermarkOpacity: number;
}

interface ICanvasPriceAxisLabels {
  currentPrice: string;
  widestIndicatorPrice: string;
  widestPrice: string;
  widestSubIndicator: string;
  widestVolume: string;
}

function getCanvasPriceAxisWidth(
  canvas: HTMLCanvasElement,
  labels: ICanvasPriceAxisLabels,
) {
  const context = canvas.getContext('2d');
  if (!context) {
    return getTradingViewNativePriceAxisWidth({
      currentPriceLabelWidth: 0,
      widestPriceLabelWidth: 0,
    });
  }
  context.font = getTradingViewNativeCanvasFont('priceAxis');
  return getTradingViewNativePriceAxisWidth({
    currentPriceLabelWidth: context.measureText(labels.currentPrice).width,
    widestPriceLabelWidth: Math.max(
      context.measureText(labels.widestPrice).width,
      context.measureText(labels.widestIndicatorPrice).width,
      context.measureText(labels.widestSubIndicator).width,
    ),
    widestVolumeLabelWidth: context.measureText(labels.widestVolume).width,
  });
}

function getCanvasChartWidth(
  canvas: HTMLCanvasElement,
  labels: ICanvasPriceAxisLabels,
) {
  return getTradingViewNativeChartWidth(
    canvas.getBoundingClientRect().width,
    getCanvasPriceAxisWidth(canvas, labels),
  );
}

function drawKLineChart({
  candleIntervalSeconds,
  canvas,
  chartType,
  colors,
  hasVolume,
  candleLabels,
  indicatorSeries,
  points,
  priceAxisWidth,
  runtimeState,
  subIndicatorPanes,
  watermarkImage,
  watermarkOpacity,
}: IDrawKLineChartOptions) {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  if (width <= 0 || height <= 0) {
    return;
  }
  const pixelRatio = Math.max(globalThis.devicePixelRatio || 1, 1);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const scene = buildTradingViewNativeChartScene({
    candleIntervalSeconds,
    chartType,
    crosshair: runtimeState.crosshair,
    hasVolume,
    height,
    indicatorSeries,
    measureTextWidth: (text, font) => {
      context.font = getTradingViewNativeCanvasFont(font);
      return context.measureText(text).width;
    },
    candleLabels,
    points,
    priceAxisWidth,
    subIndicatorPanes,
    viewport: runtimeState.viewport,
    watermarkOpacity,
    width,
  });
  drawTradingViewNativeCanvasScene({
    colors,
    commands: scene.commands,
    context,
    customPaintStyles: scene.customPaintStyles,
    watermarkImage,
  });
}

export const TradingViewNativeChart = memo(
  ({
    candleIntervalSeconds,
    chartType,
    hasVolume,
    indicatorSeries,
    initialRightOffset,
    isSwitchingInterval,
    onChartWidthChange,
    onViewportRequestApplied,
    onVisiblePointRangeChange,
    candleLabels,
    points,
    subIndicatorPanes = [],
    testID,
    viewportRequest,
  }: ITradingViewNativeChartProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const runtimeStateRef = useRef<ITradingViewNativeChartRuntimeState>(
      createTradingViewNativeChartRuntimeState({
        initialRightOffset,
      }),
    );
    const pointerDragStateRef = useRef<IPointerDragState | null>(null);
    const wheelDeltaNormalizerRef = useRef(
      new TradingViewNativeWheelDeltaNormalizer(),
    );
    const appliedViewportRequestRef = useRef({
      chartWidth: 0,
      requestId: 0,
    });
    const [watermarkImage, setWatermarkImage] =
      useState<HTMLImageElement | null>(null);
    const [measuredChartWidth, setMeasuredChartWidth] = useState(0);
    const [webFontMeasureVersion, setWebFontMeasureVersion] = useState(0);
    const [viewportState, setViewportState] = useState(
      () => runtimeStateRef.current.viewport,
    );
    const panOffset = viewportState.offset;
    const zoomScale = viewportState.zoomScale;
    const pointCount = points.length;
    const priceAxisLabels = useMemo(
      () => ({
        currentPrice: getTradingViewNativeCurrentPriceLabel(points),
        widestIndicatorPrice:
          getTradingViewNativeIndicatorPriceAxisLabel(indicatorSeries),
        widestPrice: getTradingViewNativePriceAxisLabel(points),
        widestSubIndicator:
          getTradingViewNativeSubIndicatorAxisLabel(subIndicatorPanes),
        widestVolume: hasVolume
          ? getTradingViewNativeVolumeAxisLabel(points)
          : '',
      }),
      [hasVolume, indicatorSeries, points, subIndicatorPanes],
    );
    const previousLatestTimestampRef = useRef<number | undefined>(
      points[pointCount - 1]?.t,
    );
    const theme = useTheme();
    const themeName = useThemeName();
    const background = theme.transparent.val;
    const grid = theme.borderSubdued.val;
    const axisText = theme.textSubdued.val;
    const line = theme.text.val;
    const watermarkOpacity =
      themeName === 'dark' ? WATERMARK_DARK_OPACITY : WATERMARK_LIGHT_OPACITY;

    useEffect(() => {
      onChartWidthChange?.(measuredChartWidth);
    }, [measuredChartWidth, onChartWidthChange]);

    useEffect(() => {
      const fontSet = document.fonts;
      if (!fontSet) {
        return undefined;
      }

      let isActive = true;
      const refreshMeasurement = () => {
        if (isActive) {
          setWebFontMeasureVersion((currentVersion) => currentVersion + 1);
        }
      };

      void fontSet
        .load(getTradingViewNativeCanvasFont('priceAxis'))
        .then(refreshMeasurement, refreshMeasurement);
      fontSet.addEventListener?.('loadingdone', refreshMeasurement);

      return () => {
        isActive = false;
        fontSet.removeEventListener?.('loadingdone', refreshMeasurement);
      };
    }, []);

    useEffect(() => {
      const image = new Image();
      let isActive = true;
      image.onload = () => {
        if (isActive) {
          setWatermarkImage(image);
        }
      };
      image.src = ONEKEY_WATERMARK_URI;
      return () => {
        isActive = false;
        image.onload = null;
      };
    }, []);

    const renderChart = useCallback(
      (nextRuntimeState: ITradingViewNativeChartRuntimeState) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const priceAxisWidth = getCanvasPriceAxisWidth(canvas, priceAxisLabels);
        drawKLineChart({
          candleIntervalSeconds,
          canvas,
          chartType,
          colors: {
            axisText,
            background,
            down: CHART_DOWN_COLOR,
            grid,
            line,
            up: CHART_UP_COLOR,
          },
          hasVolume,
          candleLabels,
          indicatorSeries,
          points,
          priceAxisWidth,
          runtimeState: nextRuntimeState,
          subIndicatorPanes,
          watermarkImage,
          watermarkOpacity,
        });
      },
      [
        axisText,
        background,
        candleIntervalSeconds,
        chartType,
        grid,
        hasVolume,
        indicatorSeries,
        line,
        candleLabels,
        points,
        priceAxisLabels,
        subIndicatorPanes,
        watermarkImage,
        watermarkOpacity,
      ],
    );

    useLayoutEffect(() => {
      const dataUpdateMetadata = getTradingViewNativeDataUpdateMetadata({
        points,
        previousLatestTimestamp: previousLatestTimestampRef.current,
      });
      previousLatestTimestampRef.current = dataUpdateMetadata.latestTimestamp;

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const chartWidth = getCanvasChartWidth(canvas, priceAxisLabels);
      const runtimeAfterInitialMeasure = reduceTradingViewNativeChartRuntime(
        runtimeStateRef.current,
        {
          type: 'initialWidthMeasured',
          width: canvas.clientWidth,
        },
      );
      runtimeStateRef.current = runtimeAfterInitialMeasure;
      const runtimeEvent = {
        appendedPointCount: dataUpdateMetadata.appendedPointCount,
        chartWidth,
        pointCount,
        type: 'dataUpdated' as const,
      };
      const dragState = pointerDragStateRef.current;
      if (dragState) {
        dragState.startOffset = reduceTradingViewNativeChartRuntime(
          {
            ...runtimeAfterInitialMeasure,
            viewport: {
              ...runtimeAfterInitialMeasure.viewport,
              offset: dragState.startOffset,
              zoomScale: dragState.zoomScale,
            },
          },
          runtimeEvent,
        ).viewport.offset;
      }
      const nextRuntimeState = reduceTradingViewNativeChartRuntime(
        runtimeAfterInitialMeasure,
        runtimeEvent,
      );
      runtimeStateRef.current = nextRuntimeState;
      setViewportState((currentState) =>
        currentState.offset === nextRuntimeState.viewport.offset
          ? currentState
          : nextRuntimeState.viewport,
      );
    }, [pointCount, points, priceAxisLabels]);

    useLayoutEffect(() => {
      if (
        !viewportRequest ||
        (viewportRequest.requestId ===
          appliedViewportRequestRef.current.requestId &&
          measuredChartWidth ===
            appliedViewportRequestRef.current.chartWidth) ||
        measuredChartWidth <= 0 ||
        pointCount <= 0
      ) {
        return;
      }
      const pointRange = getTradingViewNativeViewportPointRange({
        points,
        target: viewportRequest.target,
      });
      if (!pointRange) {
        return;
      }
      const nextRuntimeState = reduceTradingViewNativeChartRuntime(
        runtimeStateRef.current,
        {
          chartWidth: measuredChartWidth,
          pointCount,
          pointRange,
          type: 'viewportRequested',
        },
      );
      const nextViewport = nextRuntimeState.viewport;
      if (
        !Number.isFinite(nextViewport.offset) ||
        !Number.isFinite(nextViewport.zoomScale)
      ) {
        return;
      }

      appliedViewportRequestRef.current = {
        chartWidth: measuredChartWidth,
        requestId: viewportRequest.requestId,
      };
      runtimeStateRef.current = nextRuntimeState;
      const dragState = pointerDragStateRef.current;
      if (viewportRequest.preserveVisibleAnchor && dragState) {
        dragState.startClientX = dragState.currentClientX;
        dragState.startOffset = nextViewport.offset;
        dragState.zoomScale = nextViewport.zoomScale;
      } else {
        pointerDragStateRef.current = null;
      }
      setViewportState(nextViewport);
      onViewportRequestApplied?.(viewportRequest.requestId);
    }, [
      measuredChartWidth,
      onViewportRequestApplied,
      pointCount,
      points,
      viewportRequest,
    ]);

    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return undefined;
      }
      const renderCurrentChart = () => {
        const currentRuntimeState = runtimeStateRef.current;
        const measuredRuntimeState = reduceTradingViewNativeChartRuntime(
          currentRuntimeState,
          {
            type: 'initialWidthMeasured',
            width: canvas.clientWidth,
          },
        );
        if (measuredRuntimeState !== currentRuntimeState) {
          runtimeStateRef.current = measuredRuntimeState;
          setViewportState(measuredRuntimeState.viewport);
        }
        renderChart(measuredRuntimeState);
        const nextChartWidth = getCanvasChartWidth(canvas, priceAxisLabels);
        setMeasuredChartWidth((currentWidth) =>
          currentWidth === nextChartWidth ? currentWidth : nextChartWidth,
        );
      };
      renderCurrentChart();
      const resizeObserver = new ResizeObserver(renderCurrentChart);
      resizeObserver.observe(canvas);
      return () => {
        resizeObserver.disconnect();
      };
    }, [
      panOffset,
      priceAxisLabels,
      renderChart,
      webFontMeasureVersion,
      zoomScale,
    ]);

    useEffect(() => {
      if (measuredChartWidth <= 0 || pointCount <= 0) {
        return;
      }
      onVisiblePointRangeChange?.(
        getTradingViewNativeChartRuntimeVisiblePointRange({
          chartWidth: measuredChartWidth,
          pointCount,
          state: runtimeStateRef.current,
        }),
      );
    }, [
      measuredChartWidth,
      onVisiblePointRangeChange,
      panOffset,
      pointCount,
      zoomScale,
    ]);

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (event.button !== 0) {
          return;
        }
        const chartWidth = getCanvasChartWidth(
          event.currentTarget,
          priceAxisLabels,
        );
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(
          runtimeStateRef.current,
          {
            chartWidth,
            hideCrosshair: true,
            offset: runtimeStateRef.current.viewport.offset,
            pointCount,
            type: 'panMoved',
          },
        );
        runtimeStateRef.current = nextRuntimeState;
        renderChart(nextRuntimeState);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          return;
        }
        pointerDragStateRef.current = {
          currentClientX: event.clientX,
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startOffset: nextRuntimeState.viewport.offset,
          zoomScale: nextRuntimeState.viewport.zoomScale,
        };
      },
      [pointCount, priceAxisLabels, renderChart],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const dragState = pointerDragStateRef.current;
        if (!dragState) {
          const canvasRect = event.currentTarget.getBoundingClientRect();
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtimeStateRef.current,
            {
              chartWidth: getCanvasChartWidth(
                event.currentTarget,
                priceAxisLabels,
              ),
              height: canvasRect.height,
              pointCount,
              type: 'crosshairMoved',
              x: event.clientX - canvasRect.left,
              y: event.clientY - canvasRect.top,
            },
          );
          runtimeStateRef.current = nextRuntimeState;
          renderChart(nextRuntimeState);
          return;
        }
        if (dragState.pointerId !== event.pointerId) {
          return;
        }
        event.preventDefault();
        dragState.currentClientX = event.clientX;
        const chartWidth = getCanvasChartWidth(
          event.currentTarget,
          priceAxisLabels,
        );
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(
          runtimeStateRef.current,
          {
            chartWidth,
            hideCrosshair: true,
            offset:
              dragState.startOffset + event.clientX - dragState.startClientX,
            pointCount,
            type: 'panMoved',
            zoomScale: dragState.zoomScale,
          },
        );
        runtimeStateRef.current = nextRuntimeState;
        renderChart(nextRuntimeState);
        setViewportState((currentState) =>
          currentState.offset === nextRuntimeState.viewport.offset &&
          currentState.zoomScale === nextRuntimeState.viewport.zoomScale
            ? currentState
            : nextRuntimeState.viewport,
        );
      },
      [pointCount, priceAxisLabels, renderChart],
    );

    const handlePointerLeave = useCallback(() => {
      if (pointerDragStateRef.current) {
        return;
      }
      const nextRuntimeState = reduceTradingViewNativeChartRuntime(
        runtimeStateRef.current,
        {
          type: 'crosshairHidden',
        },
      );
      runtimeStateRef.current = nextRuntimeState;
      renderChart(nextRuntimeState);
    }, [renderChart]);

    const finishPointerDrag = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (pointerDragStateRef.current?.pointerId !== event.pointerId) {
          return;
        }
        pointerDragStateRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
      [],
    );

    const handleWheel = useCallback(
      (event: WheelEvent) => {
        const canvas = canvasRef.current;
        if (!canvas || pointCount <= 0) {
          return;
        }
        const isMacOS = Boolean(platformEnv.isRuntimeMacOSBrowser);
        const wheelDelta = wheelDeltaNormalizerRef.current.processWheel({
          deltaMode: event.deltaMode,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          isMacOS,
          shiftKey: event.shiftKey,
          timeStamp: event.timeStamp,
        });
        if (wheelDelta.deltaX === 0 && wheelDelta.deltaY === 0) {
          return;
        }
        event.preventDefault();

        const canvasRect = canvas.getBoundingClientRect();
        const chartWidth = getCanvasChartWidth(canvas, priceAxisLabels);
        const currentRuntimeState = runtimeStateRef.current;
        let nextRuntimeState = currentRuntimeState;
        if (wheelDelta.deltaY !== 0) {
          const cursorX =
            event.clientX - canvasRect.left - CHART_HORIZONTAL_PADDING;
          nextRuntimeState = reduceTradingViewNativeChartRuntime(
            nextRuntimeState,
            {
              anchorX: getTradingViewNativeWheelZoomAnchorX({
                chartWidth,
                ctrlKey: event.ctrlKey,
                cursorX,
                isMacOS,
                metaKey: event.metaKey,
              }),
              chartWidth,
              nextZoomScale: getTradingViewNativeWheelZoomScale({
                currentZoomScale: nextRuntimeState.viewport.zoomScale,
                deltaY: wheelDelta.deltaY,
              }),
              pointCount,
              type: 'zoomed',
            },
          );
        }
        if (wheelDelta.deltaX !== 0) {
          nextRuntimeState = reduceTradingViewNativeChartRuntime(
            nextRuntimeState,
            {
              chartWidth,
              offset:
                nextRuntimeState.viewport.offset +
                getTradingViewNativeWheelPanOffsetDelta(wheelDelta.deltaX),
              pointCount,
              type: 'panMoved',
            },
          );
        }
        runtimeStateRef.current = nextRuntimeState;
        setViewportState((currentState) =>
          currentState.offset === nextRuntimeState.viewport.offset &&
          currentState.zoomScale === nextRuntimeState.viewport.zoomScale
            ? currentState
            : nextRuntimeState.viewport,
        );
      },
      [pointCount, priceAxisLabels],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return undefined;
      }
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', handleWheel);
      };
    }, [handleWheel]);

    return (
      <Stack
        flex={1}
        minHeight={0}
        opacity={isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1}
      >
        <canvas
          ref={canvasRef}
          data-testid={testID}
          onLostPointerCapture={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          style={{
            cursor: 'crosshair',
            display: 'block',
            height: '100%',
            touchAction: 'pan-y',
            userSelect: 'none',
            width: '100%',
          }}
        />
      </Stack>
    );
  },
);

TradingViewNativeChart.displayName = 'TradingViewNativeChart';
