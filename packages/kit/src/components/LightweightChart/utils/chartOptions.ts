import type {
  ILightweightChartPriceScalePosition,
  ILightweightChartTheme,
} from '../types';
import type {
  AreaSeriesPartialOptions,
  AutoscaleInfoProvider,
  ChartOptions,
  DeepPartial,
  SeriesOptionsCommon,
  TickMarkFormatter,
} from 'lightweight-charts';

const CHART_FONT_FAMILY =
  'Roobert, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Shared crosshair defaults. Every chart that does not opt into an override
// keeps exactly these values.
const DEFAULT_CROSSHAIR_VERT_LINE_COLOR = 'rgba(150, 150, 150, 0.4)';
// lightweight-charts `LineStyle.LargeDashed`.
const DEFAULT_CROSSHAIR_VERT_LINE_STYLE = 3;

const CHART_TICK_MARK_TYPE = {
  Year: 0,
  Month: 1,
  DayOfMonth: 2,
  Time: 3,
  TimeWithSeconds: 4,
} as const;

const timeScaleFormatterCache = new Map<string, Intl.DateTimeFormat>();

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

function getTimeScaleFormatOptions(
  tickMarkType: Parameters<TickMarkFormatter>[1],
): Intl.DateTimeFormatOptions {
  switch (tickMarkType) {
    case CHART_TICK_MARK_TYPE.Year:
      return { year: 'numeric' };
    case CHART_TICK_MARK_TYPE.Month:
      return { month: 'short' };
    case CHART_TICK_MARK_TYPE.DayOfMonth:
      return { day: 'numeric' };
    case CHART_TICK_MARK_TYPE.Time:
      return {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      };
    case CHART_TICK_MARK_TYPE.TimeWithSeconds:
      return {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      };
    default:
      return { month: 'short', day: 'numeric' };
  }
}

export function formatChartTickMarkInTimeZone({
  time,
  tickMarkType,
  timeZone,
  locale,
}: {
  time: Parameters<TickMarkFormatter>[0];
  tickMarkType: Parameters<TickMarkFormatter>[1];
  timeZone: string;
  locale?: string;
}) {
  let date: Date;
  let formatterTimeZone = timeZone;

  if (typeof time === 'number') {
    date = new Date(time * 1000);
  } else if (typeof time === 'string') {
    const businessDayParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(time);
    if (businessDayParts) {
      date = new Date(
        Date.UTC(
          Number(businessDayParts[1]),
          Number(businessDayParts[2]) - 1,
          Number(businessDayParts[3]),
        ),
      );
      formatterTimeZone = 'UTC';
    } else {
      date = new Date(time);
    }
  } else {
    date = new Date(Date.UTC(time.year, time.month - 1, time.day));
    formatterTimeZone = 'UTC';
  }

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const formatterKey = `${locale ?? ''}|${formatterTimeZone}|${tickMarkType}`;
  let formatter = timeScaleFormatterCache.get(formatterKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      ...getTimeScaleFormatOptions(tickMarkType),
      timeZone: formatterTimeZone,
    });
    timeScaleFormatterCache.set(formatterKey, formatter);
  }
  return formatter.format(date);
}

export function createChartOptions(
  theme: ILightweightChartTheme,
  showPriceScale = false,
  fontSize?: number,
  priceScaleMargins?: { top: number; bottom: number },
  showTimeScale = true,
  priceScaleEntireTextOnly = false,
  useTimeScaleTickMarkWithoutUnit = false,
  priceScaleMinimumWidth?: number,
  priceScalePosition: ILightweightChartPriceScalePosition = 'right',
  timeZone?: string,
  locale?: string,
  // Opt-in crosshair overrides. Charts that pass nothing keep the faint default
  // line below.
  crosshairVertLine?: { color?: string; style?: number },
  timeScaleRightOffsetPixels?: number,
): DeepPartial<ChartOptions> {
  const priceScaleOptions = {
    visible: showPriceScale,
    borderVisible: false,
    entireTextOnly: priceScaleEntireTextOnly,
    ...(priceScaleMargins && { scaleMargins: priceScaleMargins }),
    ...(priceScaleMinimumWidth !== undefined && {
      minimumWidth: priceScaleMinimumWidth,
    }),
  };
  let tickMarkFormatter: TickMarkFormatter | undefined;
  if (timeZone) {
    tickMarkFormatter = (time, tickMarkType) =>
      formatChartTickMarkInTimeZone({
        time,
        tickMarkType,
        timeZone,
        locale,
      });
  } else if (useTimeScaleTickMarkWithoutUnit) {
    tickMarkFormatter = formatChartTickMarkWithoutUnit;
  }

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
        color: crosshairVertLine?.color ?? DEFAULT_CROSSHAIR_VERT_LINE_COLOR,
        width: 1,
        style: crosshairVertLine?.style ?? DEFAULT_CROSSHAIR_VERT_LINE_STYLE,
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
      // `fixRightEdge` clamps any right offset back to zero. Scrolling and
      // scaling are off below, so the lock can go when a tail gap is asked for.
      ...(timeScaleRightOffsetPixels && timeScaleRightOffsetPixels > 0
        ? { fixRightEdge: false, rightOffsetPixels: timeScaleRightOffsetPixels }
        : { fixRightEdge: true }),
      lockVisibleTimeRangeOnResize: true,
      ...(tickMarkFormatter ? { tickMarkFormatter } : {}),
    },
    rightPriceScale: {
      ...(priceScalePosition === 'right'
        ? priceScaleOptions
        : { visible: false }),
    },
    leftPriceScale: {
      ...(priceScalePosition === 'left'
        ? priceScaleOptions
        : { visible: false }),
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

export function createLastValueSeriesOptions({
  showLastValue,
  showLastValuePriceLine,
  lastValueLabelColor,
}: {
  showLastValue?: boolean;
  showLastValuePriceLine?: boolean;
  lastValueLabelColor?: string;
}): Pick<
  SeriesOptionsCommon,
  'lastValueVisible' | 'priceLineVisible' | 'priceLineColor'
> {
  const lastValueVisible = !!showLastValue;
  return {
    lastValueVisible,
    priceLineVisible: lastValueVisible && showLastValuePriceLine !== false,
    // lightweight-charts paints the last-value axis label with the price line
    // color, so the label can be re-tinted even while the line stays hidden.
    // An empty string restores the series color.
    priceLineColor: lastValueLabelColor ?? '',
  };
}

// Widens the series' own autoscale range so a reference price that the data
// never touches still lands inside the visible price scale.
export function createReferenceLineAutoscaleInfoProvider(
  price: number,
): AutoscaleInfoProvider {
  return (baseImplementation) => {
    const autoscaleInfo = baseImplementation();
    if (!autoscaleInfo?.priceRange || !Number.isFinite(price)) {
      return autoscaleInfo;
    }
    return {
      ...autoscaleInfo,
      priceRange: {
        minValue: Math.min(autoscaleInfo.priceRange.minValue, price),
        maxValue: Math.max(autoscaleInfo.priceRange.maxValue, price),
      },
    };
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
