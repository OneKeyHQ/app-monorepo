import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@tamagui/core';
import { colord } from 'colord';
import { useIntl } from 'react-intl';

import { NumberSizeableText, SizableText, Stack } from '@onekeyhq/components';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { numberFormatAsRaw } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { LightweightChart } from '../LightweightChart';
import { downsampleChartLine } from '../LightweightChart/utils/downsampleChartLine';
import {
  formatChartPrice,
  formatChartPriceFull,
  formatChartPriceFullTicks,
  formatStockChartPrice,
} from '../LightweightChart/utils/formatChartPrice';
import {
  createLocalTimeScale,
  getLocalTimeOffsetSeconds,
} from '../LightweightChart/utils/localTimeScale';
import { getChartPriceFormatBase } from '../LightweightChart/utils/priceFormatBase';

import type {
  ILightweightChartNativeScrubOptions,
  ILightweightChartReferenceLine,
  ILightweightSecondaryLineChart,
} from '../LightweightChart/types';

const PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.1 } as const;
// The widest sub-$1 form the title can print is 4 leading zeros + 4 significant
// digits (`0.0000653`), i.e. 10 characters. Anything smaller makes the axis fall
// back to `$0.0₄653` and read as a different price than the title.
const PRICE_SCALE_MAX_CHARACTERS = 10;
// Keeps the pulsing tail dot clear of the current price label on the axis.
const LAST_POINT_RIGHT_GAP = 8;
const HOVER_PRICE_FORMATTER_OPTIONS = { currency: '$' } as const;
// The hover card follows the cursor on both axes. Fixed width so it can be
// flipped and clamped before it is drawn, and so figures like "$123,456.78"
// and the widest hover time ("2000/00/00, 00:00", ~99px at 11px brand sans)
// still fit on one line.
const HOVER_TOOLTIP_WIDTH = 120;
// Gap kept between the cursor and the card, and the smallest gap kept to the
// chart edges so the card never hangs off the plot.
const HOVER_TOOLTIP_CURSOR_OFFSET = 10;
const HOVER_TOOLTIP_EDGE_INSET = 8;
// The card rides above the cursor, far enough that the pointer never covers it.
const HOVER_TOOLTIP_CURSOR_RISE = 56;
// lightweight-charts stacks its canvases above the container's own
// z-index:auto children, so the card has to opt into a layer above them.
const HOVER_TOOLTIP_Z_INDEX = 5;
// While scrubbing, the line past the cursor is faded so the chart reads as
// "you are looking at this point, not the latest one". Theme colors carry their
// own alpha, so the tail is faded as a ratio of it rather than a flat value.
const DIMMED_LINE_ALPHA_RATIO = 0.35;
// lightweight-charts `LineStyle.Dashed`: reads as one continuous guide next to
// the sparser large-dashed default.
const CROSSHAIR_VERT_LINE_STYLE = 2;
// Width, in px/pt, given to each drawn point. Denser data turns into short
// jitter that no curve can smooth, so a chart keeps only as many evenly spaced
// closes as fit: a phone's 1D falls to about 20-minute bars, while a chart
// 1152px or wider keeps the full 5-minute series.
const MIN_POINT_SPACING = 4;
// A window that is still filling in (a session still running) keeps its time
// axis out to the window's end. The cap bounds the blank slots added for it.
const MAX_TIME_SPAN_EXTENSION_POINTS = 1500;
const MIN_TIME_SPAN_EXTENSION_STEP_SECONDS = 60;
// Clock marks the blank slots are aligned to, so axis labels land on them.
const TIME_SPAN_EXTENSION_MARK_SECONDS = 30 * 60;

/**
 * Times, after the series' last point, that carry the time axis out to
 * `timeSpanEnd`. The chart spaces points by index, so the slots repeat the
 * series' own step: the drawn part then takes the share of the width its time
 * takes of the window, and the axis can label the hours still ahead.
 */
export function buildStockPriceLineChartTimeExtension({
  data,
  timeSpanEnd,
}: {
  data: IMarketTokenChart;
  timeSpanEnd?: number;
}): number[] {
  const first = data[0]?.[0];
  const last = data.at(-1)?.[0];
  if (
    timeSpanEnd === undefined ||
    !Number.isFinite(timeSpanEnd) ||
    first === undefined ||
    last === undefined ||
    timeSpanEnd <= last
  ) {
    return [];
  }
  // The feed's finest bucket is a minute. One point has no step of its own,
  // and a series that is only its open plus a live quote seconds later would
  // otherwise spend every slot on the first few minutes of the window.
  const step =
    data.length > 1
      ? Math.max(
          MIN_TIME_SPAN_EXTENSION_STEP_SECONDS,
          (last - first) / (data.length - 1),
        )
      : MIN_TIME_SPAN_EXTENSION_STEP_SECONDS;
  if (!(step > 0)) {
    return [];
  }
  // The slots follow the series' own spacing out to the end, so each takes the
  // share of the width its time takes. Rounding puts the end on the nearest
  // step: a remainder under half a step is left to the last point instead of
  // getting a full slot of its own, which on a sparse series would make the
  // final minute look like a third of the session.
  const stepsToEnd = Math.round((timeSpanEnd - last) / step);
  const count = Math.min(MAX_TIME_SPAN_EXTENSION_POINTS, stepsToEnd);
  const times = Array.from({ length: count }, (_, index) =>
    Math.round(last + step * (index + 1)),
  );
  // The chart labels a slot with its own time, and the series' step is rarely
  // a whole number of minutes once it is thinned or ends on a live quote. The
  // slot nearest each half hour is moved onto it, so the axis reads 18:30 and
  // 19:00 instead of 18:31 and 19:01. A slot moves by under half a step, and
  // only when it stays between its neighbors, so positions are unaffected.
  for (
    let mark =
      Math.ceil((last + 1) / TIME_SPAN_EXTENSION_MARK_SECONDS) *
      TIME_SPAN_EXTENSION_MARK_SECONDS;
    mark <= timeSpanEnd;
    mark += TIME_SPAN_EXTENSION_MARK_SECONDS
  ) {
    const index = Math.round((mark - last) / step) - 1;
    const previous = index > 0 ? times[index - 1] : last;
    const next = times[index + 1] ?? Number.POSITIVE_INFINITY;
    if (index >= 0 && index < times.length && mark > previous && mark < next) {
      times[index] = mark;
    }
  }
  // The last slot is the window's end itself, so the axis reaches the close.
  // It moves by under half a step and stays after its neighbor. Left alone
  // when the cap cut the slots short of the end.
  if (count > 0 && count === stepsToEnd) {
    times[count - 1] = Math.round(timeSpanEnd);
  }
  return times;
}

function fadeLineColor(color: string) {
  const parsed = colord(color);
  if (!parsed.isValid()) {
    return color;
  }
  return parsed.alpha(parsed.alpha() * DIMMED_LINE_ALPHA_RATIO).toRgbString();
}

// lightweight-charts paints axis labels with the alpha channel dropped, so a
// translucent theme token (e.g. 45% white) would come out as a solid block.
// Flatten it over the page background first to keep the intended shade.
function flattenColor(color: string, background: string) {
  const foreground = colord(color);
  const base = colord(background);
  if (!foreground.isValid() || !base.isValid()) {
    return color;
  }
  const alpha = foreground.alpha();
  const top = foreground.toRgb();
  const bottom = base.toRgb();
  return colord({
    r: top.r * alpha + bottom.r * (1 - alpha),
    g: top.g * alpha + bottom.g * (1 - alpha),
    b: top.b * alpha + bottom.b * (1 - alpha),
    a: 1,
  }).toHex();
}

type IChartHoverData = {
  // Source (UTC) timestamp of the hovered point.
  time: number;
  // The same point on the chart's own time scale.
  chartTime: number;
  price: number;
  x: number;
  y: number;
};

/**
 * Point under the crosshair, reported so the price header above the chart can
 * follow the cursor. `changeValue` / `changePercent` are measured against the
 * first point of the range, so the header reads "what this range has done up to
 * the point under the cursor" rather than switching to an unrelated 24h figure.
 */
export type IStockPriceLineChartHoverPoint = {
  time: number;
  price: number;
  changeValue?: string;
  changePercent?: string;
};

export function StockPriceLineChart({
  data: sourceData,
  height,
  lineColorToken,
  pulseLastPoint,
  previousClose,
  showCurrentPriceLabel,
  priceScaleFormat,
  testID,
  hoverLabelShowsPrice = true,
  hoverLabelLargePrice = false,
  showPriceScale = true,
  showHoverLabel = true,
  clearHoverOnTouchEnd = false,
  onHoverChange,
  timeSpanEnd,
  trend = 'up',
}: {
  data: IMarketTokenChart;
  height: number;
  lineColorToken?: 'textSuccess' | 'green9' | 'bgAccent';
  // End (unix seconds) of a window that is still filling in. The time axis
  // runs on to it, leaving the part not reached yet empty on the right. Omit
  // for a series that spans its window.
  timeSpanEnd?: number;
  pulseLastPoint?: boolean;
  // Previous session close. Drawn as a dashed line with a "Prev close" tag and
  // its own axis label, and kept inside the price scale even when the range
  // never trades through it.
  previousClose?: number;
  // Pins the latest price to the price axis on the line's full-strength color,
  // without the dashed price line lightweight-charts pairs it with.
  showCurrentPriceLabel?: boolean;
  // `stock`: quotes keep two decimals on the axis and the last-price badge.
  // `full`: prints the whole figure up to $1M (`$2,377.04`, ticks `$2,540`)
  // instead of the compact `$2.38K`.
  priceScaleFormat?: 'stock' | 'full';
  testID?: string;
  // The hover card answers "when" and, by default, "how much". Hosts that must
  // not repeat the figure pass false to keep the card time-only.
  hoverLabelShowsPrice?: boolean;
  // Lifts the card's price to $bodyMdMedium, 2px under the time.
  hoverLabelLargePrice?: boolean;
  showPriceScale?: boolean;
  showHoverLabel?: boolean;
  clearHoverOnTouchEnd?: boolean;
  // Called with undefined when the pointer leaves the plot, and on unmount.
  onHoverChange?: (point: IStockPriceLineChartHoverPoint | undefined) => void;
  // Direction of the drawn range: the line, its fill, the live pulse and the
  // last-price badge all take the matching success or critical color.
  trend?: 'up' | 'down';
}) {
  const theme = useTheme();
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const [hoverData, setHoverData] = useState<IChartHoverData | null>(null);
  const useNativeScrub = platformEnv.isNative;
  const pointerTrackingRef = useRef(false);
  const startHover = useCallback(() => {
    pointerTrackingRef.current = true;
  }, []);
  const clearHover = useCallback(() => {
    pointerTrackingRef.current = false;
    setHoverData(null);
  }, []);
  const [chartWidth, setChartWidth] = useState(0);
  // Everything drawn or scrubbed reads the thinned series, so the hover snaps
  // only to points that sit on the line. Until the width is known, the full
  // series is drawn.
  const data = useMemo(() => {
    if (chartWidth <= 0) {
      return sourceData;
    }
    // Points are spaced over the width the series actually takes.
    const first = sourceData[0]?.[0];
    const last = sourceData.at(-1)?.[0];
    const coveredShare =
      timeSpanEnd !== undefined &&
      first !== undefined &&
      last !== undefined &&
      timeSpanEnd > last &&
      last > first
        ? (last - first) / (timeSpanEnd - first)
        : 1;
    return downsampleChartLine(
      sourceData,
      Math.max(2, Math.floor((chartWidth * coveredShare) / MIN_POINT_SPACING)),
    );
  }, [sourceData, chartWidth, timeSpanEnd]);
  // lightweight-charts places ticks and picks the date tick in UTC, so web
  // feeds it local wall-clock times to put the date tick on local midnight.
  // Native lays out its own ticks in local time and keeps the source times.
  const localTimeScale = useMemo(
    () => (platformEnv.isNative ? undefined : createLocalTimeScale(data)),
    [data],
  );
  const chartData = localTimeScale?.data ?? data;
  // The overlay line carries the blank slots: a null value is a gap on both
  // renderers, and its times join the time scale without drawing anything.
  const overlayData = useMemo<ILightweightSecondaryLineChart>(() => {
    const extension = buildStockPriceLineChartTimeExtension({
      data,
      timeSpanEnd,
    });
    if (extension.length === 0) {
      return chartData;
    }
    let previousTime = chartData.at(-1)?.[0] ?? -Infinity;
    return [
      ...chartData,
      ...extension.map((time): [number, null] => {
        // Same shift, and the same strictly increasing guard, as the series.
        const chartTime = Math.max(
          localTimeScale ? time + getLocalTimeOffsetSeconds(time) : time,
          previousTime + 1,
        );
        previousTime = chartTime;
        return [chartTime, null];
      }),
    ];
  }, [chartData, data, localTimeScale, timeSpanEnd]);
  // Read through a ref: a new `onHover` would rebuild the chart instance.
  const toUtcTimestampRef = useRef(localTimeScale?.toUtcTimestamp);
  toUtcTimestampRef.current = localTimeScale?.toUtcTimestamp;
  const priceFormatter = useCallback(
    (price: number) => {
      if (priceScaleFormat === 'full') return formatChartPriceFull(price);
      if (priceScaleFormat === 'stock') return formatStockChartPrice(price);
      return formatChartPrice(price, PRICE_SCALE_MAX_CHARACTERS);
    },
    [priceScaleFormat],
  );
  const priceTickFormatter =
    priceScaleFormat === 'full' ? formatChartPriceFullTicks : undefined;
  const priceFormatBase = useMemo(
    () =>
      getChartPriceFormatBase([
        ...data.map(([, price]) => price),
        ...(previousClose !== undefined ? [previousClose] : []),
      ]),
    [data, previousClose],
  );
  const handleHover = useCallback(
    ({
      time,
      price,
      x,
      y,
    }: {
      time?: number;
      price?: number;
      x?: number;
      y?: number;
    }) => {
      if (
        clearHoverOnTouchEnd &&
        !platformEnv.isNative &&
        !pointerTrackingRef.current
      ) {
        setHoverData(null);
        return;
      }
      if (
        time !== undefined &&
        price !== undefined &&
        x !== undefined &&
        y !== undefined
      ) {
        setHoverData({
          time: toUtcTimestampRef.current?.(time) ?? time,
          chartTime: time,
          price,
          x,
          y,
        });
      } else {
        setHoverData(null);
      }
    },
    [clearHoverOnTouchEnd],
  );
  // Keep a held point across live refreshes until it leaves the selected range.
  useEffect(() => {
    setHoverData((current) => {
      if ((!useNativeScrub && !clearHoverOnTouchEnd) || !current) return null;
      const point = data.find(([time]) => time === current.time);
      return point ? { ...current, price: point[1] } : null;
    });
  }, [data, useNativeScrub, clearHoverOnTouchEnd]);

  const hoverPoint = useMemo<IStockPriceLineChartHoverPoint | undefined>(() => {
    if (!hoverData) {
      return undefined;
    }
    const base = data[0]?.[1];
    if (base === undefined || !Number.isFinite(base) || base === 0) {
      return { time: hoverData.time, price: hoverData.price };
    }
    const difference = hoverData.price - base;
    return {
      time: hoverData.time,
      price: hoverData.price,
      changeValue: String(difference),
      changePercent: String((difference / base) * 100),
    };
  }, [data, hoverData]);

  const isDown = trend === 'down';
  const solidLineColor = isDown
    ? theme.textCritical.val
    : theme.textSuccess.val;
  // Constant for the life of the chart: only the overlay's data follows the
  // cursor, so hovering never re-creates the chart instance.
  const dimmedLineColor = useMemo(
    () => fadeLineColor(solidLineColor),
    [solidLineColor],
  );
  const lineColorOverride = lineColorToken
    ? theme[lineColorToken].val
    : undefined;
  const seriesColorOverrides = useMemo(
    () =>
      lineColorOverride
        ? {
            lineColor: fadeLineColor(lineColorOverride),
            patternColor: lineColorOverride,
            pulseLastPointColor: lineColorOverride,
            secondaryLineColor: lineColorOverride,
          }
        : undefined,
    [lineColorOverride],
  );
  const crosshairVertLineColor = theme.textSubdued.val;
  const pageBackgroundColor = theme.bgApp.val;
  // Figma stock detail (25907:24812 / 25907:24808): the dashed guide is
  // `border/strong`, its tag and axis label sit on `bg/primary-active` with
  // `text/inverse`, and the live price tag on `bg/success-strong` (or
  // `bg/critical-strong` on a falling range).
  const previousCloseLineColor = theme.borderStrong.val;
  // The design library's `bg/primary-active` is ~50% black in light mode, but
  // the app's `$bgPrimaryActive` maps to primary11 (~61%) there. primary10
  // matches the design in light mode and equals `$bgPrimaryActive` in dark.
  const previousCloseLabelColor = flattenColor(
    theme.primary10.val,
    pageBackgroundColor,
  );
  const previousCloseLabelTextColor = theme.textInverse.val;
  const currentPriceLabelColor = flattenColor(
    isDown ? theme.bgCriticalStrong.val : theme.bgSuccessStrong.val,
    pageBackgroundColor,
  );
  const previousCloseLabel = intl.formatMessage({
    id: ETranslations.market_prev_close,
  });
  // Stable identity: the chart is rebuilt whenever the reference line changes.
  const referenceLine = useMemo<ILightweightChartReferenceLine | undefined>(
    () =>
      previousClose !== undefined && Number.isFinite(previousClose)
        ? {
            price: previousClose,
            color: previousCloseLineColor,
            lineWidth: 1,
            lineStyle: 'dashed',
            axisLabelVisible: true,
            axisLabelColor: previousCloseLabelColor,
            axisLabelTextColor: previousCloseLabelTextColor,
            title: previousCloseLabel,
            includeInAutoscale: true,
          }
        : undefined,
    [
      previousClose,
      previousCloseLabel,
      previousCloseLabelColor,
      previousCloseLabelTextColor,
      previousCloseLineColor,
    ],
  );

  // The whole range stays on both series so the price scale never moves; on
  // web the solid overlay is cut at the cursor (native cuts it while
  // scrubbing), still curved over the full series so it never leaves the
  // faded line underneath.
  const solidLineEndTime = platformEnv.isNative
    ? undefined
    : hoverData?.chartTime;

  const nativeScrubOptions = useMemo<
    ILightweightChartNativeScrubOptions | undefined
  >(() => {
    if (!useNativeScrub) return undefined;
    return {
      labels: Object.fromEntries(
        data.map(([time, price]) => {
          if (!showHoverLabel) return [time, { time: '' }];
          const parts = numberFormatAsRaw(String(price), {
            formatter: 'price',
            formatterOptions: HOVER_PRICE_FORMATTER_OPTIONS,
          });
          const priceLabel =
            typeof parts === 'string'
              ? parts
              : parts
                  .map((part) =>
                    typeof part === 'string'
                      ? part
                      : String(part.value).replace(/[0-9]/g, (digit) =>
                          '₀₁₂₃₄₅₆₇₈₉'.charAt(Number(digit)),
                        ),
                  )
                  .join('');
          return [
            time,
            {
              time: formatDate(new Date(time * 1000), {
                hideSeconds: true,
              }),
              price: hoverLabelShowsPrice ? priceLabel : undefined,
            },
          ];
        }),
      ),
      backgroundColor: theme.bg.val,
      borderColor: theme.borderSubdued.val,
      textColor: theme.text.val,
      timeColor: theme.textDisabled.val,
      largePrice: hoverLabelLargePrice,
      showTooltip: showHoverLabel,
      exitOnTouchEnd: clearHoverOnTouchEnd,
    };
  }, [
    data,
    formatDate,
    hoverLabelShowsPrice,
    hoverLabelLargePrice,
    showHoverLabel,
    clearHoverOnTouchEnd,
    useNativeScrub,
    theme.bg.val,
    theme.borderSubdued.val,
    theme.text.val,
    theme.textDisabled.val,
  ]);

  // Held in a ref so an inline parent callback cannot make the reporting effect
  // fire on every render.
  const onHoverChangeRef = useRef(onHoverChange);
  onHoverChangeRef.current = onHoverChange;
  useEffect(() => {
    onHoverChangeRef.current?.(hoverPoint);
  }, [hoverPoint]);
  // Unmounting mid-scrub (range skeleton, Pro mode) has to release the header
  // back to the live figures.
  useEffect(
    () => () => {
      onHoverChangeRef.current?.(undefined);
    },
    [],
  );

  // The card trails the cursor on both axes and flips to whichever side of it
  // has room, then is clamped to the chart so it never hangs off either end.
  const tooltipPosition = useMemo(() => {
    if (!hoverData || !chartWidth) {
      return null;
    }
    const isLeftHalf = hoverData.x < chartWidth / 2;
    const translateX = isLeftHalf ? 0 : -HOVER_TOOLTIP_WIDTH;
    const desiredLeft = isLeftHalf
      ? hoverData.x + HOVER_TOOLTIP_CURSOR_OFFSET
      : hoverData.x - HOVER_TOOLTIP_CURSOR_OFFSET;
    const clampedLeft = Math.min(
      Math.max(desiredLeft + translateX, HOVER_TOOLTIP_EDGE_INSET),
      chartWidth - HOVER_TOOLTIP_WIDTH - HOVER_TOOLTIP_EDGE_INSET,
    );
    return {
      left: clampedLeft - translateX,
      top: Math.max(
        HOVER_TOOLTIP_EDGE_INSET,
        hoverData.y - HOVER_TOOLTIP_CURSOR_RISE,
      ),
      translateX,
    };
  }, [chartWidth, hoverData]);
  const hoverTimeText = useMemo(
    () =>
      hoverData
        ? formatDate(new Date(hoverData.time * 1000), {
            hideSeconds: true,
          })
        : '',
    [hoverData, formatDate],
  );

  return (
    <Stack
      testID={testID}
      position="relative"
      height={height}
      onTouchStart={clearHoverOnTouchEnd ? startHover : undefined}
      onPointerDown={clearHoverOnTouchEnd ? startHover : undefined}
      onTouchEnd={clearHoverOnTouchEnd ? clearHover : undefined}
      onTouchCancel={clearHoverOnTouchEnd ? clearHover : undefined}
      onPointerUp={clearHoverOnTouchEnd ? clearHover : undefined}
      onPointerCancel={clearHoverOnTouchEnd ? clearHover : undefined}
      onPointerLeave={clearHoverOnTouchEnd ? clearHover : undefined}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        // Hidden tabs can report zero width; retain the last sampling width.
        if (width > 0 && width !== chartWidth) {
          setChartWidth(width);
        }
      }}
    >
      <LightweightChart
        data={chartData}
        height={height}
        lineColor={dimmedLineColor}
        lineWidth={1}
        // The dot pattern and the live pulse marker stay at full strength: they
        // read as the chart's fill, not as part of the faded tail.
        patternColor={solidLineColor}
        pulseLastPointColor={solidLineColor}
        secondaryLineData={overlayData}
        secondaryLineBlankSlots
        secondaryLineEndTime={solidLineEndTime}
        secondaryLineColor={solidLineColor}
        secondaryLineWidth={2}
        crosshairVertLineColor={crosshairVertLineColor}
        crosshairVertLineStyle={CROSSHAIR_VERT_LINE_STYLE}
        seriesType="dotted-area"
        lineType="curved"
        showPriceScale={showPriceScale}
        referenceLine={referenceLine}
        showLastValue={showCurrentPriceLabel}
        {...(!showPriceScale && {
          showPriceScale: false,
          showLastValue: false,
        })}
        showLastValuePriceLine={false}
        lastValueLabelColor={currentPriceLabelColor}
        showLastPointMarker={false}
        preserveChartInstanceOnDataChange
        pulseLastPoint={pulseLastPoint}
        {...seriesColorOverrides}
        showTimeScale
        priceScaleMargins={PRICE_SCALE_MARGINS}
        priceScaleEntireTextOnly
        // The right axis draws its labels left-aligned, so any reserved width
        // shows up as a gap after short prices. Let it fit its widest label.
        priceScaleMinimumWidth={0}
        timeScaleRightOffsetPixels={LAST_POINT_RIGHT_GAP}
        priceFormatter={priceFormatter}
        priceTickFormatter={priceTickFormatter}
        priceFormatBase={priceFormatBase}
        compactPriceMaxCharacters={PRICE_SCALE_MAX_CHARACTERS}
        priceScaleFormat={priceScaleFormat}
        fontSize={11}
        useTimeScaleTickMarkWithoutUnit
        nativeScrubOptions={nativeScrubOptions}
        onHover={
          platformEnv.isNativeAndroid && !onHoverChange
            ? undefined
            : handleHover
        }
      />
      {showHoverLabel && !useNativeScrub && hoverData && tooltipPosition ? (
        <Stack
          testID="stock-price-line-chart-hover-label"
          position="absolute"
          left={tooltipPosition.left}
          top={tooltipPosition.top}
          transform={[{ translateX: tooltipPosition.translateX }]}
          width={HOVER_TOOLTIP_WIDTH}
          bg="$bg"
          borderRadius="$2"
          borderWidth={1}
          borderColor="$borderSubdued"
          px="$2"
          py="$1.5"
          gap={hoverLabelLargePrice ? '$0.5' : undefined}
          pointerEvents="none"
          zIndex={HOVER_TOOLTIP_Z_INDEX}
        >
          <SizableText size="$bodyXs" color="$textDisabled">
            {hoverTimeText}
          </SizableText>
          {hoverLabelShowsPrice ? (
            <NumberSizeableText
              testID="stock-price-line-chart-hover-label-price"
              size={hoverLabelLargePrice ? '$bodyMdMedium' : '$bodySmMedium'}
              color="$text"
              numberOfLines={1}
              formatter="price"
              formatterOptions={HOVER_PRICE_FORMATTER_OPTIONS}
            >
              {String(hoverData.price)}
            </NumberSizeableText>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
