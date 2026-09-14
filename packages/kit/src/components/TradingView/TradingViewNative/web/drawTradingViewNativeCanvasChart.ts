import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  type ITradingViewNativeChartSceneColors,
  buildTradingViewNativeChartScene,
} from '../utils/chartScene';

import {
  drawTradingViewNativeCanvasScene,
  getTradingViewNativeCanvasFont,
} from './chartCanvasRenderer';

import type {
  ITradingViewNativeCandleLabels,
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeChartType,
  ITradingViewNativePriceScaleMode,
} from '../types';
import type { ITradingViewNativeIndicatorSeries } from '../utils/chartIndicators';
import type { ITradingViewNativeChartRuntimeState } from '../utils/chartRuntime';
import type { ITradingViewNativePriceRange } from '../utils/chartViewport';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

interface IDrawTradingViewNativeCanvasChartOptions {
  candleIntervalSeconds: number;
  canvas: HTMLCanvasElement;
  chartComponents: readonly ITradingViewNativeChartLeafComponent[];
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  colors: ITradingViewNativeChartSceneColors;
  extendTimeAxisBorderToCanvasEdge: boolean;
  hasVolume: boolean;
  candleLabels: ITradingViewNativeCandleLabels;
  currentPriceLabel: string;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  isMobileLayout: boolean;
  points: IMarketTokenKLineDataPoint[];
  pinnedPriceRange: ITradingViewNativePriceRange | null;
  priceAxisFontSize: number;
  priceAxisWidth: number;
  priceAxisTickCount?: number;
  priceRangeScale: number;
  priceScaleMode: ITradingViewNativePriceScaleMode;
  runtimeState: ITradingViewNativeChartRuntimeState;
  showLegend: boolean;
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  timeAxisFontSize: number;
  timeAxisHeight: number;
  timeAxisBorderWidth?: number;
  watermarkImage: HTMLImageElement | null;
  watermarkOpacity: number;
}

export function drawTradingViewNativeCanvasChart({
  candleIntervalSeconds,
  canvas,
  chartComponents,
  chartSettings,
  chartType,
  colors,
  extendTimeAxisBorderToCanvasEdge,
  hasVolume,
  candleLabels,
  currentPriceLabel,
  indicatorSeries,
  isMobileLayout,
  points,
  pinnedPriceRange,
  priceAxisFontSize,
  priceAxisWidth,
  priceAxisTickCount,
  priceRangeScale,
  priceScaleMode,
  runtimeState,
  showLegend,
  subIndicatorPanes,
  timeAxisFontSize,
  timeAxisHeight,
  timeAxisBorderWidth,
  watermarkImage,
  watermarkOpacity,
}: IDrawTradingViewNativeCanvasChartOptions) {
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
    chartComponents,
    chartSettings,
    chartType,
    crosshair: runtimeState.crosshair,
    extendTimeAxisBorderToCanvasEdge,
    hasVolume,
    height,
    indicatorSeries,
    isMobileLayout,
    measureTextWidth: (text, font) => {
      context.font = getTradingViewNativeCanvasFont(
        font,
        priceAxisFontSize,
        timeAxisFontSize,
      );
      return context.measureText(text).width;
    },
    candleLabels,
    currentPriceLabel,
    points,
    pinnedPriceRange,
    priceAxisFontSize,
    priceAxisWidth,
    priceAxisTickCount,
    priceRangeScale,
    priceScaleMode,
    showLegend,
    subIndicatorPanes,
    timeAxisFontSize,
    timeAxisHeight,
    viewport: runtimeState.viewport,
    watermarkOpacity,
    width,
  });
  drawTradingViewNativeCanvasScene({
    colors,
    commands: scene.commands,
    context,
    customPaintStyles: scene.customPaintStyles,
    priceAxisFontSize,
    timeAxisFontSize,
    timeAxisBorderWidth,
    watermarkImage,
  });
  return scene;
}
