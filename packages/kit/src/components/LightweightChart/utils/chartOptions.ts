import type { ILightweightChartTheme } from '../types';
import type {
  AreaSeriesPartialOptions,
  ChartOptions,
  DeepPartial,
  TickMarkFormatter,
} from 'lightweight-charts';

const CHART_FONT_FAMILY =
  'Roobert, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const CHART_TICK_MARK_TYPE = {
  Year: 0,
  Month: 1,
  DayOfMonth: 2,
  Time: 3,
  TimeWithSeconds: 4,
} as const;

function padTimePart(value: number) {
  return value.toString().padStart(2, '0');
}

function getDatePartsFromDate(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  };
}

function getDatePartsFromDateString(time: string) {
  const businessDayParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(time);
  if (businessDayParts) {
    return {
      year: Number(businessDayParts[1]),
      month: Number(businessDayParts[2]),
      day: Number(businessDayParts[3]),
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  return getDatePartsFromDate(new Date(time));
}

function getDatePartsFromChartTime(time: Parameters<TickMarkFormatter>[0]) {
  if (typeof time === 'number') {
    return getDatePartsFromDate(new Date(time * 1000));
  }

  if (typeof time === 'string') {
    return getDatePartsFromDateString(time);
  }

  return {
    year: time.year,
    month: time.month,
    day: time.day,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };
}

const formatChartTickMarkWithoutUnit: TickMarkFormatter = (
  time,
  tickMarkType,
) => {
  const dateParts = getDatePartsFromChartTime(time);
  if (
    !Number.isFinite(dateParts.year) ||
    !Number.isFinite(dateParts.month) ||
    !Number.isFinite(dateParts.day)
  ) {
    return null;
  }

  switch (tickMarkType) {
    case CHART_TICK_MARK_TYPE.Year:
      return dateParts.year.toString();
    case CHART_TICK_MARK_TYPE.Month:
      return padTimePart(dateParts.month);
    case CHART_TICK_MARK_TYPE.DayOfMonth:
      return padTimePart(dateParts.day);
    case CHART_TICK_MARK_TYPE.Time:
      return `${padTimePart(dateParts.hours)}:${padTimePart(
        dateParts.minutes,
      )}`;
    case CHART_TICK_MARK_TYPE.TimeWithSeconds:
      return `${padTimePart(dateParts.hours)}:${padTimePart(
        dateParts.minutes,
      )}:${padTimePart(dateParts.seconds)}`;
    default:
      return `${padTimePart(dateParts.month)}/${padTimePart(dateParts.day)}`;
  }
};

export function createChartOptions(
  theme: ILightweightChartTheme,
  showPriceScale = false,
  fontSize?: number,
  priceScaleMargins?: { top: number; bottom: number },
  showTimeScale = true,
  priceScaleEntireTextOnly = false,
  useTimeScaleTickMarkWithoutUnit = false,
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
        // Hide the price tag the crosshair draws on the price axis on hover; it
        // duplicates the custom hover tooltip (mirrors vertLine labelVisible).
        labelVisible: false,
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
      ...(useTimeScaleTickMarkWithoutUnit
        ? { tickMarkFormatter: formatChartTickMarkWithoutUnit }
        : {}),
    },
    rightPriceScale: {
      visible: showPriceScale,
      borderVisible: false,
      entireTextOnly: priceScaleEntireTextOnly,
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
