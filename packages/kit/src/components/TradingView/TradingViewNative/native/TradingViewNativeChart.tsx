import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Canvas, Picture, useFont, useSVG } from '@shopify/react-native-skia';
import { GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { Stack, useTheme, useThemeName } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
  TRADING_VIEW_NATIVE_WATERMARK_DARK_OPACITY as WATERMARK_DARK_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_LIGHT_OPACITY as WATERMARK_LIGHT_OPACITY,
} from '../chartConstants';
import {
  type ITradingViewNativeIndicatorSeries,
  getTradingViewNativeIndicatorPriceAxisLabel,
} from '../utils/chartIndicators';
import {
  getTradingViewNativeChartWidth,
  getTradingViewNativePriceAxisLabel,
  getTradingViewNativePriceAxisWidth,
  getTradingViewNativeScaledPriceAxisLabel,
} from '../utils/chartLayout';
import { getTradingViewNativeVolumeAxisLabel } from '../utils/chartLegend';
import {
  getTradingViewNativeChartRuntimeVisiblePointRange,
  reduceTradingViewNativeChartRuntime,
} from '../utils/chartRuntime';
import {
  type ITradingViewNativeViewportRequest,
  type ITradingViewNativeVisiblePointRange,
  getTradingViewNativeDataUpdateMetadata,
  getTradingViewNativeGestureStartOffsetAfterDataUpdate,
  getTradingViewNativePanStartOffsetAfterViewportPreservation,
  getTradingViewNativeViewportPointRange,
} from '../utils/chartViewport';
import { getTradingViewNativeMainPriceRange } from '../utils/mainPriceRange';
import { isTradingViewNativeLogPriceScaleAvailable } from '../utils/priceScale';
import {
  PRICE_SCALE_CONTROL_NATIVE_SIZING,
  getTradingViewNativePriceScaleControlsMinimumAxisWidth,
} from '../utils/priceScaleControls';
import {
  type ITradingViewNativeSubIndicatorRenderPane,
  getTradingViewNativeSubIndicatorAxisLabel,
} from '../utils/subIndicatorRender';

import {
  type ITradingViewNativeChartSize,
  createTradingViewNativeChartRuntime,
} from './chartRuntime';
import {
  applyTradingViewNativeSubIndicatorLatestPaneValues,
  getTradingViewNativeSubIndicatorPanesStructureKey,
  getTradingViewNativeSubIndicatorPanesUpdate,
  shouldReplaceTradingViewNativeIndicatorSeries,
} from './chartRuntimeData';
import {
  createTradingViewNativeSkiaPicture,
  createTradingViewNativeSkiaResources,
} from './chartSkiaRenderer';
import { TradingViewNativePriceScaleControls } from './TradingViewNativePriceScaleControls';
import { useTradingViewNativeChartGestures } from './useTradingViewNativeChartGestures';
import { useTradingViewNativePriceScale } from './useTradingViewNativePriceScale';

import type {
  ITradingViewNativeCandleLabels,
  ITradingViewNativeChartType,
  ITradingViewNativeInitialRightOffset,
} from '../types';
import type { LayoutChangeEvent } from 'react-native';

const SYSTEM_FONT_FAMILY = platformEnv.isNativeAndroid
  ? 'sans-serif'
  : 'System';
const PRICE_AXIS_FONT_SOURCE =
  require('@onekeyhq/components/src/hocs/Provider/fonts/GeistMono-Regular.ttf') as number;
const ONEKEY_WATERMARK_SOURCE =
  require('@onekeyhq/components/svg/illus/logo.svg') as number;
const EMPTY_SUB_INDICATOR_PANES: readonly ITradingViewNativeSubIndicatorRenderPane[] =
  [];

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

export const TradingViewNativeChart = memo(
  ({
    candleIntervalSeconds,
    chartSettings,
    chartType,
    chartPictureVersion,
    currentPriceLabel,
    hasVolume,
    indicatorSeries,
    indicatorSeriesSettingsKey,
    initialRightOffset,
    isSwitchingInterval,
    onChartWidthChange,
    onViewportRequestApplied,
    onVisiblePointRangeChange,
    candleLabels,
    points,
    subIndicatorPanes = EMPTY_SUB_INDICATOR_PANES,
    testID,
    viewportRequest,
  }: ITradingViewNativeChartProps) => {
    const [chartSize, setChartSize] = useState<ITradingViewNativeChartSize>({
      height: 0,
      width: 0,
    });
    const [chartWidth, setChartWidth] = useState(0);
    const subIndicatorPanesStructureKey =
      getTradingViewNativeSubIndicatorPanesStructureKey(subIndicatorPanes);
    const chartRuntime = useSharedValue(
      createTradingViewNativeChartRuntime({
        candleIntervalSeconds,
        chartSettings,
        chartType,
        currentPriceLabel,
        hasVolume,
        indicatorSeries,
        initialRightOffset,
        points,
        subIndicatorPanes,
      }),
    );
    const decayOffset = useSharedValue(0);
    const previousLatestTimestampRef = useRef<number | undefined>(
      points[points.length - 1]?.t,
    );
    const previousPictureInputRef = useRef({
      chartPictureVersion,
      indicatorSeriesKey: indicatorSeries.map((series) => series.key).join('|'),
      indicatorSeriesSettingsKey,
      pointCount: points.length,
      subIndicatorPanesStructureKey,
    });
    const appliedViewportRequestRef = useRef({
      chartWidth: 0,
      requestId: 0,
    });
    const theme = useTheme();
    const themeName = useThemeName();
    const priceAxisFont = useFont(
      PRICE_AXIS_FONT_SOURCE,
      TRADING_VIEW_NATIVE_AXIS_FONT_SIZE,
    );
    const watermarkSvg = useSVG(ONEKEY_WATERMARK_SOURCE);
    const background = chartSettings.background.colors[0];
    const grid = chartSettings.grid.horizontalColor;
    const axisText = theme.textSubdued.val;
    const line = theme.text.val;
    const pointCount = points.length;
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
    const widestPriceLabel = useMemo(
      () => getTradingViewNativePriceAxisLabel(points),
      [points],
    );
    const widestIndicatorPriceLabel = useMemo(
      () => getTradingViewNativeIndicatorPriceAxisLabel(indicatorSeries),
      [indicatorSeries],
    );
    const widestVolumeLabel = useMemo(
      () => (hasVolume ? getTradingViewNativeVolumeAxisLabel(points) : ''),
      [hasVolume, points],
    );
    const widestSubIndicatorLabel = useMemo(
      () => getTradingViewNativeSubIndicatorAxisLabel(subIndicatorPanes),
      [subIndicatorPanes],
    );
    const watermarkOpacity =
      themeName === 'dark' ? WATERMARK_DARK_OPACITY : WATERMARK_LIGHT_OPACITY;
    const resources = useDerivedValue(
      () =>
        createTradingViewNativeSkiaResources({
          colors: {
            axisText,
            background,
            down: chartSettings.candles.body.downColor,
            grid,
            line,
            up: chartSettings.candles.body.upColor,
          },
          fontFamily: SYSTEM_FONT_FAMILY,
          priceAxisFont,
          watermarkSvg,
        }),
      [
        axisText,
        background,
        chartSettings.candles.body.downColor,
        chartSettings.candles.body.upColor,
        grid,
        line,
        priceAxisFont,
        watermarkSvg,
      ],
    );
    const priceAxisWidth = useDerivedValue(() => {
      if (!chartSettings.options.yAxis) {
        return 0;
      }
      const measuredPriceAxisFont = resources.value.fonts.priceAxis;
      const currentPriceLabelBounds = measuredPriceAxisFont.measureText(
        chartSettings.options.latestPrice ? currentPriceLabel : '',
      );
      const widestPriceLabelBounds =
        measuredPriceAxisFont.measureText(widestPriceLabel);
      const scaledPriceLabelBounds = measuredPriceAxisFont.measureText(
        autoPriceRange
          ? getTradingViewNativeScaledPriceAxisLabel({
              autoPriceRange,
              baseLabel: widestPriceLabel,
              priceRangeScale: chartRuntime.value.priceRangeScale,
              priceScaleMode: chartRuntime.value.priceScaleMode,
            })
          : widestPriceLabel,
      );
      const widestIndicatorPriceLabelBounds = measuredPriceAxisFont.measureText(
        widestIndicatorPriceLabel,
      );
      const widestVolumeLabelBounds =
        measuredPriceAxisFont.measureText(widestVolumeLabel);
      const widestSubIndicatorLabelBounds = measuredPriceAxisFont.measureText(
        widestSubIndicatorLabel,
      );
      return getTradingViewNativePriceAxisWidth({
        currentPriceLabelWidth: Math.max(
          currentPriceLabelBounds.x + currentPriceLabelBounds.width,
          0,
        ),
        minimumWidth: getTradingViewNativePriceScaleControlsMinimumAxisWidth(
          PRICE_SCALE_CONTROL_NATIVE_SIZING,
        ),
        widestPriceLabelWidth: Math.max(
          widestPriceLabelBounds.x + widestPriceLabelBounds.width,
          scaledPriceLabelBounds.x + scaledPriceLabelBounds.width,
          widestIndicatorPriceLabelBounds.x +
            widestIndicatorPriceLabelBounds.width,
          widestSubIndicatorLabelBounds.x + widestSubIndicatorLabelBounds.width,
          0,
        ),
        widestVolumeLabelWidth: Math.max(
          widestVolumeLabelBounds.x + widestVolumeLabelBounds.width,
          0,
        ),
      });
    }, [
      autoPriceRange,
      chartRuntime,
      chartSettings.options.latestPrice,
      chartSettings.options.yAxis,
      currentPriceLabel,
      resources,
      widestIndicatorPriceLabel,
      widestPriceLabel,
      widestSubIndicatorLabel,
      widestVolumeLabel,
    ]);

    const picture = useDerivedValue(() => {
      const runtime = chartRuntime.value;
      return createTradingViewNativeSkiaPicture({
        candleIntervalSeconds: runtime.candleIntervalSeconds,
        chartSettings: runtime.chartSettings,
        chartType: runtime.chartType,
        crosshair: runtime.crosshair,
        currentPriceLabel: runtime.currentPriceLabel,
        hasVolume: runtime.hasVolume,
        height: runtime.size.height,
        candleLabels,
        indicatorSeries: runtime.indicatorSeries,
        points: runtime.points,
        priceAxisWidth: priceAxisWidth.value,
        priceRangeScale: runtime.priceRangeScale,
        priceScaleMode: runtime.priceScaleMode,
        resources: resources.value,
        subIndicatorPanes: runtime.subIndicatorPanes,
        viewport: runtime.viewport,
        watermarkOpacity,
        width: runtime.size.width,
      });
    }, [candleLabels, priceAxisWidth, resources, watermarkOpacity]);

    const handleChartWidthChange = useCallback((nextChartWidth: number) => {
      setChartWidth((currentChartWidth) =>
        currentChartWidth === nextChartWidth
          ? currentChartWidth
          : nextChartWidth,
      );
    }, []);

    const handleVisiblePointRangeChange = useCallback(
      (startIndex: number, endIndex: number) => {
        onVisiblePointRangeChange?.({ endIndex, startIndex });
      },
      [onVisiblePointRangeChange],
    );

    useLayoutEffect(() => {
      scheduleOnUI(() => {
        'worklet';

        const runtime = chartRuntime.value;
        const nextRuntime = chartSettings.options.crossLine
          ? runtime
          : {
              ...runtime,
              ...reduceTradingViewNativeChartRuntime(runtime, {
                type: 'crosshairHidden',
              }),
            };
        chartRuntime.value = {
          ...nextRuntime,
          chartSettings,
          currentPriceLabel,
        };
      });
    }, [chartRuntime, chartSettings, currentPriceLabel]);

    useAnimatedReaction(
      () => {
        const runtime = chartRuntime.value;
        const nextChartWidth = getTradingViewNativeChartWidth(
          runtime.size.width,
          priceAxisWidth.value,
        );
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          chartWidth: nextChartWidth,
          offset: decayOffset.value,
          pointCount: runtime.points.length,
          type: 'panMoved',
        });
        const range = getTradingViewNativeChartRuntimeVisiblePointRange({
          chartWidth: nextChartWidth,
          pointCount: runtime.points.length,
          state: nextRuntimeState,
        });
        return {
          chartWidth: nextChartWidth,
          offset: nextRuntimeState.viewport.offset,
          pointCount: runtime.points.length,
          ...range,
        };
      },
      (current, previous) => {
        'worklet';

        const runtime = chartRuntime.value;
        if (current.chartWidth !== previous?.chartWidth) {
          scheduleOnRN(handleChartWidthChange, current.chartWidth);
        }
        if (runtime.viewport.offset !== current.offset) {
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              chartWidth: current.chartWidth,
              offset: current.offset,
              pointCount: current.pointCount,
              type: 'panMoved',
            },
          );
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
          };
        }
        if (
          current.chartWidth > 0 &&
          current.pointCount > 0 &&
          (current.chartWidth !== previous?.chartWidth ||
            current.startIndex !== previous?.startIndex ||
            current.endIndex !== previous?.endIndex)
        ) {
          scheduleOnRN(
            handleVisiblePointRangeChange,
            current.startIndex,
            current.endIndex,
          );
        }
      },
    );

    useLayoutEffect(() => {
      onChartWidthChange?.(chartWidth);
    }, [chartWidth, onChartWidthChange]);

    useLayoutEffect(() => {
      const dataUpdateMetadata = getTradingViewNativeDataUpdateMetadata({
        points,
        previousLatestTimestamp: previousLatestTimestampRef.current,
      });
      const previousPictureInput = previousPictureInputRef.current;
      const indicatorSeriesKey = indicatorSeries
        .map((series) => series.key)
        .join('|');
      const shouldReplaceAllPoints =
        previousPictureInput.chartPictureVersion !== chartPictureVersion ||
        previousPictureInput.pointCount !== points.length;
      const shouldReplaceAllIndicatorSeries =
        shouldReplaceTradingViewNativeIndicatorSeries({
          current: {
            chartPictureVersion,
            pointCount: points.length,
            seriesKey: indicatorSeriesKey,
            settingsKey: indicatorSeriesSettingsKey,
          },
          previous: {
            chartPictureVersion: previousPictureInput.chartPictureVersion,
            pointCount: previousPictureInput.pointCount,
            seriesKey: previousPictureInput.indicatorSeriesKey,
            settingsKey: previousPictureInput.indicatorSeriesSettingsKey,
          },
        });
      const subIndicatorPanesUpdate =
        getTradingViewNativeSubIndicatorPanesUpdate({
          current: {
            chartPictureVersion,
            pointCount: points.length,
            structureKey: subIndicatorPanesStructureKey,
          },
          panes: subIndicatorPanes,
          previous: {
            chartPictureVersion: previousPictureInput.chartPictureVersion,
            pointCount: previousPictureInput.pointCount,
            structureKey: previousPictureInput.subIndicatorPanesStructureKey,
          },
        });
      previousLatestTimestampRef.current = dataUpdateMetadata.latestTimestamp;
      previousPictureInputRef.current = {
        chartPictureVersion,
        indicatorSeriesKey,
        indicatorSeriesSettingsKey,
        pointCount: points.length,
        subIndicatorPanesStructureKey: subIndicatorPanesUpdate.structureKey,
      };
      const nextSize = chartSize;
      const replacementPoints = shouldReplaceAllPoints ? points : null;
      const replacementIndicatorSeries = shouldReplaceAllIndicatorSeries
        ? indicatorSeries
        : null;
      const replacementSubIndicatorPanes =
        subIndicatorPanesUpdate.replacementPanes;
      const latestSubIndicatorPaneValues =
        subIndicatorPanesUpdate.latestPaneValues;
      const latestPoint = points[points.length - 1] ?? null;
      const latestIndicatorSeriesValues = indicatorSeries.map((series) => ({
        key: series.key,
        value: series.values[series.values.length - 1] ?? null,
      }));

      scheduleOnUI(() => {
        'worklet';

        const runtime = chartRuntime.value;
        const runtimeAfterInitialMeasure = {
          ...runtime,
          ...reduceTradingViewNativeChartRuntime(runtime, {
            type: 'initialWidthMeasured',
            width: nextSize.width,
          }),
        };
        const nextPoints =
          replacementPoints ??
          (latestPoint ? [...runtime.points.slice(0, -1), latestPoint] : []);
        const nextIndicatorSeries =
          replacementIndicatorSeries ??
          runtime.indicatorSeries.map((series, index) => {
            const latestValue = latestIndicatorSeriesValues[index];
            if (!latestValue || latestValue.key !== series.key) {
              return series;
            }
            return {
              ...series,
              values: latestPoint
                ? [...series.values.slice(0, -1), latestValue.value]
                : [],
            };
          });
        const nextSubIndicatorPanes =
          replacementSubIndicatorPanes ??
          applyTradingViewNativeSubIndicatorLatestPaneValues({
            hasLatestPoint: Boolean(latestPoint),
            latestPaneValues: latestSubIndicatorPaneValues,
            panes: runtime.subIndicatorPanes,
          });
        const nextChartWidth = getTradingViewNativeChartWidth(
          nextSize.width,
          priceAxisWidth.value,
        );
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(
          runtimeAfterInitialMeasure,
          {
            appendedPointCount: dataUpdateMetadata.appendedPointCount,
            chartWidth: nextChartWidth,
            pointCount: nextPoints.length,
            type: 'dataUpdated',
          },
        );
        const nextOffset = nextRuntimeState.viewport.offset;
        const offsetDelta = nextOffset - runtime.viewport.offset;
        decayOffset.value = nextOffset;
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
          candleIntervalSeconds,
          chartType,
          hasVolume,
          indicatorSeries: nextIndicatorSeries,
          panGesture: {
            ...runtime.panGesture,
            startOffset: getTradingViewNativeGestureStartOffsetAfterDataUpdate({
              currentZoomScale: runtime.viewport.zoomScale,
              offsetDelta,
              startOffset: runtime.panGesture.startOffset,
              startZoomScale: runtime.viewport.zoomScale,
            }),
          },
          pinchGesture: {
            ...runtime.pinchGesture,
            startOffset: getTradingViewNativeGestureStartOffsetAfterDataUpdate({
              currentZoomScale: runtime.viewport.zoomScale,
              offsetDelta,
              startOffset: runtime.pinchGesture.startOffset,
              startZoomScale: runtime.pinchGesture.startZoomScale,
            }),
          },
          points: nextPoints,
          size: nextSize,
          subIndicatorPanes: nextSubIndicatorPanes,
        };
      });
    }, [
      candleIntervalSeconds,
      chartType,
      chartPictureVersion,
      chartRuntime,
      chartSize,
      decayOffset,
      hasVolume,
      indicatorSeries,
      indicatorSeriesSettingsKey,
      points,
      priceAxisWidth,
      subIndicatorPanes,
      subIndicatorPanesStructureKey,
    ]);

    useLayoutEffect(() => {
      if (
        !viewportRequest ||
        (viewportRequest.requestId ===
          appliedViewportRequestRef.current.requestId &&
          chartWidth === appliedViewportRequestRef.current.chartWidth) ||
        chartWidth <= 0 ||
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

      const preserveVisibleAnchor = Boolean(
        viewportRequest.preserveVisibleAnchor,
      );
      const requestId = viewportRequest.requestId;
      appliedViewportRequestRef.current = { chartWidth, requestId };

      scheduleOnUI(() => {
        'worklet';

        const runtime = chartRuntime.value;
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          chartWidth,
          pointCount,
          pointRange,
          type: 'viewportRequested',
        });
        const nextViewport = nextRuntimeState.viewport;

        cancelAnimation(decayOffset);
        decayOffset.value = nextViewport.offset;
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
          panGesture: {
            startOffset: preserveVisibleAnchor
              ? getTradingViewNativePanStartOffsetAfterViewportPreservation({
                  currentTranslationX: runtime.panGesture.translationX,
                  dragRatio: TRADING_VIEW_NATIVE_PAN_DRAG_RATIO,
                  preservedOffset: nextViewport.offset,
                })
              : nextViewport.offset,
            translationX: preserveVisibleAnchor
              ? runtime.panGesture.translationX
              : 0,
          },
          pinchGesture: {
            ...runtime.pinchGesture,
            currentScale: runtime.pinchGesture.isActive
              ? runtime.pinchGesture.currentScale
              : 1,
            scaleBaseline: runtime.pinchGesture.isActive
              ? runtime.pinchGesture.currentScale
              : 1,
            startOffset: nextViewport.offset,
            startZoomScale: nextViewport.zoomScale,
          },
        };
        if (onViewportRequestApplied) {
          scheduleOnRN(onViewportRequestApplied, requestId);
        }
      });
    }, [
      chartRuntime,
      chartWidth,
      decayOffset,
      onViewportRequestApplied,
      pointCount,
      points,
      viewportRequest,
    ]);

    const {
      handleAutoScalePress: handlePriceScaleAutoPress,
      handleLogScalePress: handlePriceScaleLogPress,
      handlePointerLeave: handleChartPointerLeave,
      handlePointerMove: handleChartPointerMove,
      handleTouchStart: handleChartTouchStart,
      isAutoScale: isPriceScaleAuto,
      isVisible: isPriceScaleControlsVisible,
      mainPriceAxisLayout,
      mode: priceScaleMode,
      priceAxisControlWidth,
      resetGesture: priceAxisResetGesture,
      scaleGesture: priceAxisScaleGesture,
    } = useTradingViewNativePriceScale({
      chartRuntime,
      chartSize,
      chartWidth,
      decayOffset,
      isEnabled: chartSettings.options.yAxis,
      isLogScaleAvailable,
      priceAxisWidth,
      subIndicatorPanes,
    });

    const chartGestures = useTradingViewNativeChartGestures({
      chartRuntime,
      decayOffset,
      isClickInteractionEnabled: chartSettings.options.clickInteraction,
      isCrosshairEnabled: chartSettings.options.crossLine,
      priceAxisResetGesture,
      priceAxisScaleGesture,
      priceAxisWidth,
    });
    const handleChartLayout = useCallback((event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;
      const nextSize = {
        height: Math.round(height),
        width: Math.round(width),
      };
      setChartSize((currentSize) =>
        currentSize.height === nextSize.height &&
        currentSize.width === nextSize.width
          ? currentSize
          : nextSize,
      );
    }, []);

    return (
      <Stack
        flex={1}
        minHeight={0}
        onLayout={handleChartLayout}
        onPointerLeave={handleChartPointerLeave}
        opacity={isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1}
      >
        <GestureDetector gesture={chartGestures}>
          <Canvas
            testID={testID}
            style={{ flex: 1 }}
            onPointerMove={handleChartPointerMove}
            onTouchStart={handleChartTouchStart}
          >
            <Picture picture={picture} />
          </Canvas>
        </GestureDetector>
        {chartSettings.options.yAxis && priceAxisControlWidth > 0 ? (
          <TradingViewNativePriceScaleControls
            backgroundColor={background}
            isAutoScale={isPriceScaleAuto}
            isLogScaleAvailable={isLogScaleAvailable}
            isVisible={isPriceScaleControlsVisible}
            mainChartBottomInset={mainPriceAxisLayout.bottomInset}
            onAutoScalePress={handlePriceScaleAutoPress}
            onLogScalePress={handlePriceScaleLogPress}
            priceAxisWidth={priceAxisControlWidth}
            priceScaleMode={priceScaleMode}
            testID={testID}
          />
        ) : null}
      </Stack>
    );
  },
);

TradingViewNativeChart.displayName = 'TradingViewNativeChart';
