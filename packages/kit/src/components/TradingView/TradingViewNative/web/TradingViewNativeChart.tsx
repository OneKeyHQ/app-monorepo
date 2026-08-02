import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { Stack, useTheme, useThemeName } from '@onekeyhq/components';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE as AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_CHART_DOWN_COLOR as CHART_DOWN_COLOR,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_UP_COLOR as CHART_UP_COLOR,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE as LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_DARK_OPACITY as WATERMARK_DARK_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_LIGHT_OPACITY as WATERMARK_LIGHT_OPACITY,
} from '../chartConstants';
import { getTradingViewNativeChartWidth } from '../utils/chartLayout';
import {
  type ITradingViewNativeChartRuntimeState,
  createTradingViewNativeChartRuntimeState,
  getTradingViewNativeChartRuntimeVisiblePointRange,
  reduceTradingViewNativeChartRuntime,
} from '../utils/chartRuntime';
import {
  type ITradingViewNativeChartSceneColors,
  type ITradingViewNativeChartSceneCommand,
  type ITradingViewNativeChartSceneFont,
  buildTradingViewNativeChartScene,
  getTradingViewNativeChartScenePaintStyles,
} from '../utils/chartScene';
import {
  type ITradingViewNativeViewportRequest,
  type ITradingViewNativeVisiblePointRange,
  getTradingViewNativeDataUpdateMetadata,
  getTradingViewNativeViewportPointRange,
} from '../utils/chartViewport';

import type { ITradingViewNativeChartType } from '../types';

const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_DELTA_LINE_HEIGHT = 16;
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
  isSwitchingInterval: boolean;
  onChartWidthChange?: (width: number) => void;
  onViewportRequestApplied?: (requestId: number) => void;
  onVisiblePointRangeChange?: (
    range: ITradingViewNativeVisiblePointRange,
  ) => void;
  points: IMarketTokenKLineDataPoint[];
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
  points: IMarketTokenKLineDataPoint[];
  runtimeState: ITradingViewNativeChartRuntimeState;
  watermarkImage: HTMLImageElement | null;
  watermarkOpacity: number;
}

function getCanvasChartWidth(canvas: HTMLCanvasElement) {
  return getTradingViewNativeChartWidth(canvas.getBoundingClientRect().width);
}

function getWheelDeltaYInPixels(event: WheelEvent, canvas: HTMLCanvasElement) {
  if (event.deltaMode === WHEEL_DELTA_MODE_LINE) {
    return event.deltaY * WHEEL_DELTA_LINE_HEIGHT;
  }
  if (event.deltaMode === WHEEL_DELTA_MODE_PAGE) {
    return event.deltaY * canvas.clientHeight;
  }
  return event.deltaY;
}

function getCanvasFont(font: ITradingViewNativeChartSceneFont) {
  return `${font === 'axis' ? AXIS_FONT_SIZE : LEGEND_FONT_SIZE}px sans-serif`;
}

function drawChartScene({
  colors,
  commands,
  context,
  watermarkImage,
}: {
  colors: ITradingViewNativeChartSceneColors;
  commands: ITradingViewNativeChartSceneCommand[];
  context: CanvasRenderingContext2D;
  watermarkImage: HTMLImageElement | null;
}) {
  const paintStyles = getTradingViewNativeChartScenePaintStyles(colors);
  for (const command of commands) {
    switch (command.kind) {
      case 'circle': {
        const paint = paintStyles[command.paint];
        context.save();
        context.globalAlpha = paint.opacity;
        context.fillStyle = paint.color;
        context.beginPath();
        context.arc(command.cx, command.cy, command.radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
        break;
      }
      case 'clip':
        context.save();
        context.beginPath();
        context.rect(
          command.rect.x,
          command.rect.y,
          command.rect.width,
          command.rect.height,
        );
        context.clip();
        break;
      case 'line': {
        const paint = paintStyles[command.paint];
        context.save();
        context.globalAlpha = paint.opacity;
        context.strokeStyle = paint.color;
        context.lineWidth = paint.strokeWidth ?? 1;
        context.lineCap = paint.strokeCap ?? 'butt';
        context.lineJoin = paint.strokeJoin ?? 'miter';
        context.setLineDash(paint.dash ?? []);
        context.beginPath();
        context.moveTo(command.x1, command.y1);
        context.lineTo(command.x2, command.y2);
        context.stroke();
        context.restore();
        break;
      }
      case 'polyline': {
        const firstPoint = command.points[0];
        if (!firstPoint) {
          break;
        }
        const paint = paintStyles[command.paint];
        context.save();
        context.globalAlpha = paint.opacity;
        context.strokeStyle = paint.color;
        context.lineWidth = paint.strokeWidth ?? 1;
        context.lineCap = paint.strokeCap ?? 'butt';
        context.lineJoin = paint.strokeJoin ?? 'miter';
        context.setLineDash(paint.dash ?? []);
        context.beginPath();
        context.moveTo(firstPoint.x, firstPoint.y);
        for (let index = 1; index < command.points.length; index += 1) {
          const point = command.points[index];
          context.lineTo(point.x, point.y);
        }
        context.stroke();
        context.restore();
        break;
      }
      case 'rect': {
        const paint = paintStyles[command.paint];
        context.save();
        context.globalAlpha = paint.opacity;
        context.fillStyle = paint.color;
        context.fillRect(command.x, command.y, command.width, command.height);
        context.restore();
        break;
      }
      case 'restore':
        context.restore();
        break;
      case 'text': {
        const paint = paintStyles[command.paint];
        context.save();
        context.globalAlpha = paint.opacity;
        context.fillStyle = paint.color;
        context.font = getCanvasFont(command.font);
        context.textAlign = 'left';
        context.textBaseline = 'alphabetic';
        context.fillText(command.text, command.x, command.y);
        context.restore();
        break;
      }
      case 'watermark':
        if (watermarkImage) {
          context.save();
          context.globalAlpha = command.opacity;
          context.drawImage(
            watermarkImage,
            command.rect.x,
            command.rect.y,
            command.rect.width,
            command.rect.height,
          );
          context.restore();
        }
        break;
      default:
        command satisfies never;
    }
  }
}

function drawKLineChart({
  candleIntervalSeconds,
  canvas,
  chartType,
  colors,
  points,
  runtimeState,
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
    height,
    measureTextWidth: (text, font) => {
      context.font = getCanvasFont(font);
      return context.measureText(text).width;
    },
    points,
    viewport: runtimeState.viewport,
    watermarkOpacity,
    width,
  });
  drawChartScene({
    colors,
    commands: scene.commands,
    context,
    watermarkImage,
  });
}

export const TradingViewNativeChart = memo(
  ({
    candleIntervalSeconds,
    chartType,
    isSwitchingInterval,
    onChartWidthChange,
    onViewportRequestApplied,
    onVisiblePointRangeChange,
    points,
    testID,
    viewportRequest,
  }: ITradingViewNativeChartProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const runtimeStateRef = useRef<ITradingViewNativeChartRuntimeState>(
      createTradingViewNativeChartRuntimeState(),
    );
    const pointerDragStateRef = useRef<IPointerDragState | null>(null);
    const appliedViewportRequestRef = useRef({
      chartWidth: 0,
      requestId: 0,
    });
    const [watermarkImage, setWatermarkImage] =
      useState<HTMLImageElement | null>(null);
    const [measuredChartWidth, setMeasuredChartWidth] = useState(0);
    const [viewportState, setViewportState] = useState(
      () => runtimeStateRef.current.viewport,
    );
    const panOffset = viewportState.offset;
    const zoomScale = viewportState.zoomScale;
    const pointCount = points.length;
    const previousLatestTimestampRef = useRef<number | undefined>(
      points[pointCount - 1]?.t,
    );
    const theme = useTheme();
    const themeName = useThemeName();
    const background = theme.bgApp.val;
    const grid = theme.borderSubdued.val;
    const axisText = theme.textSubdued.val;
    const line = theme.text.val;
    const watermarkOpacity =
      themeName === 'dark' ? WATERMARK_DARK_OPACITY : WATERMARK_LIGHT_OPACITY;

    useEffect(() => {
      onChartWidthChange?.(measuredChartWidth);
    }, [measuredChartWidth, onChartWidthChange]);

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
          points,
          runtimeState: nextRuntimeState,
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
        line,
        points,
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
      const chartWidth = getCanvasChartWidth(canvas);
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
            ...runtimeStateRef.current,
            viewport: {
              offset: dragState.startOffset,
              zoomScale: dragState.zoomScale,
            },
          },
          runtimeEvent,
        ).viewport.offset;
      }
      const nextRuntimeState = reduceTradingViewNativeChartRuntime(
        runtimeStateRef.current,
        runtimeEvent,
      );
      runtimeStateRef.current = nextRuntimeState;
      setViewportState((currentState) =>
        currentState.offset === nextRuntimeState.viewport.offset
          ? currentState
          : nextRuntimeState.viewport,
      );
    }, [pointCount, points]);

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
        renderChart(runtimeStateRef.current);
        const nextChartWidth = getCanvasChartWidth(canvas);
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
    }, [panOffset, renderChart, zoomScale]);

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
        const chartWidth = getCanvasChartWidth(event.currentTarget);
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
      [pointCount, renderChart],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const dragState = pointerDragStateRef.current;
        if (!dragState) {
          const canvasRect = event.currentTarget.getBoundingClientRect();
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtimeStateRef.current,
            {
              height: canvasRect.height,
              pointCount,
              type: 'crosshairMoved',
              width: canvasRect.width,
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
        const chartWidth = getCanvasChartWidth(event.currentTarget);
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
      [pointCount, renderChart],
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
        event.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const canvasRect = canvas.getBoundingClientRect();
        const chartWidth = getCanvasChartWidth(canvas);
        const deltaY = getWheelDeltaYInPixels(event, canvas);
        const anchorX =
          event.clientX - canvasRect.left - CHART_HORIZONTAL_PADDING;
        const currentRuntimeState = runtimeStateRef.current;
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(
          currentRuntimeState,
          {
            anchorX,
            chartWidth,
            nextZoomScale:
              currentRuntimeState.viewport.zoomScale *
              Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY),
            pointCount,
            type: 'zoomed',
          },
        );
        runtimeStateRef.current = nextRuntimeState;
        setViewportState((currentState) =>
          currentState.offset === nextRuntimeState.viewport.offset &&
          currentState.zoomScale === nextRuntimeState.viewport.zoomScale
            ? currentState
            : nextRuntimeState.viewport,
        );
      },
      [pointCount],
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
