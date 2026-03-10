import type { ILightweightChartTheme } from '../types';
import type {
  AreaSeriesPartialOptions,
  ChartOptions,
  DeepPartial,
} from 'lightweight-charts';

export function createChartOptions(
  theme: ILightweightChartTheme,
  showPriceScale = false,
): DeepPartial<ChartOptions> {
  return {
    layout: {
      background: { color: theme.bgColor },
      textColor: theme.textSubduedColor,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    crosshair: {
      mode: 1, // CrosshairMode.Normal
      vertLine: {
        color: theme.lineColor,
        width: 1,
        style: 3,
        labelVisible: false,
      },
      horzLine: {
        visible: false,
      },
    },
    timeScale: {
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
    priceFormat: {
      type: 'custom',
      formatter: (price: number) => `${price.toFixed(2)}%`,
    },
  };
}
