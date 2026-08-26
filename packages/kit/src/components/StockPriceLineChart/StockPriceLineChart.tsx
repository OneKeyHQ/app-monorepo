import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@tamagui/core';

import { SizableText, Stack } from '@onekeyhq/components';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { LightweightChart } from '../LightweightChart';

const PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.1 } as const;
// Kept in sync with `priceScaleMinimumWidth` below, so the time label can be
// clamped to the plot area instead of drifting over the price axis.
const PRICE_SCALE_WIDTH = 64;
// The moment under the crosshair is pinned to the top of the plot and only
// tracks the pointer horizontally — the header keeps the price and the move,
// this only answers "when". Fixed width so it can be clamped before it is drawn.
const TIME_LABEL_WIDTH = 108;
const TIME_LABEL_EDGE_INSET = 8;
// Distance from the top of the plot area, so the label reads as part of the
// chart frame instead of floating with the cursor.
const TIME_LABEL_TOP_INSET = 6;
// lightweight-charts stacks its canvases above the container's own
// z-index:auto children, so the label has to opt into a layer above them.
const TIME_LABEL_Z_INDEX = 5;

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
  onHoverChange,
}: {
  data: IMarketTokenChart;
  height: number;
  pulseLastPoint?: boolean;
  testID?: string;
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

  // Horizontally centered on the crosshair and clamped to the plot, so the
  // label stays readable at both ends of the range instead of hanging off the
  // edge. Vertically it stays parked at the top of the plot.
  const timeLabelPosition = useMemo(() => {
    if (!hoverData || !chartWidth) {
      return null;
    }
    const plotRight = chartWidth - PRICE_SCALE_WIDTH;
    const maxLeft = Math.max(
      TIME_LABEL_EDGE_INSET,
      plotRight - TIME_LABEL_WIDTH - TIME_LABEL_EDGE_INSET,
    );
    return {
      left: Math.min(
        Math.max(hoverData.x - TIME_LABEL_WIDTH / 2, TIME_LABEL_EDGE_INSET),
        maxLeft,
      ),
      top: TIME_LABEL_TOP_INSET,
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
        lineColor={theme.textSuccess.val}
        lineWidth={1}
        secondaryLineData={data}
        secondaryLineColor={theme.textSuccess.val}
        secondaryLineWidth={2}
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
      {timeLabelPosition ? (
        <Stack
          testID="stock-price-line-chart-time-label"
          position="absolute"
          left={timeLabelPosition.left}
          top={timeLabelPosition.top}
          width={TIME_LABEL_WIDTH}
          bg="$bg"
          borderRadius="$2"
          borderCurve="continuous"
          borderWidth={1}
          borderColor="$borderSubdued"
          px="$2"
          py="$1"
          pointerEvents="none"
          zIndex={TIME_LABEL_Z_INDEX}
        >
          <SizableText
            size="$bodyXs"
            color="$textSubdued"
            textAlign="center"
            numberOfLines={1}
          >
            {hoverTimeText}
          </SizableText>
        </Stack>
      ) : null}
    </Stack>
  );
}
