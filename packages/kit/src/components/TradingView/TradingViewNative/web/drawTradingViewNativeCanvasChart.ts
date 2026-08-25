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
  ITradingViewNativeChartType,
  ITradingViewNativePriceScaleMode,
} from '../types';
import type { ITradingViewNativeIndicatorSeries } from '../utils/chartIndicators';
import type { ITradingViewNativeChartRuntimeState } from '../utils/chartRuntime';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

interface IDrawTradingViewNativeCanvasChartOptions {
  candleIntervalSeconds: number;
  canvas: HTMLCanvasElement;
  chartSettings: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  colors: ITradingViewNativeChartSceneColors;
  hasVolume: boolean;
  candleLabels: ITradingViewNativeCandleLabels;
  currentPriceLabel: string;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  points: IMarketTokenKLineDataPoint[];
  priceAxisWidth: number;
  priceRangeScale: number;
  priceScaleMode: ITradingViewNativePriceScaleMode;
  runtimeState: ITradingViewNativeChartRuntimeState;
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  watermarkImage: HTMLImageElement | null;
  watermarkOpacity: number;
}

export function drawTradingViewNativeCanvasChart({
  candleIntervalSeconds,
  canvas,
  chartSettings,
  chartType,
  colors,
  hasVolume,
  candleLabels,
  currentPriceLabel,
  indicatorSeries,
  points,
  priceAxisWidth,
  priceRangeScale,
  priceScaleMode,
  runtimeState,
  subIndicatorPanes,
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
    chartSettings,
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
    currentPriceLabel,
    points,
    priceAxisWidth,
    priceRangeScale,
    priceScaleMode,
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
