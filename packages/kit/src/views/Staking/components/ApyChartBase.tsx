import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import type { IApyHistoryItem } from '@onekeyhq/shared/types/staking';

import type { UTCTimestamp } from 'lightweight-charts';

interface IApyChartBaseProps {
  data: IApyHistoryItem[] | undefined;
  isLoading?: boolean;
  title?: string;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  lineWidth?: number;
  showHorzGridLines?: boolean;
  showPriceScale?: boolean;
  showDivider?: boolean;
  tooltipLabel?: string;
}

const ApyChartBaseComponent = ({
  data,
  isLoading,
  title,
  lineColor,
  topColor,
  bottomColor,
  lineWidth,
  showHorzGridLines,
  showPriceScale,
  showDivider = true,
  tooltipLabel = 'APY',
}: IApyChartBaseProps) => {
  const intl = useIntl();
  const chartHeight = 200;
  const [hoverData, setHoverData] = useState<{
    time: number;
    apy: number;
    x: number;
    y: number;
  } | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(0);

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
      if (time && price && x !== undefined && y !== undefined) {
        setHoverData({
          time,
          apy: price,
          x,
          y,
        });
      } else {
        setHoverData(null);
      }
    },
    [],
  );

  const popoverPosition = useMemo(() => {
    if (!hoverData || !containerWidth) return null;

    const POPOVER_WIDTH = 144;
    const OFFSET = 10;
    const EDGE_PADDING = 16;
    const isLeftHalf = hoverData.x < containerWidth / 2;

    const translateXValue = isLeftHalf ? 0 : -POPOVER_WIDTH;
    const desiredLeft = isLeftHalf
      ? hoverData.x + OFFSET
      : hoverData.x - OFFSET;
    const minLeft = EDGE_PADDING;
    const maxLeft = Math.max(
      minLeft,
      containerWidth - POPOVER_WIDTH - EDGE_PADDING,
    );
    const actualLeft = desiredLeft + translateXValue;
    const clampedActualLeft = Math.min(Math.max(actualLeft, minLeft), maxLeft);

    return {
      left: clampedActualLeft - translateXValue,
      translateXValue,
      top: Math.max(10, hoverData.y - 70),
    };
  }, [hoverData, containerWidth]);

  const formatPopoverDate = useCallback(
    (timestamp: number) => {
      const date = new Date(timestamp * 1000);
      return intl.formatDate(date, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [intl],
  );

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    const formattedData = data
      .map((item) => ({
        time: Math.floor(item.timestamp / 1000) as UTCTimestamp,
        value: Number(item.apy),
      }))
      .toSorted((a, b) => a.time - b.time);

    const marketChartData = formattedData.map(
      (item) => [item.time, item.value] as [UTCTimestamp, number],
    );

    return { marketChartData };
  }, [data]);

  return (
    <YStack gap="$2">
      {title ? <SizableText size="$bodyMdMedium">{title}</SizableText> : null}

      {isLoading ? (
        <Stack
          height={chartHeight}
          position="relative"
          overflow="hidden"
          animation="quick"
          enterStyle={{ opacity: 0 }}
        >
          <Skeleton w="100%" h="100%" borderRadius="$2" />
          <Stack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            height="60%"
            opacity={0.3}
          >
            <Skeleton w="100%" h="100%" borderRadius="$2" />
          </Stack>
        </Stack>
      ) : null}

      {chartData && !isLoading ? (
        <YStack
          position="relative"
          animation="quick"
          enterStyle={{ opacity: 0, scale: 0.98 }}
          exitStyle={{ opacity: 0, scale: 0.98 }}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width !== containerWidth) {
              setContainerWidth(width);
            }
          }}
        >
          {hoverData && popoverPosition ? (
            <YStack
              position="absolute"
              top={popoverPosition.top}
              left={popoverPosition.left}
              transform={[{ translateX: popoverPosition.translateXValue }]}
              bg="$bg"
              borderRadius="$2"
              borderWidth={1}
              borderColor="$borderSubdued"
              px="$3"
              py="$2"
              shadowColor="$shadowDefault"
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.1}
              shadowRadius={8}
              zIndex={9999}
              pointerEvents="none"
              minWidth={144}
            >
              <YStack gap="$1.5" width="100%">
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  whiteSpace="nowrap"
                >
                  {formatPopoverDate(hoverData.time)}
                </SizableText>
                <XStack jc="space-between" ai="center" width="100%">
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    whiteSpace="nowrap"
                  >
                    {tooltipLabel}
                  </SizableText>
                  <SizableText
                    size="$bodySmMedium"
                    color="$text"
                    whiteSpace="nowrap"
                  >
                    {hoverData.apy.toFixed(2)}%
                  </SizableText>
                </XStack>
              </YStack>
            </YStack>
          ) : null}
          <LightweightChart
            data={chartData.marketChartData}
            height={chartHeight}
            lineColor={lineColor}
            topColor={topColor}
            bottomColor={bottomColor}
            lineWidth={lineWidth}
            showHorzGridLines={showHorzGridLines}
            showPriceScale={showPriceScale}
            onHover={handleHover}
          />
          {showDivider ? <Divider mt="$8" /> : null}
        </YStack>
      ) : null}
    </YStack>
  );
};

export const ApyChartBase = memo(ApyChartBaseComponent);
