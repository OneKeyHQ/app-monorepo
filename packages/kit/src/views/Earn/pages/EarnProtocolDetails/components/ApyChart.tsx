import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  SizableText,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';

import type { UTCTimestamp } from 'lightweight-charts';

interface IApyChartProps {
  apyHistory?: { timestamp: number; apy: string }[] | null;
}

const ApyChartComponent = ({ apyHistory }: IApyChartProps) => {
  const intl = useIntl();

  // Hover state for popover
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

  // Calculate popover position - switch side at midpoint
  const popoverPosition = useMemo(() => {
    if (!hoverData || !containerWidth) return null;

    const POPOVER_WIDTH = 120;
    const OFFSET = 10; // Distance from cursor
    const isLeftHalf = hoverData.x < containerWidth / 2;

    return {
      left: isLeftHalf ? hoverData.x + OFFSET : hoverData.x - OFFSET,
      translateXValue: isLeftHalf ? 0 : -POPOVER_WIDTH, // Left align or right align
      top: Math.max(10, hoverData.y - 70),
    };
  }, [hoverData, containerWidth]);

  // Format date for popover with i18n
  const formatPopoverDate = useCallback(
    (timestamp: number) => {
      const date = new Date(timestamp * 1000);
      return intl.formatDate(date, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });
    },
    [intl],
  );

  const chartData = useMemo(() => {
    if (!apyHistory || apyHistory.length === 0) {
      return null;
    }
    const formattedData = apyHistory
      .map((item) => ({
        time: Math.floor(item.timestamp / 1000) as UTCTimestamp,
        value: Number(item.apy),
      }))
      .sort((a, b) => a.time - b.time);
    const marketChartData = formattedData.map(
      (item) => [item.time, item.value] as [UTCTimestamp, number],
    );
    return { marketChartData };
  }, [apyHistory]);
  const isLoading = apyHistory === undefined;

  return (
    <>
      {/* Chart Skeleton - show during loading */}
      {isLoading && !chartData ? (
        <Stack
          $gtMd={{ height: 200 }}
          $md={{ height: 180 }}
          $sm={{ height: 160 }}
          height={160}
          position="relative"
          overflow="hidden"
          animation="quick"
          enterStyle={{ opacity: 0 }}
        >
          <Skeleton w="100%" h="100%" borderRadius="$2" />
          {/* Simulated chart curve overlay for better visual */}
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

      {/* Chart - show when data is loaded */}
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
          {/* Hover Popover - follows cursor/touch position with boundary detection */}
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
              minWidth={120}
            >
              <YStack gap="$1" ai="center">
                <SizableText size="$bodyMdMedium" color="$text">
                  {hoverData.apy.toFixed(2)}%
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {formatPopoverDate(hoverData.time)}
                </SizableText>
              </YStack>
            </YStack>
          ) : null}
          <LightweightChart
            data={chartData.marketChartData}
            height={200}
            onHover={handleHover}
          />
          <Divider mt="$8" />
        </YStack>
      ) : null}
    </>
  );
};

export const ApyChart = memo(ApyChartComponent);
