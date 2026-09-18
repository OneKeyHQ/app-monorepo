import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PointerEvent as ReactPointerEvent, Ref } from 'react';

import { Stack, useTheme, useThemeName } from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE as AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
  TRADING_VIEW_NATIVE_WATERMARK_DARK_OPACITY as WATERMARK_DARK_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_LIGHT_OPACITY as WATERMARK_LIGHT_OPACITY,
} from '../chartConstants';
import { getTradingViewNativeChartComponentPriceAxisLabel } from '../utils/chartComponentTree';
import {
  type ITradingViewNativeSubIndicator,
  getTradingViewNativeIndicatorPriceAxisLabel,
} from '../utils/chartIndicators';
import {
  getTradingViewNativeChartWidth,
  getTradingViewNativePriceAxisLabel,
} from '../utils/chartLayout';
import { getTradingViewNativeVolumeAxisLabel } from '../utils/chartLegend';
import {
  type ITradingViewNativeChartRuntimeState,
  createTradingViewNativeChartRuntimeState,
  getTradingViewNativeChartRuntimeVisiblePointRange,
  reduceTradingViewNativeChartRuntime,
} from '../utils/chartRuntime';
import {
  getTradingViewNativeDataUpdateMetadata,
  getTradingViewNativeViewportPointRange,
} from '../utils/chartViewport';
import { getTradingViewNativeMainPriceRange } from '../utils/mainPriceRange';
import { getTradingViewNativeMainPriceAxisLayout } from '../utils/priceAxisScale';
import { isTradingViewNativeLogPriceScaleAvailable } from '../utils/priceScale';
import {
  getTradingViewNativeSubIndicatorAxisLabel,
  getTradingViewNativeSubIndicatorLegendIndicatorAtPoint,
  getTradingViewNativeVisibleSubIndicatorPaneCount,
} from '../utils/subIndicatorRender';

import {
  type ITradingViewNativeCanvasPriceAxisLabels,
  getTradingViewNativeCanvasChartWidth,
  getTradingViewNativeCanvasPriceAxisWidth,
  isTradingViewNativeCanvasMainPriceAxisPointer,
} from './chartCanvasLayout';
import { getTradingViewNativeCanvasFont } from './chartCanvasRenderer';
import {
  getTradingViewNativePointerDragIntent,
  getTradingViewNativeTimeAxisPointerDragUpdate,
  shouldStartTradingViewNativeViewportPointerDrag,
} from './chartPointerInteraction';
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

import type { ITradingViewNativeChartProps } from '../TradingViewNativeChart.types';
import type { ITradingViewNativeSubIndicatorLegendHitRegion } from '../utils/subIndicatorRender';

const ONEKEY_WATERMARK_ASSET =
  require('@onekeyhq/components/svg/illus/logo.svg') as
    | string
    | { default: string };
const ONEKEY_WATERMARK_URI =
  typeof ONEKEY_WATERMARK_ASSET === 'string'
    ? ONEKEY_WATERMARK_ASSET
    : ONEKEY_WATERMARK_ASSET.default;
interface IPointerPanDragState {
  currentClientX: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffset: number;
  subIndicatorSettingsTarget: ITradingViewNativeSubIndicator | null;
  zoomScale: number;
}

interface ITimeAxisPointerDragState {
  chartWidth: number;
  currentX: number;
  isActive: boolean;
  pointerId: number;
  startOffset: number;
  startX: number;
  startY: number;
  startZoomScale: number;
}

export const TradingViewNativeChart = memo(
  ({
    candleIntervalSeconds,
    chartComponents,
    chartSettings,
    chartType,
    extendTimeAxisBorderToCanvasEdge = false,
    hasVolume,
    indicatorSeries,
    initialRightOffset,
    isMobileLayout = false,
    isSwitchingInterval,
    priceAxisFontSize = AXIS_FONT_SIZE,
    priceAxisTickCount,
    showLegend = true,
    timeAxisFontSize = AXIS_FONT_SIZE,
    timeAxisHeight = TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
    timeAxisBorderWidth,
    currentPriceLabel,
    onChartWidthChange,
    onSubIndicatorSettingsPress,
    onViewportRequestApplied,
    onVisiblePointRangeChange,
    candleLabels,
    points,
    subIndicatorPanes = [],
    testID,
    viewportRequest,
  }: ITradingViewNativeChartProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const runtimeStateRef = useRef<ITradingViewNativeChartRuntimeState>(
      createTradingViewNativeChartRuntimeState({
        initialRightOffset,
      }),
    );
    const pointerPanDragStateRef = useRef<IPointerPanDragState | null>(null);
    const timeAxisPointerDragStateRef =
      useRef<ITimeAxisPointerDragState | null>(null);
    const subIndicatorLegendHitRegionsRef = useRef<
      ITradingViewNativeSubIndicatorLegendHitRegion[]
    >([]);
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
      useState(timeAxisHeight);
    const [webFontMeasureVersion, setWebFontMeasureVersion] = useState(0);
    const [viewportState, setViewportState] = useState(
      () => runtimeStateRef.current.viewport,
    );
    const panOffset = viewportState.offset;
    const zoomScale = viewportState.zoomScale;
    const pointCount = points.length;
    const visibleSubIndicatorPaneCount = useMemo(
      () => getTradingViewNativeVisibleSubIndicatorPaneCount(subIndicatorPanes),
      [subIndicatorPanes],
    );
    const autoPriceRange = useMemo(
      () =>
        getTradingViewNativeMainPriceRange({
          chartType,
          endIndex: pointCount,
          indicatorSeries,
          points,
          startIndex: 0,
        }),
      [chartType, indicatorSeries, pointCount, points],
    );
    const isLogScaleAvailable =
      isTradingViewNativeLogPriceScaleAvailable(autoPriceRange);
    const priceAxisLabels = useMemo<ITradingViewNativeCanvasPriceAxisLabels>(
      () => ({
        autoPriceRange,
        chartComponentPrice:
          getTradingViewNativeChartComponentPriceAxisLabel(chartComponents),
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
        autoPriceRange,
        chartComponents,
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
    const timeAxisBorder = extendTimeAxisBorderToCanvasEdge
      ? theme.border.val
      : undefined;
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
          priceScaleModelRef.current,
          priceAxisFontSize,
        );
        const scene = drawTradingViewNativeCanvasChart({
          candleIntervalSeconds,
          canvas,
          chartComponents,
          chartSettings,
          chartType,
          colors: {
            axisText,
            background,
            down: chartSettings.candles.body.downColor,
            grid,
            line,
            timeAxisBorder,
            up: chartSettings.candles.body.upColor,
          },
          extendTimeAxisBorderToCanvasEdge,
          hasVolume,
          candleLabels,
          currentPriceLabel,
          indicatorSeries,
          isMobileLayout,
          pinnedPriceRange: priceScaleModelRef.current.pinnedPriceRange,
          points,
          priceAxisFontSize,
          priceAxisWidth,
          priceAxisTickCount,
          priceRangeScale: priceScaleModelRef.current.rangeScale,
          priceScaleMode: priceScaleModelRef.current.mode,
          runtimeState: nextRuntimeState,
          showLegend,
          subIndicatorPanes,
          timeAxisFontSize,
          timeAxisHeight,
          timeAxisBorderWidth,
          watermarkImage,
          watermarkOpacity,
        });
        subIndicatorLegendHitRegionsRef.current =
          scene?.subIndicatorLegendHitRegions ?? [];
        priceScaleModelRef.current.autoPriceRange =
          scene?.autoPriceRange ?? null;
        const nextChartWidth = getTradingViewNativeChartWidth(
          canvas.getBoundingClientRect().width,
          priceAxisWidth,
        );
        setMeasuredPriceAxisWidth((currentWidth) =>
          currentWidth === priceAxisWidth ? currentWidth : priceAxisWidth,
        );
        setMeasuredChartWidth((currentWidth) =>
          currentWidth === nextChartWidth ? currentWidth : nextChartWidth,
        );
      },
      [
        axisText,
        background,
        candleIntervalSeconds,
        chartComponents,
        chartSettings,
        chartType,
        currentPriceLabel,
        extendTimeAxisBorderToCanvasEdge,
        grid,
        hasVolume,
        indicatorSeries,
        isMobileLayout,
        line,
        candleLabels,
        points,
        priceAxisFontSize,
        priceAxisLabels,
        priceAxisTickCount,
        showLegend,
        subIndicatorPanes,
        timeAxisFontSize,
        timeAxisHeight,
        timeAxisBorder,
        timeAxisBorderWidth,
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
        priceScaleModelRef.current,
        priceAxisFontSize,
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
      const timeAxisDragState = timeAxisPointerDragStateRef.current;
      if (timeAxisDragState) {
        timeAxisDragState.startOffset = reduceTradingViewNativeChartRuntime(
          {
            ...runtimeAfterInitialMeasure,
            viewport: {
              ...runtimeAfterInitialMeasure.viewport,
              offset: timeAxisDragState.startOffset,
              zoomScale: timeAxisDragState.startZoomScale,
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
    }, [pointCount, points, priceAxisFontSize, priceAxisLabels]);

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
      const timeAxisDragState = timeAxisPointerDragStateRef.current;
      if (viewportRequest.preserveVisibleAnchor) {
        if (dragState) {
          dragState.startClientX = dragState.currentClientX;
          dragState.startOffset = nextViewport.offset;
          dragState.zoomScale = nextViewport.zoomScale;
        }
        if (timeAxisDragState) {
          timeAxisDragState.chartWidth = measuredChartWidth;
          timeAxisDragState.startOffset = nextViewport.offset;
          timeAxisDragState.startX = timeAxisDragState.currentX;
          timeAxisDragState.startZoomScale = nextViewport.zoomScale;
        }
      } else {
        pointerPanDragStateRef.current = null;
        timeAxisPointerDragStateRef.current = null;
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
          priceScaleModelRef.current,
          priceAxisFontSize,
        );
        const nextChartWidth = getTradingViewNativeCanvasChartWidth(
          canvas,
          priceAxisLabels,
          priceScaleModelRef.current,
          priceAxisFontSize,
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
            timeAxisHeight,
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
      priceAxisFontSize,
      priceAxisLabels,
      renderChart,
      timeAxisHeight,
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
      handlePointerEnter: handlePriceScalePointerEnter,
      handlePointerLeave: handlePriceScalePointerLeave,
      handlePointerMove: handlePriceScalePointerMove,
      handleWheel: handlePriceScaleWheel,
      isAutoScale,
      isHovered: isPriceAxisHovered,
      isPointerDragging: isPriceScalePointerDragging,
      mode: priceScaleMode,
    } = useTradingViewNativePriceScale({
      isLogScaleAvailable,
      modelRef: priceScaleModelRef,
      renderCurrentChart,
      renderWithCrosshairHidden,
    });

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (
          !shouldStartTradingViewNativeViewportPointerDrag({
            button: event.button,
            hasActiveDrag: Boolean(
              pointerPanDragStateRef.current ||
              timeAxisPointerDragStateRef.current,
            ),
          })
        ) {
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
          priceScaleModelRef.current,
          priceAxisFontSize,
        );
        const canvasRect = event.currentTarget.getBoundingClientRect();
        const subIndicatorSettingsTarget =
          getTradingViewNativeSubIndicatorLegendIndicatorAtPoint({
            regions: subIndicatorLegendHitRegionsRef.current,
            x: event.clientX - canvasRect.left,
            y: event.clientY - canvasRect.top,
          });
        let nextRuntimeState = runtimeStateRef.current;
        if (subIndicatorSettingsTarget === null) {
          nextRuntimeState = reduceTradingViewNativeChartRuntime(
            nextRuntimeState,
            {
              chartWidth,
              hideCrosshair: true,
              offset: nextRuntimeState.viewport.offset,
              pointCount,
              type: 'panMoved',
            },
          );
          runtimeStateRef.current = nextRuntimeState;
          renderChart(nextRuntimeState);
        }
        pointerPanDragStateRef.current = {
          currentClientX: event.clientX,
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startOffset: nextRuntimeState.viewport.offset,
          subIndicatorSettingsTarget,
          zoomScale: nextRuntimeState.viewport.zoomScale,
        };
      },
      [pointCount, priceAxisFontSize, priceAxisLabels, renderChart],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (timeAxisPointerDragStateRef.current) {
          return;
        }
        const dragState = pointerPanDragStateRef.current;
        if (dragState) {
          if (dragState.pointerId !== event.pointerId) {
            return;
          }
          dragState.currentClientX = event.clientX;
          if (
            getTradingViewNativePointerDragIntent({
              clientX: event.clientX,
              clientY: event.clientY,
              hasSubIndicatorSettingsTarget:
                dragState.subIndicatorSettingsTarget !== null,
              startClientX: dragState.startClientX,
              startClientY: dragState.startClientY,
            }) === 'pendingLegendTap'
          ) {
            return;
          }
          dragState.subIndicatorSettingsTarget = null;
          event.preventDefault();
          const chartWidth = getTradingViewNativeCanvasChartWidth(
            event.currentTarget,
            priceAxisLabels,
            priceScaleModelRef.current,
            priceAxisFontSize,
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

        handlePriceScalePointerLeave();
        const canvasRect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.cursor =
          getTradingViewNativeSubIndicatorLegendIndicatorAtPoint({
            regions: subIndicatorLegendHitRegionsRef.current,
            x: event.clientX - canvasRect.left,
            y: event.clientY - canvasRect.top,
          }) === null
            ? 'crosshair'
            : 'pointer';

        if (!chartSettings.options.crossLine) {
          return;
        }
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(
          runtimeStateRef.current,
          {
            chartWidth: getTradingViewNativeCanvasChartWidth(
              event.currentTarget,
              priceAxisLabels,
              priceScaleModelRef.current,
              priceAxisFontSize,
            ),
            height: canvasRect.height,
            pointCount,
            timeAxisHeight,
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
        handlePriceScalePointerLeave,
        pointCount,
        priceAxisFontSize,
        priceAxisLabels,
        renderChart,
        timeAxisHeight,
      ],
    );

    const handlePointerLeave = useCallback(() => {
      if (
        pointerPanDragStateRef.current ||
        timeAxisPointerDragStateRef.current ||
        isPriceScalePointerDragging()
      ) {
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
        const dragState = pointerPanDragStateRef.current;
        if (dragState?.pointerId !== event.pointerId) {
          return;
        }
        const shouldOpenSubIndicatorSettings = Boolean(
          event.type === 'pointerup' &&
          getTradingViewNativePointerDragIntent({
            clientX: event.clientX,
            clientY: event.clientY,
            hasSubIndicatorSettingsTarget:
              dragState.subIndicatorSettingsTarget !== null,
            startClientX: dragState.startClientX,
            startClientY: dragState.startClientY,
          }) === 'pendingLegendTap',
        );
        pointerPanDragStateRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (
          shouldOpenSubIndicatorSettings &&
          dragState.subIndicatorSettingsTarget
        ) {
          onSubIndicatorSettingsPress(dragState.subIndicatorSettingsTarget);
        }
      },
      [onSubIndicatorSettingsPress],
    );

    const handleTimeAxisPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (
          measuredChartWidth <= 0 ||
          !shouldStartTradingViewNativeViewportPointerDrag({
            button: event.button,
            hasActiveDrag: Boolean(
              pointerPanDragStateRef.current ||
              timeAxisPointerDragStateRef.current,
            ),
          })
        ) {
          return;
        }
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          return;
        }
        const targetRect = event.currentTarget.getBoundingClientRect();
        const startX = event.clientX - targetRect.left;
        const runtime = renderWithCrosshairHidden();
        timeAxisPointerDragStateRef.current = {
          chartWidth: measuredChartWidth,
          currentX: startX,
          isActive: false,
          pointerId: event.pointerId,
          startOffset: runtime.viewport.offset,
          startX,
          startY: event.clientY - targetRect.top,
          startZoomScale: runtime.viewport.zoomScale,
        };
      },
      [measuredChartWidth, renderWithCrosshairHidden],
    );

    const handleTimeAxisPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const dragState = timeAxisPointerDragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
          return;
        }
        const targetRect = event.currentTarget.getBoundingClientRect();
        const currentX = event.clientX - targetRect.left;
        dragState.currentX = currentX;
        const dragUpdate = getTradingViewNativeTimeAxisPointerDragUpdate({
          chartWidth: dragState.chartWidth,
          currentX,
          currentY: event.clientY - targetRect.top,
          isActive: dragState.isActive,
          startX: dragState.startX,
          startY: dragState.startY,
          startZoomScale: dragState.startZoomScale,
        });
        if (dragUpdate.type === 'cancel') {
          timeAxisPointerDragStateRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          return;
        }
        if (dragUpdate.type === 'pending') {
          return;
        }
        event.preventDefault();
        dragState.isActive = true;
        const chartWidth = measuredChartWidth;
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(
          runtimeStateRef.current,
          {
            anchorX: chartWidth,
            baseViewport: {
              offset: dragState.startOffset,
              zoomScale: dragState.startZoomScale,
            },
            chartWidth,
            hideCrosshair: true,
            nextZoomScale: dragUpdate.zoomScale,
            pointCount,
            type: 'zoomed',
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
      [measuredChartWidth, pointCount, renderChart],
    );

    const finishTimeAxisPointerDrag = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (
          timeAxisPointerDragStateRef.current?.pointerId !== event.pointerId
        ) {
          return;
        }
        timeAxisPointerDragStateRef.current = null;
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

        if (
          isTradingViewNativeCanvasMainPriceAxisPointer({
            canvas,
            clientX: event.clientX,
            clientY: event.clientY,
            labels: priceAxisLabels,
            paneCount: visibleSubIndicatorPaneCount,
            priceAxisFontSize,
            priceScale: priceScaleModelRef.current,
            timeAxisHeight,
          })
        ) {
          handlePriceScaleWheel(wheelDelta.deltaY);
          return;
        }

        const canvasRect = canvas.getBoundingClientRect();
        const chartWidth = getTradingViewNativeCanvasChartWidth(
          canvas,
          priceAxisLabels,
          priceScaleModelRef.current,
          priceAxisFontSize,
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
      [
        handlePriceScaleWheel,
        pointCount,
        priceAxisFontSize,
        priceAxisLabels,
        timeAxisHeight,
        visibleSubIndicatorPaneCount,
      ],
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return undefined;
      }
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }, [handleWheel]);

    return (
      <Stack
        ref={containerRef as unknown as Ref<IElement>}
        flex={1}
        minHeight={0}
        position="relative"
        onMouseLeave={handlePointerLeave}
        opacity={isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1}
      >
        <canvas
          ref={canvasRef}
          data-testid={testID}
          onLostPointerCapture={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerMove}
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
        {measuredChartWidth > 0 ? (
          <div
            data-testid={testID ? `${testID}-time-axis-interaction` : undefined}
            onLostPointerCapture={finishTimeAxisPointerDrag}
            onPointerCancel={finishTimeAxisPointerDrag}
            onPointerDown={handleTimeAxisPointerDown}
            onPointerEnter={renderWithCrosshairHidden}
            onPointerMove={handleTimeAxisPointerMove}
            onPointerUp={finishTimeAxisPointerDrag}
            style={{
              bottom: 0,
              cursor: 'ew-resize',
              height: TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
              left: CHART_HORIZONTAL_PADDING,
              position: 'absolute',
              touchAction: 'pan-y',
              userSelect: 'none',
              width: measuredChartWidth,
              zIndex: 1,
            }}
          />
        ) : null}
        {chartSettings.options.yAxis && measuredPriceAxisWidth > 0 ? (
          <div
            data-testid={
              testID ? `${testID}-price-axis-interaction` : undefined
            }
            onDoubleClick={handlePriceScaleDoubleClick}
            onLostPointerCapture={finishPriceScalePointerDrag}
            onPointerCancel={finishPriceScalePointerDrag}
            onPointerDown={handlePriceScalePointerDown}
            onPointerEnter={handlePriceScalePointerEnter}
            onPointerMove={handlePriceScalePointerMove}
            onPointerUp={finishPriceScalePointerDrag}
            style={{
              bottom: measuredMainChartBottomInset,
              cursor: 'ns-resize',
              position: 'absolute',
              right: 0,
              top: 0,
              touchAction: 'none',
              userSelect: 'none',
              width: measuredPriceAxisWidth,
              zIndex: 1,
            }}
          />
        ) : null}
        {chartSettings.options.yAxis && measuredPriceAxisWidth > 0 ? (
          <TradingViewNativePriceScaleControls
            backgroundColor={background}
            isAutoScale={isAutoScale}
            isLogScaleAvailable={isLogScaleAvailable}
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
