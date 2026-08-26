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
  rangeScale: number;
}

export interface ITradingViewNativeCanvasPriceAxisLabels {
  autoPriceRange: ITradingViewNativePriceRange | null;
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
  context.font = getTradingViewNativeCanvasFont('priceAxis');
  const scaledPriceLabel = labels.autoPriceRange
    ? getTradingViewNativeScaledPriceAxisLabel({
        autoPriceRange: labels.autoPriceRange,
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
) {
  return getTradingViewNativeChartWidth(
    canvas.getBoundingClientRect().width,
    getTradingViewNativeCanvasPriceAxisWidth(canvas, labels, priceScale),
  );
}

export function isTradingViewNativeCanvasMainPriceAxisPointer({
  canvas,
  clientX,
  clientY,
  labels,
  paneCount,
  priceScale,
}: {
  canvas: HTMLCanvasElement;
  clientX: number;
  clientY: number;
  labels: ITradingViewNativeCanvasPriceAxisLabels;
  paneCount: number;
  priceScale: ITradingViewNativeCanvasPriceScale;
}) {
  const canvasRect = canvas.getBoundingClientRect();
  const priceAxisWidth = getTradingViewNativeCanvasPriceAxisWidth(
    canvas,
    labels,
    priceScale,
  );
  const x = clientX - canvasRect.left;
  const y = clientY - canvasRect.top;
  return isTradingViewNativeMainPriceAxisTouch({
    height: canvasRect.height,
    paneCount,
    priceAxisWidth,
    width: canvasRect.width,
    x,
    y,
  });
}
