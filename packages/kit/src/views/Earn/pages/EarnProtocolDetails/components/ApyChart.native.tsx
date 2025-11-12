import { useCallback, useMemo, useState } from 'react';

import { ChartPathProvider } from '@onekeyfe/react-native-animated-charts';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import ChartWrapper from '@onekeyhq/kit/src/views/Market/components/Chart/value-chart/Chart';
import useChartThrottledPoints from '@onekeyhq/kit/src/views/Market/components/Chart/value-chart/useChartThrottledPoints';

import type { LayoutChangeEvent } from 'react-native';

interface IApyChartProps {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
}

export function ApyChart({
  networkId,
  symbol,
  provider,
  vault,
}: IApyChartProps) {
  const [width, setWidth] = useState(0);

  const { result: apyHistory, isLoading } = usePromiseResult(
    async () => {
      const data = await backgroundApiProxy.serviceStaking.getApyHistory({
        networkId,
        symbol,
        provider,
        vault,
      });
      return data;
    },
    [networkId, symbol, provider, vault],
    { watchLoading: true },
  );

  const chartData = useMemo(() => {
    if (!apyHistory || apyHistory.length === 0) {
      return null;
    }

    // Calculate high and low APY
    const apyValues = apyHistory.map((item) => Number(item.apy));
    const high = Math.max(...apyValues);
    const low = Math.min(...apyValues);

    // Convert to chart format for react-native-animated-charts
    const formattedData: [number, number][] = apyHistory.map((item) => [
      item.timestamp,
      Number(item.apy),
    ]);

    return {
      high,
      low,
      formattedData,
    };
  }, [apyHistory]);

  const { throttledData } = useChartThrottledPoints({
    originData: chartData?.formattedData || [],
    fetchingCharts: isLoading,
  });

  const onLayout = useCallback(
    ({
      nativeEvent: {
        layout: { width: newWidth },
      },
    }: LayoutChangeEvent) => {
      setWidth(newWidth);
    },
    [setWidth],
  );

  if (isLoading) {
    return (
      <YStack gap="$2">
        <Skeleton h="$4" w={120} borderRadius="$2" />
        <Skeleton h={200} w="100%" borderRadius="$3" />
      </YStack>
    );
  }

  if (!chartData) {
    return null;
  }

  const lineColor = '#33C641';

  return (
    <YStack gap="$3">
      <XStack jc="space-between" ai="center">
        <SizableText size="$bodyLgMedium">APY</SizableText>
        <XStack gap="$4">
          <YStack>
            <SizableText size="$bodySm" color="$textSubdued">
              High
            </SizableText>
            <SizableText size="$bodyMd">
              {chartData.high.toFixed(2)}%
            </SizableText>
          </YStack>
          <YStack>
            <SizableText size="$bodySm" color="$textSubdued">
              Low
            </SizableText>
            <SizableText size="$bodyMd">
              {chartData.low.toFixed(2)}%
            </SizableText>
          </YStack>
        </XStack>
      </XStack>
      <Stack h={200} w="100%" onLayout={onLayout}>
        {/* @ts-ignore */}
        <ChartPathProvider data={throttledData} width={width}>
          <ChartWrapper
            width={width}
            lineColor={lineColor}
            isFetching={!!isLoading}
            height={200}
            onHover={() => {}}
          />
        </ChartPathProvider>
      </Stack>
    </YStack>
  );
}
