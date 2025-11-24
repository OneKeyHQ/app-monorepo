import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  onShare?: () => void;
}

const ApyChartComponent = ({
  networkId,
  symbol,
  provider,
  vault,
  apyDetail,
  tokenInfo,
  onShare,
}: IApyChartProps) => {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isFocused = useRouteIsFocused();
  const navigation = useAppNavigation();

  const handleMyPortfolio = useCallback(() => {
    EarnNavigation.pushToEarnHome(navigation, { tab: 'portfolio' });
  }, [navigation]);

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

  const { result: chartData, setResult: setChartData } = usePromiseResult(
    async () => {
      // Only fetch data when focused
      if (!isFocused) {
        return null;
      }

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
    [networkId, symbol, provider, vault, isFocused],
    { watchLoading: true },
  );

  // CRITICAL: Clear chart data when page is not focused to release memory
  useEffect(() => {
    if (!isFocused && chartData) {
      setChartData(undefined);
    }
  }, [isFocused, chartData, setChartData]);

  return (
    <YStack gap="$3">
      <YStack>
        {/* Token icon and name with My Portfolio button - always show */}
        <XStack jc="space-between" ai="center" h="$9">
          <XStack gap="$2" ai="center">
            <Token size="xs" tokenImageUri={tokenInfo?.token.logoURI} />
            <SizableText size="$bodyLgMedium">
              {tokenInfo?.token.symbol || symbol}
            </SizableText>
          </XStack>
        </XStack>
        {/* APY value with buttons - only show if apyDetail exists */}
        {apyDetail ? (
          <>
            <XStack gap="$2" ai="center" pt="$2.5">
              <EarnText text={apyDetail.description} size="$heading3xl" />
              <EarnActionIcon
                title={apyDetail.title.text}
                actionIcon={apyDetail.button}
              />
              {onShare ? (
                <IconButton
                  icon="ShareOutline"
                  size="small"
                  variant="tertiary"
                  iconColor="$iconSubdued"
                  onPress={onShare}
                />
              ) : null}
              <XStack
                ml="auto"
                cursor="pointer"
                ai="center"
                onPress={handleMyPortfolio}
              >
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.earn_portfolio })}
                </SizableText>
                <Icon
                  size="$bodySmMedium"
                  name="ChevronRightSmallOutline"
                  color="$iconSubdued"
                />
              </XStack>
            </XStack>
            {/* High and Low values */}
            {gtMd && chartData ? (
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
          </>
        ) : null}
      </YStack>
      {chartData ? (
        <YStack
          position="relative"
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
          {/* CRITICAL: Only render chart when page is focused to prevent memory leaks */}
          {isFocused ? (
            <LightweightChart
              data={chartData.marketChartData}
              height={200}
              onHover={handleHover}
            />
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
};

export const ApyChart = memo(ApyChartComponent);
