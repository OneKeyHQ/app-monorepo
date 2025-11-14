import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
  useShare,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';
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
  const intl = useIntl();
  const { shareText } = useShare();
  const { gtMd } = useMedia();
  const [devSettings] = useDevSettingsPersistAtom();
  const navigation = useAppNavigation();

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

  const handleMyPortfolio = useCallback(() => {
    navigation.navigate(ETabEarnRoutes.EarnHome, { tab: 'portfolio' });
  }, [navigation]);

  // Hover state for popover
  const [hoverData, setHoverData] = useState<{
    time: number;
    apy: number;
    x: number;
    y: number;
  } | null>(null);

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
      // timestamp is in milliseconds, need to convert to seconds for UTCTimestamp
      const formattedData = apyHistory
        .map((item) => ({
          time: Math.floor(item.timestamp / 1000) as UTCTimestamp,
          value: Number(item.apy),
        }))
        .sort((a, b) => a.time - b.time);

      // Convert to Market chart format [timestamp, value][]
      const marketChartData = formattedData.map(
        (item) => [item.time, item.value] as [UTCTimestamp, number],
      );

      return {
        high,
        low,
        marketChartData,
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

  return (
    <YStack gap="$3">
      {apyDetail ? (
        <YStack>
          {/* Token icon and name with My Portfolio button */}
          <XStack jc="space-between" ai="center">
            <XStack gap="$2" ai="center">
              <Token size="xs" tokenImageUri={tokenInfo?.token.logoURI} />
              <SizableText size="$bodyLgMedium">
                {tokenInfo?.token.symbol || symbol}
              </SizableText>
            </XStack>
            <XStack cursor="pointer" ai="center" onPress={handleMyPortfolio}>
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.earn_portfolio })}
              </SizableText>
              <Icon
                size="$bodySmMedium"
                name="ChevronRightSmallOutline"
                color="$iconSubdued"
              />
            </XStack>
          </XStack>
          {/* APY value with buttons */}
          <XStack gap="$2" ai="center" pt="$2.5">
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
          {gtMd ? (
            <XStack gap="$4" pt="$6">
              <YStack>
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.market_high })}
                </SizableText>
                <SizableText size="$bodyMd" color="$text">
                  {chartData.high.toFixed(2)}%
                </SizableText>
              </YStack>
              <YStack>
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.market_low })}
                </SizableText>
                <SizableText size="$bodyMd" color="$text">
                  {chartData.low.toFixed(2)}%
                </SizableText>
              </YStack>
            </XStack>
          ) : null}
        </YStack>
      ) : null}
      <YStack position="relative">
        {/* Hover Popover - follows cursor/touch position */}
        {hoverData ? (
          <YStack
            position="absolute"
            top={Math.max(10, hoverData.y - 70)}
            left={hoverData.x}
            transform={[{ translateX: '-50%' }]}
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
      </YStack>
    </YStack>
  );
}
