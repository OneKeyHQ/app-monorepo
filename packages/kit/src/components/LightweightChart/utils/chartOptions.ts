import type { ILightweightChartTheme } from '../types';
import type {
  AreaSeriesPartialOptions,
  ChartOptions,
  DeepPartial,
} from 'lightweight-charts';

const CHART_FONT_FAMILY =
  'Roobert, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export function createChartOptions(
  theme: ILightweightChartTheme,
  showPriceScale = false,
  fontSize?: number,
  priceScaleMargins?: { top: number; bottom: number },
  showTimeScale = true,
): DeepPartial<ChartOptions> {
  return {
    layout: {
      background: { color: theme.bgColor },
      textColor: theme.textSubduedColor,
      fontSize: fontSize ?? 12,
      fontFamily: CHART_FONT_FAMILY,
      attributionLogo: false,
    },
    crosshair: {
      mode: 1, // CrosshairMode.Normal
      vertLine: {
        color: 'rgba(150, 150, 150, 0.4)',
        width: 1,
        style: 3,
        labelVisible: false,
      },
      horzLine: {
        visible: false,
      },
    },
    timeScale: {
      visible: showTimeScale,
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
      lockVisibleTimeRangeOnResize: true,
    },
    rightPriceScale: {
      visible: showPriceScale,
      borderVisible: false,
      ...(priceScaleMargins && { scaleMargins: priceScaleMargins }),
    },
    leftPriceScale: {
      visible: false,
    },
    handleScroll: {
      mouseWheel: false,
      pressedMouseMove: false,
      horzTouchDrag: false,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: false,
      mouseWheel: false,
      pinch: false,
      axisDoubleClickReset: false,
    },
    kineticScroll: {
      touch: false,
      mouse: false,
    },
  };
}

export function createAreaSeriesOptions(
  theme: ILightweightChartTheme,
  lineWidth = 3,
  priceFormatter?: (price: number) => string,
): AreaSeriesPartialOptions {
  const normalizedLineWidth = Math.min(
    4,
    Math.max(1, Math.round(lineWidth)),
  ) as 1 | 2 | 3 | 4;

  return {
    topColor: theme.topColor,
    bottomColor: theme.bottomColor,
    lineColor: theme.lineColor,
    lineWidth: normalizedLineWidth,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerRadius: 5,
    crosshairMarkerBorderColor: theme.lineColor,
    crosshairMarkerBackgroundColor: '#ffffff',
    priceFormat: {
      type: 'custom',
      formatter: priceFormatter ?? ((price: number) => `${price.toFixed(2)}%`),
    },
  };
}
