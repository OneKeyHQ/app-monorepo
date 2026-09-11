import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@tamagui/core';
import { colord } from 'colord';
import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { LightweightChart } from '../LightweightChart';
import { formatChartPrice } from '../LightweightChart/utils/formatChartPrice';

import type { ILightweightChartReferenceLine } from '../LightweightChart/types';

const PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.1 } as const;
// Kept in sync with `priceScaleMinimumWidth` below, so the price axis reserves
// a stable width instead of resizing with the figures it prints.
const PRICE_SCALE_WIDTH = 88;
// Keeps the pulsing tail dot clear of the current price label on the axis.
const LAST_POINT_RIGHT_GAP = 8;
// The hover card follows the cursor on both axes. Fixed width so it can be
// flipped and clamped before it is drawn, and so figures like "$123,456.78"
// still fit on one line.
const HOVER_TOOLTIP_WIDTH = 112;
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
  time: number;
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
  data,
  height,
  pulseLastPoint,
  previousClose,
  showCurrentPriceLabel,
  testID,
  hoverLabelShowsPrice = true,
  onHoverChange,
}: {
  data: IMarketTokenChart;
  height: number;
  pulseLastPoint?: boolean;
  // Previous session close. Drawn as a dashed line with a "Prev close" tag and
  // its own axis label, and kept inside the price scale even when the range
  // never trades through it.
  previousClose?: number;
  // Pins the latest price to the price axis on the line's full-strength color,
  // without the dashed price line lightweight-charts pairs it with.
  showCurrentPriceLabel?: boolean;
  testID?: string;
  // The hover card answers "when" and, by default, "how much". Hosts that must
  // not repeat the figure pass false to keep the card time-only.
  hoverLabelShowsPrice?: boolean;
  // Called with undefined when the pointer leaves the plot, and on unmount.
  onHoverChange?: (point: IStockPriceLineChartHoverPoint | undefined) => void;
}) {
  const theme = useTheme();
  const intl = useIntl();
  const { format } = useFormatDate();
  const [hoverData, setHoverData] = useState<IChartHoverData | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const maxPriceCharacters = chartWidth > 0 && chartWidth < 400 ? 7 : 8;
  const priceFormatter = useCallback(
    (price: number) => formatChartPrice(price, maxPriceCharacters),
    [maxPriceCharacters],
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
        time !== undefined &&
        price !== undefined &&
        x !== undefined &&
        y !== undefined
      ) {
        setHoverData({ time, price, x, y });
      } else {
        setHoverData(null);
      }
    },
    [],
  );
  // A fresh series (range switch, refetch) invalidates whatever the crosshair
  // was pointing at.
  useEffect(() => {
    setHoverData(null);
  }, [data]);

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

  const solidLineColor = theme.textSuccess.val;
  // Constant for the life of the chart: only the overlay's data follows the
  // cursor, so hovering never re-creates the chart instance.
  const dimmedLineColor = useMemo(
    () => fadeLineColor(solidLineColor),
    [solidLineColor],
  );
  const crosshairVertLineColor = theme.textSubdued.val;
  const pageBackgroundColor = theme.bgApp.val;
  // Figma stock detail (25907:24812 / 25907:24808): the dashed guide is
  // `border/strong`, its tag and axis label sit on `bg/primary-active` with
  // `text/inverse`, and the live price tag on `bg/success-strong`.
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
    theme.bgSuccessStrong.val,
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

  // The whole range stays on the main (faded) series so the price scale never
  // moves; only the solid overlay drawn on top of it is cut at the cursor.
  const hoveredTime = hoverData?.time;
  const solidData = useMemo(() => {
    if (hoveredTime === undefined) {
      return data;
    }
    const upToCursor = data.filter(([time]) => time <= hoveredTime);
    // An empty overlay would drop the overlay series entirely and rebuild the
    // chart mid-scrub, so it always keeps at least the first point.
    return upToCursor.length > 0 ? upToCursor : data.slice(0, 1);
  }, [data, hoveredTime]);

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
      hoverData ? format(new Date(hoverData.time * 1000), 'MMM d, HH:mm') : '',
    [format, hoverData],
  );

  return (
    <Stack
      testID={testID}
      position="relative"
      height={height}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width !== chartWidth) {
          setChartWidth(width);
        }
      }}
    >
      <LightweightChart
        data={data}
        height={height}
        lineColor={dimmedLineColor}
        lineWidth={1}
        // The dot pattern and the live pulse marker stay at full strength: they
        // read as the chart's fill, not as part of the faded tail.
        patternColor={solidLineColor}
        pulseLastPointColor={solidLineColor}
        secondaryLineData={solidData}
        secondaryLineColor={solidLineColor}
        secondaryLineWidth={2}
        crosshairVertLineColor={crosshairVertLineColor}
        crosshairVertLineStyle={CROSSHAIR_VERT_LINE_STYLE}
        seriesType="dotted-area"
        showPriceScale
        referenceLine={referenceLine}
        showLastValue={showCurrentPriceLabel}
        showLastValuePriceLine={false}
        lastValueLabelColor={currentPriceLabelColor}
        showLastPointMarker={false}
        preserveChartInstanceOnDataChange
        pulseLastPoint={pulseLastPoint}
        showTimeScale
        priceScaleMargins={PRICE_SCALE_MARGINS}
        priceScaleEntireTextOnly
        priceScaleMinimumWidth={PRICE_SCALE_WIDTH}
        timeScaleRightOffsetPixels={LAST_POINT_RIGHT_GAP}
        priceFormatter={priceFormatter}
        compactPriceMaxCharacters={maxPriceCharacters}
        fontSize={11}
        useTimeScaleTickMarkWithoutUnit
        onHover={handleHover}
      />
      {hoverData && tooltipPosition ? (
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
          pointerEvents="none"
          zIndex={HOVER_TOOLTIP_Z_INDEX}
        >
          <SizableText size="$bodyXs" color="$textDisabled">
            {hoverTimeText}
          </SizableText>
          {hoverLabelShowsPrice ? (
            <SizableText
              testID="stock-price-line-chart-hover-label-price"
              size="$bodySmMedium"
              color="$text"
              numberOfLines={1}
            >
              {numberFormat(String(hoverData.price), {
                formatter: 'price',
                formatterOptions: { currency: '$' },
              })}
            </SizableText>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
