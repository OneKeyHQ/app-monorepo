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
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
  TRADING_VIEW_NATIVE_WATERMARK_DARK_OPACITY as WATERMARK_DARK_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_LIGHT_OPACITY as WATERMARK_LIGHT_OPACITY,
} from '../chartConstants';
import {
  type ITradingViewNativeIndicatorSeries,
  getTradingViewNativeIndicatorPriceAxisLabel,
} from '../utils/chartIndicators';
import { getTradingViewNativePriceAxisLabel } from '../utils/chartLayout';
import { getTradingViewNativeVolumeAxisLabel } from '../utils/chartLegend';
import {
  type ITradingViewNativeChartRuntimeState,
  createTradingViewNativeChartRuntimeState,
  getTradingViewNativeChartRuntimeVisiblePointRange,
  reduceTradingViewNativeChartRuntime,
} from '../utils/chartRuntime';
import {
  type ITradingViewNativeViewportRequest,
  type ITradingViewNativeVisiblePointRange,
  getTradingViewNativeDataUpdateMetadata,
  getTradingViewNativeViewportPointRange,
} from '../utils/chartViewport';
import { getTradingViewNativeMainPriceAxisLayout } from '../utils/priceAxisScale';
import { getTradingViewNativeSubIndicatorAxisLabel } from '../utils/subIndicatorRender/coordinates';

import {
  type ITradingViewNativeCanvasPriceAxisLabels,
  getTradingViewNativeCanvasChartWidth,
  getTradingViewNativeCanvasPriceAxisWidth,
} from './chartCanvasLayout';
import { getTradingViewNativeCanvasFont } from './chartCanvasRenderer';
import {
  TradingViewNativeWheelDeltaNormalizer,
  getTradingViewNativeWheelPanOffsetDelta,
  getTradingViewNativeWheelZoomAnchorX,
  getTradingViewNativeWheelZoomScale,
} from './chartWheel';
import { drawTradingViewNativeCanvasChart } from './drawTradingViewNativeCanvasChart';
import { TradingViewNativePriceScaleControls } from './TradingViewNativePriceScaleControls';
import {
  createTradingViewNativeWebPriceScaleModel,
  useTradingViewNativePriceScale,
} from './useTradingViewNativePriceScale';

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
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  chartPictureVersion: number;
  currentPriceLabel: string;
  hasVolume: boolean;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  indicatorSeriesSettingsKey: string;
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

interface IPointerPanDragState {
  currentClientX: number;
  pointerId: number;
  startClientX: number;
  startOffset: number;
  zoomScale: number;
}

export const TradingViewNativeChart = memo(
  ({
    candleIntervalSeconds,
    chartSettings,
    chartType,
    hasVolume,
    indicatorSeries,
    initialRightOffset,
    isSwitchingInterval,
    currentPriceLabel,
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
    const pointerPanDragStateRef = useRef<IPointerPanDragState | null>(null);
    const priceScaleModelRef = useRef(
      createTradingViewNativeWebPriceScaleModel(),
    );
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
    const [measuredPriceAxisWidth, setMeasuredPriceAxisWidth] = useState(0);
    const [measuredMainChartBottomInset, setMeasuredMainChartBottomInset] =
      useState(TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT);
    const [webFontMeasureVersion, setWebFontMeasureVersion] = useState(0);
    const [viewportState, setViewportState] = useState(
      () => runtimeStateRef.current.viewport,
    );
    const panOffset = viewportState.offset;
    const zoomScale = viewportState.zoomScale;
    const pointCount = points.length;
    const visibleSubIndicatorPaneCount = useMemo(
      () =>
        subIndicatorPanes.reduce(
          (count, pane) => count + (pane.isVisible ? 1 : 0),
          0,
        ),
      [subIndicatorPanes],
    );
    const priceAxisLabels = useMemo<ITradingViewNativeCanvasPriceAxisLabels>(
      () => ({
        currentPrice: chartSettings.options.latestPrice
          ? currentPriceLabel
          : '',
        widestIndicatorPrice:
          getTradingViewNativeIndicatorPriceAxisLabel(indicatorSeries),
        widestPrice: getTradingViewNativePriceAxisLabel(points),
        widestSubIndicator:
          getTradingViewNativeSubIndicatorAxisLabel(subIndicatorPanes),
        widestVolume: hasVolume
          ? getTradingViewNativeVolumeAxisLabel(points)
          : '',
        yAxisVisible: chartSettings.options.yAxis,
      }),
      [
        chartSettings.options.latestPrice,
        chartSettings.options.yAxis,
        currentPriceLabel,
        hasVolume,
        indicatorSeries,
        points,
        subIndicatorPanes,
      ],
    );
    const previousLatestTimestampRef = useRef<number | undefined>(
      points[pointCount - 1]?.t,
    );
    const theme = useTheme();
    const themeName = useThemeName();
    const background = chartSettings.background.colors[0];
    const grid = chartSettings.grid.horizontalColor;
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
        const priceAxisWidth = getTradingViewNativeCanvasPriceAxisWidth(
          canvas,
          priceAxisLabels,
        );
        drawTradingViewNativeCanvasChart({
          candleIntervalSeconds,
          canvas,
          chartSettings,
          chartType,
          colors: {
            axisText,
            background,
            down: chartSettings.candles.body.downColor,
            grid,
            line,
            up: chartSettings.candles.body.upColor,
          },
          hasVolume,
          candleLabels,
          currentPriceLabel,
          indicatorSeries,
          points,
          priceAxisWidth,
          priceRangeScale: priceScaleModelRef.current.rangeScale,
          priceScaleMode: priceScaleModelRef.current.mode,
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
        chartSettings,
        chartType,
        currentPriceLabel,
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
      const chartWidth = getTradingViewNativeCanvasChartWidth(
        canvas,
        priceAxisLabels,
      );
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
      const dragState = pointerPanDragStateRef.current;
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
      const dragState = pointerPanDragStateRef.current;
      if (viewportRequest.preserveVisibleAnchor && dragState) {
        dragState.startClientX = dragState.currentClientX;
        dragState.startOffset = nextViewport.offset;
        dragState.zoomScale = nextViewport.zoomScale;
      } else {
        pointerPanDragStateRef.current = null;
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
      if (chartSettings.options.crossLine) {
        return;
      }

      runtimeStateRef.current = reduceTradingViewNativeChartRuntime(
        runtimeStateRef.current,
        { type: 'crosshairHidden' },
      );
    }, [chartSettings.options.crossLine]);

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
        const nextPriceAxisWidth = getTradingViewNativeCanvasPriceAxisWidth(
          canvas,
          priceAxisLabels,
        );
        const nextChartWidth = getTradingViewNativeCanvasChartWidth(
          canvas,
          priceAxisLabels,
        );
        setMeasuredChartWidth((currentWidth) =>
          currentWidth === nextChartWidth ? currentWidth : nextChartWidth,
        );
        setMeasuredPriceAxisWidth((currentWidth) =>
          currentWidth === nextPriceAxisWidth
            ? currentWidth
            : nextPriceAxisWidth,
        );
        const nextMainChartBottomInset =
          getTradingViewNativeMainPriceAxisLayout({
            height: canvas.clientHeight,
            paneCount: visibleSubIndicatorPaneCount,
          }).bottomInset;
        setMeasuredMainChartBottomInset((currentInset) =>
          currentInset === nextMainChartBottomInset
            ? currentInset
            : nextMainChartBottomInset,
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
      visibleSubIndicatorPaneCount,
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

    const renderWithCrosshairHidden = useCallback(() => {
      const nextRuntimeState = reduceTradingViewNativeChartRuntime(
        runtimeStateRef.current,
        { type: 'crosshairHidden' },
      );
      runtimeStateRef.current = nextRuntimeState;
      renderChart(nextRuntimeState);
      return nextRuntimeState;
    }, [renderChart]);

    const renderCurrentChart = useCallback(() => {
      renderChart(runtimeStateRef.current);
    }, [renderChart]);

    const {
      finishPointerDrag: finishPriceScalePointerDrag,
      handleAutoScalePress,
      handleDoubleClick: handlePriceScaleDoubleClick,
      handleLogScalePress,
      handlePointerDown: handlePriceScalePointerDown,
      handlePointerLeave: handlePriceScalePointerLeave,
      handlePointerMove: handlePriceScalePointerMove,
      handleWheel: handlePriceScaleWheel,
      isAutoScale,
      isHovered: isPriceAxisHovered,
      isPointerDragging: isPriceScalePointerDragging,
      mode: priceScaleMode,
    } = useTradingViewNativePriceScale({
      labels: priceAxisLabels,
      modelRef: priceScaleModelRef,
      paneCount: visibleSubIndicatorPaneCount,
      renderCurrentChart,
      renderWithCrosshairHidden,
      runtimeStateRef,
    });

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (event.button !== 0) {
          return;
        }
        if (handlePriceScalePointerDown(event)) {
          return;
        }
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          return;
        }
        const chartWidth = getTradingViewNativeCanvasChartWidth(
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
        pointerPanDragStateRef.current = {
          currentClientX: event.clientX,
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startOffset: nextRuntimeState.viewport.offset,
          zoomScale: nextRuntimeState.viewport.zoomScale,
        };
      },
      [handlePriceScalePointerDown, pointCount, priceAxisLabels, renderChart],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const dragState = pointerPanDragStateRef.current;
        if (dragState) {
          if (dragState.pointerId !== event.pointerId) {
            return;
          }
          event.preventDefault();
          dragState.currentClientX = event.clientX;
          const chartWidth = getTradingViewNativeCanvasChartWidth(
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
          return;
        }

        if (handlePriceScalePointerMove(event)) {
          return;
        }

        if (!chartSettings.options.crossLine) {
          return;
        }
        const canvasRect = event.currentTarget.getBoundingClientRect();
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(
          runtimeStateRef.current,
          {
            chartWidth: getTradingViewNativeCanvasChartWidth(
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
      },
      [
        chartSettings.options.crossLine,
        handlePriceScalePointerMove,
        pointCount,
        priceAxisLabels,
        renderChart,
      ],
    );

    const handlePointerLeave = useCallback(() => {
      if (pointerPanDragStateRef.current || isPriceScalePointerDragging()) {
        return;
      }
      handlePriceScalePointerLeave();
      if (runtimeStateRef.current.crosshair.visible) {
        renderWithCrosshairHidden();
      }
    }, [
      handlePriceScalePointerLeave,
      isPriceScalePointerDragging,
      renderWithCrosshairHidden,
    ]);

    const finishPointerDrag = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (finishPriceScalePointerDrag(event)) {
          return;
        }
        if (pointerPanDragStateRef.current?.pointerId !== event.pointerId) {
          return;
        }
        pointerPanDragStateRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
      [finishPriceScalePointerDrag],
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

        if (handlePriceScaleWheel(canvas, event, wheelDelta.deltaY)) {
          return;
        }

        const canvasRect = canvas.getBoundingClientRect();
        const chartWidth = getTradingViewNativeCanvasChartWidth(
          canvas,
          priceAxisLabels,
        );
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
      [handlePriceScaleWheel, pointCount, priceAxisLabels],
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
        position="relative"
        onMouseLeave={handlePointerLeave}
        opacity={isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1}
      >
        <canvas
          ref={canvasRef}
          data-testid={testID}
          onDoubleClick={handlePriceScaleDoubleClick}
          onLostPointerCapture={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerMove}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          style={{
            cursor: isPriceAxisHovered ? 'ns-resize' : 'crosshair',
            display: 'block',
            height: '100%',
            touchAction: 'pan-y',
            userSelect: 'none',
            width: '100%',
          }}
        />
        {chartSettings.options.yAxis && measuredPriceAxisWidth > 0 ? (
          <TradingViewNativePriceScaleControls
            backgroundColor={background}
            isAutoScale={isAutoScale}
            isVisible={isPriceAxisHovered}
            mainChartBottomInset={measuredMainChartBottomInset}
            onAutoScalePress={handleAutoScalePress}
            onLogScalePress={handleLogScalePress}
            priceAxisWidth={measuredPriceAxisWidth}
            priceScaleMode={priceScaleMode}
            testID={testID}
          />
        ) : null}
      </Stack>
    );
  },
);

TradingViewNativeChart.displayName = 'TradingViewNativeChart';
