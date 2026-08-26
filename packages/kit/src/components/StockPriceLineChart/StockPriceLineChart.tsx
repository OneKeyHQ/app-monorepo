import { useCallback, useMemo, useState } from 'react';

import { useTheme } from '@tamagui/core';

import { SizableText, Stack, YStack } from '@onekeyhq/components';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { LightweightChart } from '../LightweightChart';

const TOOLTIP_WIDTH = 112;
const PRICE_SCALE_MARGINS = { top: 0.12, bottom: 0.1 } as const;

type IChartHoverData = {
  time: number;
  price: number;
  x: number;
  y: number;
};

export function StockPriceLineChart({
  data,
  height,
  pulseLastPoint,
  testID,
}: {
  data: IMarketTokenChart;
  height: number;
  pulseLastPoint?: boolean;
  testID?: string;
}) {
  const { format } = useFormatDate();
  const theme = useTheme();
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
  const tooltipPosition = useMemo(() => {
    if (!hoverData || !chartWidth) {
      return null;
    }

    const offset = 10;
    const edge = 8;
    const isLeftHalf = hoverData.x < chartWidth / 2;
    const translateX = isLeftHalf ? 0 : -TOOLTIP_WIDTH;
    const desiredLeft = isLeftHalf
      ? hoverData.x + offset
      : hoverData.x - offset;
    const clampedLeft = Math.min(
      Math.max(desiredLeft + translateX, edge),
      chartWidth - TOOLTIP_WIDTH - edge,
    );

    return {
      left: clampedLeft - translateX,
      top: Math.max(8, hoverData.y - 56),
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
      {hoverData && tooltipPosition ? (
        <YStack
          position="absolute"
          top={tooltipPosition.top}
          left={tooltipPosition.left}
          transform={[{ translateX: tooltipPosition.translateX }]}
          bg="$bg"
          borderRadius="$2"
          borderWidth={1}
          borderColor="$borderSubdued"
          px="$2"
          py="$1.5"
          zIndex={100}
          pointerEvents="none"
          width={TOOLTIP_WIDTH}
        >
          <SizableText size="$bodyXs" color="$textDisabled">
            {hoverTimeText}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$text" numberOfLines={1}>
            {priceFormatter(hoverData.price)}
          </SizableText>
        </YStack>
      ) : null}
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
        priceScaleMinimumWidth={64}
        priceFormatter={priceFormatter}
        fontSize={11}
        useTimeScaleTickMarkWithoutUnit
        onHover={handleHover}
      />
    </Stack>
  );
}
