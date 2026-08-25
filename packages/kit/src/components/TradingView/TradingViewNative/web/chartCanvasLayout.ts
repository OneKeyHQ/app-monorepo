import {
  getTradingViewNativeChartWidth,
  getTradingViewNativePriceAxisWidth,
} from '../utils/chartLayout';
import {
  getTradingViewNativeMainPriceAxisLayout,
  isTradingViewNativePriceAxisTouch,
} from '../utils/priceAxisScale';

import { getTradingViewNativeCanvasFont } from './chartCanvasRenderer';

export interface ITradingViewNativeCanvasPriceAxisLabels {
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
) {
  if (!labels.yAxisVisible) {
    return 0;
  }
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

export function getTradingViewNativeCanvasChartWidth(
  canvas: HTMLCanvasElement,
  labels: ITradingViewNativeCanvasPriceAxisLabels,
) {
  return getTradingViewNativeChartWidth(
    canvas.getBoundingClientRect().width,
    getTradingViewNativeCanvasPriceAxisWidth(canvas, labels),
  );
}

export function getTradingViewNativeCanvasPriceAxisPointerLayout({
  canvas,
  clientX,
  clientY,
  labels,
  paneCount,
}: {
  canvas: HTMLCanvasElement;
  clientX: number;
  clientY: number;
  labels: ITradingViewNativeCanvasPriceAxisLabels;
  paneCount: number;
}) {
  const canvasRect = canvas.getBoundingClientRect();
  const priceAxisWidth = getTradingViewNativeCanvasPriceAxisWidth(
    canvas,
    labels,
  );
  const x = clientX - canvasRect.left;
  const y = clientY - canvasRect.top;
  const mainPriceAxisLayout = getTradingViewNativeMainPriceAxisLayout({
    height: canvasRect.height,
    paneCount,
  });
  return {
    canvasRect,
    isPriceAxis: isTradingViewNativePriceAxisTouch({
      priceAxisHeight: mainPriceAxisLayout.height,
      priceAxisWidth,
      width: canvasRect.width,
      x,
      y,
    }),
    priceAxisHeight: mainPriceAxisLayout.height,
    priceAxisWidth,
    x,
    y,
  };
}
