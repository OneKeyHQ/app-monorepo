import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@tamagui/core';
import { colord } from 'colord';

import { SizableText, Stack } from '@onekeyhq/components';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { LightweightChart } from '../LightweightChart';

const PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.1 } as const;
// Kept in sync with `priceScaleMinimumWidth` below, so the price axis reserves
// a stable width instead of resizing with the figures it prints.
const PRICE_SCALE_WIDTH = 64;
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
  testID,
  hoverLabelShowsPrice = true,
  onHoverChange,
}: {
  data: IMarketTokenChart;
  height: number;
  pulseLastPoint?: boolean;
  testID?: string;
  // The hover card answers "when" and, by default, "how much". Hosts that must
  // not repeat the figure pass false to keep the card time-only.
  hoverLabelShowsPrice?: boolean;
  // Called with undefined when the pointer leaves the plot, and on unmount.
  onHoverChange?: (point: IStockPriceLineChartHoverPoint | undefined) => void;
}) {
  const theme = useTheme();
  const { format } = useFormatDate();
  const [hoverData, setHoverData] = useState<IChartHoverData | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const priceFormatter = useCallback(
    (price: number) =>
      numberFormat(String(price), {
        formatter: 'price',
        formatterOptions: { currency: '$' },
      }),
    [],
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
        showLastPointMarker={false}
        preserveChartInstanceOnDataChange
        pulseLastPoint={pulseLastPoint}
        showTimeScale
        priceScaleMargins={PRICE_SCALE_MARGINS}
        priceScaleEntireTextOnly
        priceScaleMinimumWidth={PRICE_SCALE_WIDTH}
        priceFormatter={priceFormatter}
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
              {priceFormatter(hoverData.price)}
            </SizableText>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
