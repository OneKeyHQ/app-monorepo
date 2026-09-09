import {
  getTradingViewNativeChartWidth,
  getTradingViewNativePriceAxisWidth,
  getTradingViewNativeScaledPriceAxisLabel,
} from '../utils/chartLayout';
import { isTradingViewNativeMainPriceAxisTouch } from '../utils/priceAxisScale';
import {
  PRICE_SCALE_CONTROL_WEB_SIZING,
  getTradingViewNativePriceScaleControlsMinimumAxisWidth,
} from '../utils/priceScaleControls';

import { getTradingViewNativeCanvasFont } from './chartCanvasRenderer';

import type { ITradingViewNativePriceScaleMode } from '../types';
import type { ITradingViewNativePriceRange } from '../utils/chartViewport';

export interface ITradingViewNativeCanvasPriceScale {
  mode: ITradingViewNativePriceScaleMode;
  pinnedPriceRange?: ITradingViewNativePriceRange | null;
  rangeScale: number;
}

export interface ITradingViewNativeCanvasPriceAxisLabels {
  autoPriceRange: ITradingViewNativePriceRange | null;
  chartComponentPrice: string;
  currentPrice: string;
  widestIndicatorPrice: string;
  widestPrice: string;
  widestSubIndicator: string;
  widestVolume: string;
  yAxisVisible: boolean;
}

export function getTradingViewNativeCanvasPriceAxisWidth(
  canvas: HTMLCanvasElement,
  labels: ITradingViewNativeCanvasPriceAxisLabels,
  priceScale: ITradingViewNativeCanvasPriceScale,
  priceAxisFontSize?: number,
) {
  if (!labels.yAxisVisible) {
    return 0;
  }
  const context = canvas.getContext('2d');
  if (!context) {
    return getTradingViewNativePriceAxisWidth({
      currentPriceLabelWidth: 0,
      minimumWidth: getTradingViewNativePriceScaleControlsMinimumAxisWidth(
        PRICE_SCALE_CONTROL_WEB_SIZING,
      ),
      widestPriceLabelWidth: 0,
    });
  }
  context.font = getTradingViewNativeCanvasFont('priceAxis', priceAxisFontSize);
  const priceRange = priceScale.pinnedPriceRange ?? labels.autoPriceRange;
  const scaledPriceLabel = priceRange
    ? getTradingViewNativeScaledPriceAxisLabel({
        autoPriceRange: priceRange,
        baseLabel: labels.widestPrice,
        priceRangeScale: priceScale.rangeScale,
        priceScaleMode: priceScale.mode,
      })
    : labels.widestPrice;
  return getTradingViewNativePriceAxisWidth({
    currentPriceLabelWidth: context.measureText(labels.currentPrice).width,
    minimumWidth: getTradingViewNativePriceScaleControlsMinimumAxisWidth(
      PRICE_SCALE_CONTROL_WEB_SIZING,
    ),
    widestPriceLabelWidth: Math.max(
      context.measureText(labels.chartComponentPrice).width,
      context.measureText(labels.widestPrice).width,
      context.measureText(scaledPriceLabel).width,
      context.measureText(labels.widestIndicatorPrice).width,
      context.measureText(labels.widestSubIndicator).width,
    ),
    widestVolumeLabelWidth: context.measureText(labels.widestVolume).width,
  });
}

export function getTradingViewNativeCanvasChartWidth(
  canvas: HTMLCanvasElement,
  labels: ITradingViewNativeCanvasPriceAxisLabels,
  priceScale: ITradingViewNativeCanvasPriceScale,
  priceAxisFontSize?: number,
) {
  return getTradingViewNativeChartWidth(
    canvas.getBoundingClientRect().width,
    getTradingViewNativeCanvasPriceAxisWidth(
      canvas,
      labels,
      priceScale,
      priceAxisFontSize,
    ),
  );
}

export function isTradingViewNativeCanvasMainPriceAxisPointer({
  canvas,
  clientX,
  clientY,
  labels,
  paneCount,
  priceAxisFontSize,
  priceScale,
  timeAxisHeight,
}: {
  canvas: HTMLCanvasElement;
  clientX: number;
  clientY: number;
  labels: ITradingViewNativeCanvasPriceAxisLabels;
  paneCount: number;
  priceAxisFontSize?: number;
  priceScale: ITradingViewNativeCanvasPriceScale;
  timeAxisHeight?: number;
}) {
  const canvasRect = canvas.getBoundingClientRect();
  // Measure with the rendered font, otherwise the compact axis gets a hit
  // region sized for the default font and steals wheel input from the chart.
  const priceAxisWidth = getTradingViewNativeCanvasPriceAxisWidth(
    canvas,
    labels,
    priceScale,
    priceAxisFontSize,
  );
  const x = clientX - canvasRect.left;
  const y = clientY - canvasRect.top;
  return isTradingViewNativeMainPriceAxisTouch({
    height: canvasRect.height,
    paneCount,
    priceAxisWidth,
    timeAxisHeight,
    width: canvasRect.width,
    x,
    y,
  });
}
