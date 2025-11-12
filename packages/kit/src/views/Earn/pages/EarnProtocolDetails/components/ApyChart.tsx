import { useCallback, useMemo } from 'react';

import {
  IconButton,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useShare,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import ChartView from '@onekeyhq/kit/src/views/Market/components/Chart/ChartView';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IEarnTokenInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';

import { EarnNavigation } from '../../../earnUtils';

import type { UTCTimestamp } from 'lightweight-charts';

interface IApyChartProps {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  apyDetail: IStakeEarnDetail['apyDetail'];
  tokenInfo?: IEarnTokenInfo;
}

export function ApyChart({
  networkId,
  symbol,
  provider,
  vault,
  apyDetail,
  tokenInfo,
}: IApyChartProps) {
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();

  // Generate share URL
  const shareUrl = useMemo(() => {
    if (!symbol || !provider || !networkId) return undefined;
    const shareLink = EarnNavigation.generateEarnShareLink({
      networkId,
      symbol,
      provider,
      vault,
      isDevMode: devSettings.enabled,
    });
    return shareLink;
  }, [symbol, provider, networkId, vault, devSettings.enabled]);

  const handleShare = useCallback(() => {
    if (!shareUrl) return;
    void shareText(shareUrl);
  }, [shareUrl, shareText]);
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
      <YStack gap="$3">
        <YStack>
          {/* Token icon and name skeleton */}
          <XStack gap="$2" ai="center">
            <Skeleton w="$5" h="$5" borderRadius="$full" />
            <Skeleton w={80} h="$4" borderRadius="$2" />
          </XStack>
          {/* APY value skeleton */}
          <Skeleton w={120} h="$10" borderRadius="$2" mt="$2.5" />
          {/* High and Low skeleton */}
          <XStack gap="$4" mt="$6">
            <YStack>
              <Skeleton w={40} h="$3" borderRadius="$1" mb="$1" />
              <Skeleton w={60} h="$4" borderRadius="$2" />
            </YStack>
            <YStack>
              <Skeleton w={40} h="$3" borderRadius="$1" mb="$1" />
              <Skeleton w={60} h="$4" borderRadius="$2" />
            </YStack>
          </XStack>
        </YStack>
        {/* Chart skeleton */}
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
        <YStack>
          {/* Token icon and name */}
          <XStack gap="$2" ai="center">
            <Token size="xs" tokenImageUri={tokenInfo?.token.logoURI} />
            <SizableText size="$bodyLgMedium">
              {tokenInfo?.token.symbol || symbol}
            </SizableText>
          </XStack>
          {/* APY value with buttons */}
          <XStack gap="$1" ai="center" pt="$2.5">
            <EarnText text={apyDetail.description} size="$heading3xl" />
            <EarnActionIcon
              title={apyDetail.title.text}
              actionIcon={apyDetail.button}
            />
            <IconButton
              icon="ShareOutline"
              size="small"
              variant="tertiary"
              iconColor="$iconSubdued"
              onPress={handleShare}
              disabled={!shareUrl}
            />
          </XStack>
          {/* High and Low values */}
          <XStack gap="$4" pt="$6">
            <YStack>
              <SizableText size="$bodySm" color="$textSubdued">
                High
              </SizableText>
              <SizableText size="$bodyMd" color="$text">
                {chartData.high.toFixed(2)}%
              </SizableText>
            </YStack>
            <YStack>
              <SizableText size="$bodySm" color="$textSubdued">
                Low
              </SizableText>
              <SizableText size="$bodyMd" color="$text">
                {chartData.low.toFixed(2)}%
              </SizableText>
            </YStack>
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
