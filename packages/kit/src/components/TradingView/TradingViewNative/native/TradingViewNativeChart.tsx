import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Canvas, Picture, useFont, useSVG } from '@shopify/react-native-skia';
import { type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { Stack, useTheme, useThemeName } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION as CROSSHAIR_LONG_PRESS_DURATION,
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
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
} from '../utils/chartLayout';
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
  getTradingViewNativeGestureStartOffsetAfterDataUpdate,
  getTradingViewNativeMaxPanOffset,
  getTradingViewNativePanStartOffsetAfterViewportPreservation,
  getTradingViewNativeRelativePinchScale,
  getTradingViewNativeViewportPointRange,
} from '../utils/chartViewport';
import {
  type ITradingViewNativeSubIndicatorRenderPane,
  getTradingViewNativeSubIndicatorAxisLabel,
} from '../utils/subIndicatorRender';

import {
  createTradingViewNativeSkiaPicture,
  createTradingViewNativeSkiaResources,
} from './chartSkiaRenderer';

import type {
  ITradingViewNativeCandleLabels,
  ITradingViewNativeChartType,
  ITradingViewNativeInitialRightOffset,
} from '../types';

const PAN_DRAG_RATIO = 1.1;
const PAN_DECELERATION = 0.9982;
const MIN_FLING_VELOCITY = 100;
const SYSTEM_FONT_FAMILY = platformEnv.isNativeAndroid
  ? 'sans-serif'
  : 'System';
const PRICE_AXIS_FONT_SOURCE =
  require('@onekeyhq/components/src/hocs/Provider/fonts/GeistMono-Regular.ttf') as number;
const ONEKEY_WATERMARK_SOURCE =
  require('@onekeyhq/components/svg/illus/logo.svg') as number;
const EMPTY_SUB_INDICATOR_PANES: readonly ITradingViewNativeSubIndicatorRenderPane[] =
  [];

export interface ITradingViewNativeSubIndicatorLatestSeriesValue {
  key: string;
  paletteIndex?: number | null;
  value: number | null;
}

export interface ITradingViewNativeSubIndicatorLatestPaneValues {
  key: string;
  series: ITradingViewNativeSubIndicatorLatestSeriesValue[];
}

interface ITradingViewNativeSubIndicatorPanesPictureInput {
  chartPictureVersion: number;
  pointCount: number;
  structureKey: string;
}

export interface ITradingViewNativeSubIndicatorPanesUpdate {
  latestPaneValues: ITradingViewNativeSubIndicatorLatestPaneValues[];
  replacementPanes: readonly ITradingViewNativeSubIndicatorRenderPane[] | null;
  structureKey: string;
}

function stableSerializeTradingViewNativeStructure(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `array:[${value
      .map((item) => stableSerializeTradingViewNativeStructure(item))
      .join(',')}]`;
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'boolean:true' : 'boolean:false';
    case 'number':
      return `number:${value.toString()}`;
    case 'object': {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);
      for (let index = 1; index < keys.length; index += 1) {
        const current = keys[index];
        if (current !== undefined) {
          let insertIndex = index;
          while (insertIndex > 0 && (keys[insertIndex - 1] ?? '') > current) {
            keys[insertIndex] = keys[insertIndex - 1] ?? '';
            insertIndex -= 1;
          }
          keys[insertIndex] = current;
        }
      }
      return `object:{${keys
        .map(
          (key) =>
            `${stableSerializeTradingViewNativeStructure(
              key,
            )}:${stableSerializeTradingViewNativeStructure(record[key])}`,
        )
        .join(',')}}`;
    }
    case 'string':
      return `string:${value.length.toString()}:${value}`;
    case 'undefined':
      return 'undefined';
    default:
      return `${typeof value}:${String(value)}`;
  }
}

export function getTradingViewNativeSubIndicatorPanesStructureKey(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
): string {
  return stableSerializeTradingViewNativeStructure(
    panes.map((pane) => ({
      bands: pane.bands,
      fills: pane.fills,
      format: pane.format,
      indicator: pane.indicator,
      inputValues: pane.inputValues,
      instanceId: pane.instanceId,
      isVisible: pane.isVisible,
      key: pane.key,
      scale: pane.scale,
      series: pane.series.map((series) => ({
        id: series.id,
        key: series.key,
        paletteColors: series.palette?.colors ?? null,
        style: series.style,
        title: series.title,
        zOrder: series.zOrder,
      })),
      shortTitle: pane.shortTitle,
      title: pane.title,
    })),
  );
}

function getTradingViewNativeSubIndicatorLatestPaneValues(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
): ITradingViewNativeSubIndicatorLatestPaneValues[] {
  return panes.map((pane) => ({
    key: pane.key,
    series: pane.series.map((series) => ({
      key: series.key,
      paletteIndex: series.palette
        ? (series.palette.indexes[series.palette.indexes.length - 1] ?? null)
        : undefined,
      value: series.values[series.values.length - 1] ?? null,
    })),
  }));
}

export function getTradingViewNativeSubIndicatorPanesUpdate({
  current,
  panes,
  previous,
}: {
  current: ITradingViewNativeSubIndicatorPanesPictureInput;
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  previous: ITradingViewNativeSubIndicatorPanesPictureInput;
}): ITradingViewNativeSubIndicatorPanesUpdate {
  const shouldReplaceAllPanes =
    previous.chartPictureVersion !== current.chartPictureVersion ||
    previous.pointCount !== current.pointCount ||
    previous.structureKey !== current.structureKey;
  return {
    latestPaneValues: shouldReplaceAllPanes
      ? []
      : getTradingViewNativeSubIndicatorLatestPaneValues(panes),
    replacementPanes: shouldReplaceAllPanes ? panes : null,
    structureKey: current.structureKey,
  };
}

export function applyTradingViewNativeSubIndicatorLatestPaneValues({
  hasLatestPoint,
  latestPaneValues,
  panes,
}: {
  hasLatestPoint: boolean;
  latestPaneValues: readonly ITradingViewNativeSubIndicatorLatestPaneValues[];
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
}): readonly ITradingViewNativeSubIndicatorRenderPane[] {
  'worklet';

  if (panes.length !== latestPaneValues.length) {
    return panes;
  }
  for (let paneIndex = 0; paneIndex < panes.length; paneIndex += 1) {
    const pane = panes[paneIndex];
    const latestPane = latestPaneValues[paneIndex];
    if (
      pane.key !== latestPane?.key ||
      pane.series.length !== latestPane.series.length
    ) {
      return panes;
    }
    for (
      let seriesIndex = 0;
      seriesIndex < pane.series.length;
      seriesIndex += 1
    ) {
      const series = pane.series[seriesIndex];
      const latestSeries = latestPane.series[seriesIndex];
      if (
        series.key !== latestSeries?.key ||
        Boolean(series.palette) !== (latestSeries.paletteIndex !== undefined)
      ) {
        return panes;
      }
    }
  }

  // These arrays are UI-runtime-owned buffers. Updating their last slots keeps
  // same-candle realtime work constant instead of cloning full history.
  for (let paneIndex = 0; paneIndex < panes.length; paneIndex += 1) {
    const pane = panes[paneIndex];
    const latestPane = latestPaneValues[paneIndex];
    for (
      let seriesIndex = 0;
      seriesIndex < pane.series.length;
      seriesIndex += 1
    ) {
      const series = pane.series[seriesIndex];
      const latestSeries = latestPane.series[seriesIndex];
      if (hasLatestPoint) {
        const latestValueIndex = series.values.length - 1;
        if (latestValueIndex >= 0) {
          series.values[latestValueIndex] = latestSeries.value;
        }
        if (series.palette) {
          const latestPaletteIndex = series.palette.indexes.length - 1;
          if (latestPaletteIndex >= 0) {
            series.palette.indexes[latestPaletteIndex] =
              latestSeries.paletteIndex ?? null;
          }
        }
      } else {
        series.values.length = 0;
        if (series.palette) {
          series.palette.indexes.length = 0;
        }
      }
    }
  }
  return panes;
}

interface IChartSize {
  height: number;
  width: number;
}

interface ITradingViewNativeChartRuntime extends ITradingViewNativeChartRuntimeState {
  candleIntervalSeconds: number;
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  currentPriceLabel: string;
  hasVolume: boolean;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  panGesture: {
    startOffset: number;
    translationX: number;
  };
  pinchGesture: {
    anchorX: number;
    currentScale: number;
    isActive: boolean;
    scaleBaseline: number;
    startOffset: number;
    startZoomScale: number;
  };
  points: IMarketTokenKLineDataPoint[];
  size: IChartSize;
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
}

interface ITradingViewNativeChartProps {
  candleIntervalSeconds: number;
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  chartPictureVersion: number;
  currentPriceLabel: string;
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

function getInitialRuntime({
  candleIntervalSeconds,
  chartSettings,
  chartType,
  currentPriceLabel,
  hasVolume,
  indicatorSeries,
  initialRightOffset,
  points,
  subIndicatorPanes,
}: {
  candleIntervalSeconds: number;
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  currentPriceLabel: string;
  hasVolume: boolean;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  initialRightOffset?: ITradingViewNativeInitialRightOffset;
  points: IMarketTokenKLineDataPoint[];
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
}): ITradingViewNativeChartRuntime {
  return {
    ...createTradingViewNativeChartRuntimeState({
      initialRightOffset,
    }),
    candleIntervalSeconds,
    chartSettings,
    chartType,
    currentPriceLabel,
    hasVolume,
    indicatorSeries,
    panGesture: {
      startOffset: 0,
      translationX: 0,
    },
    pinchGesture: {
      anchorX: 0,
      currentScale: 1,
      isActive: false,
      scaleBaseline: 1,
      startOffset: 0,
      startZoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
    },
    points,
    size: { height: 0, width: 0 },
    subIndicatorPanes,
  };
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
    const [chartSize, setChartSize] = useState<IChartSize>({
      height: 0,
      width: 0,
    });
    const [chartWidth, setChartWidth] = useState(0);
    const subIndicatorPanesStructureKey =
      getTradingViewNativeSubIndicatorPanesStructureKey(subIndicatorPanes);
    const chartRuntime = useSharedValue(
      getInitialRuntime({
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
        widestPriceLabelWidth: Math.max(
          widestPriceLabelBounds.x + widestPriceLabelBounds.width,
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
        shouldReplaceAllPoints ||
        previousPictureInput.indicatorSeriesKey !== indicatorSeriesKey;
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
                  dragRatio: PAN_DRAG_RATIO,
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

    const chartGestures = useMemo(() => {
      const updateCrosshair = (x: number, y: number) => {
        'worklet';

        const runtime = chartRuntime.value;
        const nextRuntimeState = reduceTradingViewNativeChartRuntime(runtime, {
          chartWidth: getTradingViewNativeChartWidth(
            runtime.size.width,
            priceAxisWidth.value,
          ),
          height: runtime.size.height,
          pointCount: runtime.points.length,
          type: 'crosshairMoved',
          x,
          y,
        });
        chartRuntime.value = {
          ...runtime,
          ...nextRuntimeState,
        };
      };

      const crosshairGesture = Gesture.Pan()
        .enabled(chartSettings.options.crossLine)
        .activateAfterLongPress(CROSSHAIR_LONG_PRESS_DURATION)
        .maxPointers(1)
        .onStart((event) => {
          'worklet';

          cancelAnimation(decayOffset);
          updateCrosshair(event.x, event.y);
        })
        .onUpdate((event) => {
          'worklet';

          updateCrosshair(event.x, event.y);
        })
        .onFinalize(() => {
          'worklet';

          const runtime = chartRuntime.value;
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              type: 'crosshairHidden',
            },
          );
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
          };
        });

      const tapCrosshairGesture = Gesture.Tap()
        .enabled(
          chartSettings.options.crossLine &&
            chartSettings.options.clickInteraction,
        )
        .onEnd((event, success) => {
          'worklet';

          if (success) {
            cancelAnimation(decayOffset);
            updateCrosshair(event.x, event.y);
          }
        });

      const panGesture = Gesture.Pan()
        .activeOffsetX([-4, 4])
        .failOffsetY([-12, 12])
        .maxPointers(1)
        .onBegin(() => {
          'worklet';

          cancelAnimation(decayOffset);
        })
        .onStart(() => {
          'worklet';

          const runtime = chartRuntime.value;
          const nextChartWidth = getTradingViewNativeChartWidth(
            runtime.size.width,
            priceAxisWidth.value,
          );
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              chartWidth: nextChartWidth,
              hideCrosshair: true,
              offset: runtime.viewport.offset,
              pointCount: runtime.points.length,
              type: 'panMoved',
            },
          );
          const startOffset = nextRuntimeState.viewport.offset;
          decayOffset.value = startOffset;
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
            panGesture: {
              startOffset,
              translationX: 0,
            },
          };
        })
        .onUpdate((event) => {
          'worklet';

          const runtime = chartRuntime.value;
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              chartWidth: getTradingViewNativeChartWidth(
                runtime.size.width,
                priceAxisWidth.value,
              ),
              hideCrosshair: true,
              offset:
                runtime.panGesture.startOffset +
                event.translationX * PAN_DRAG_RATIO,
              pointCount: runtime.points.length,
              type: 'panMoved',
            },
          );
          const nextOffset = nextRuntimeState.viewport.offset;
          decayOffset.value = nextOffset;
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
            panGesture: {
              ...runtime.panGesture,
              translationX: event.translationX,
            },
          };
        })
        .onEnd((event) => {
          'worklet';

          const runtime = chartRuntime.value;
          const maxOffset = getTradingViewNativeMaxPanOffset({
            chartWidth: getTradingViewNativeChartWidth(
              runtime.size.width,
              priceAxisWidth.value,
            ),
            initialRightOffset: runtime.viewport.initialRightOffset,
            pointCount: runtime.points.length,
            zoomScale: runtime.viewport.zoomScale,
          });
          if (maxOffset <= 0) {
            const nextRuntimeState = reduceTradingViewNativeChartRuntime(
              runtime,
              {
                chartWidth: getTradingViewNativeChartWidth(
                  runtime.size.width,
                  priceAxisWidth.value,
                ),
                offset: 0,
                pointCount: runtime.points.length,
                type: 'panMoved',
              },
            );
            decayOffset.value = 0;
            chartRuntime.value = {
              ...runtime,
              ...nextRuntimeState,
            };
          } else if (Math.abs(event.velocityX) >= MIN_FLING_VELOCITY) {
            decayOffset.value = withDecay({
              clamp: [0, maxOffset],
              deceleration: PAN_DECELERATION,
              velocity: event.velocityX * PAN_DRAG_RATIO,
            });
          }
        })
        .onFinalize(() => {
          'worklet';

          const runtime = chartRuntime.value;
          chartRuntime.value = {
            ...runtime,
            panGesture: {
              ...runtime.panGesture,
              translationX: 0,
            },
          };
        });

      const pinchGesture = Gesture.Pinch()
        .onStart((event) => {
          'worklet';

          cancelAnimation(decayOffset);
          const runtime = chartRuntime.value;
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              chartWidth: getTradingViewNativeChartWidth(
                runtime.size.width,
                priceAxisWidth.value,
              ),
              hideCrosshair: true,
              offset: runtime.viewport.offset,
              pointCount: runtime.points.length,
              type: 'panMoved',
            },
          );
          const startOffset = nextRuntimeState.viewport.offset;
          decayOffset.value = startOffset;
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
            pinchGesture: {
              anchorX: event.focalX - CHART_HORIZONTAL_PADDING,
              currentScale: event.scale,
              isActive: true,
              scaleBaseline: event.scale,
              startOffset,
              startZoomScale: runtime.viewport.zoomScale,
            },
          };
        })
        .onUpdate((event) => {
          'worklet';

          const runtime = chartRuntime.value;
          const relativeScale = getTradingViewNativeRelativePinchScale({
            baselineScale: runtime.pinchGesture.scaleBaseline,
            gestureScale: event.scale,
          });
          const nextRuntimeState = reduceTradingViewNativeChartRuntime(
            runtime,
            {
              anchorX: runtime.pinchGesture.anchorX,
              baseViewport: {
                offset: runtime.pinchGesture.startOffset,
                zoomScale: runtime.pinchGesture.startZoomScale,
              },
              chartWidth: getTradingViewNativeChartWidth(
                runtime.size.width,
                priceAxisWidth.value,
              ),
              hideCrosshair: true,
              nextZoomScale:
                runtime.pinchGesture.startZoomScale * relativeScale,
              pointCount: runtime.points.length,
              type: 'zoomed',
            },
          );
          decayOffset.value = nextRuntimeState.viewport.offset;
          chartRuntime.value = {
            ...runtime,
            ...nextRuntimeState,
            pinchGesture: {
              ...runtime.pinchGesture,
              currentScale: event.scale,
            },
          };
        })
        .onFinalize(() => {
          'worklet';

          const runtime = chartRuntime.value;
          chartRuntime.value = {
            ...runtime,
            pinchGesture: {
              ...runtime.pinchGesture,
              currentScale: 1,
              isActive: false,
              scaleBaseline: 1,
            },
          };
        });

      return Gesture.Exclusive(
        crosshairGesture,
        tapCrosshairGesture,
        Gesture.Race(panGesture, pinchGesture),
      );
    }, [
      chartRuntime,
      chartSettings.options.clickInteraction,
      chartSettings.options.crossLine,
      decayOffset,
      priceAxisWidth,
    ]);

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
        opacity={isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1}
      >
        <GestureDetector gesture={chartGestures}>
          <Canvas testID={testID} style={{ flex: 1 }}>
            <Picture picture={picture} />
          </Canvas>
        </GestureDetector>
      </Stack>
    );
  },
);

TradingViewNativeChart.displayName = 'TradingViewNativeChart';
