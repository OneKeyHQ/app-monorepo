import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import ChartView from '@onekeyhq/kit/src/views/Market/components/Chart/ChartView';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

import type { UTCTimestamp } from 'lightweight-charts';

interface IApyChartProps {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  apyDetail: IStakeEarnDetail['apyDetail'];
}

export function ApyChart({
  networkId,
  symbol,
  provider,
  vault,
  apyDetail,
}: IApyChartProps) {
  const { result: chartData, isLoading } = usePromiseResult(
    async () => {
      const apyHistory = await backgroundApiProxy.serviceStaking.getApyHistory({
        networkId,
        symbol,
        provider,
        vault,
      });

      if (!apyHistory || apyHistory.length === 0) {
        return null;
      }

      // Calculate high and low APY
      const apyValues = apyHistory.map((item) => Number(item.apy));
      const high = Math.max(...apyValues);
      const low = Math.min(...apyValues);

      // Convert to chart format
      const formattedData = apyHistory
        .map((item) => ({
          time: Math.floor(item.timestamp) as UTCTimestamp,
          value: Number(item.apy),
        }))
        .sort((a, b) => a.time - b.time);

      // Convert to Market chart format [timestamp, value][]
      const marketChartData = formattedData.map(
        (item) => [item.time, item.value] as [UTCTimestamp, number],
      );

      const firstTime = formattedData[0]?.time;
      const lastTime = formattedData[formattedData.length - 1]?.time;

      return {
        high,
        low,
        marketChartData,
        firstTime,
        lastTime,
      };
    },
    [networkId, symbol, provider, vault],
    { watchLoading: true },
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

  // Format timestamp to readable date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    });
  };

  return (
    <YStack gap="$3">
      {apyDetail ? (
        <YStack gap="$2">
          <XStack jc="space-between" ai="center">
            <YStack>
              <XStack gap="$1" ai="center">
                <EarnText
                  text={apyDetail.title}
                  size="$bodyMd"
                  color="$textSubdued"
                />
                <EarnTooltip
                  title={apyDetail.title.text}
                  tooltip={apyDetail.tooltip}
                />
              </XStack>
              <XStack gap="$1" ai="center">
                <EarnText text={apyDetail.description} size="$heading3xl" />
                <EarnActionIcon
                  title={apyDetail.title.text}
                  actionIcon={apyDetail.button}
                />
              </XStack>
            </YStack>
            <XStack gap="$4">
              <YStack ai="flex-end">
                <SizableText size="$bodySm" color="$textSubdued">
                  High
                </SizableText>
                <SizableText size="$bodyMd">
                  {chartData.high.toFixed(2)}%
                </SizableText>
              </YStack>
              <YStack ai="flex-end">
                <SizableText size="$bodySm" color="$textSubdued">
                  Low
                </SizableText>
                <SizableText size="$bodyMd">
                  {chartData.low.toFixed(2)}%
                </SizableText>
              </YStack>
            </XStack>
          </XStack>
        </YStack>
      ) : null}
      <ChartView
        data={chartData.marketChartData}
        height={200}
        isFetching={false}
        onHover={() => {}}
      />
      <XStack jc="space-between" px="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          {chartData.firstTime ? formatDate(chartData.firstTime) : ''}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {chartData.lastTime ? formatDate(chartData.lastTime) : ''}
        </SizableText>
      </XStack>
    </YStack>
  );
}
