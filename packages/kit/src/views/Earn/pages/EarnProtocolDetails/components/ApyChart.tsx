import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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
                  {intl.formatMessage({ id: ETranslations.earn_positions })}
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
      {/* Chart Skeleton - show during loading */}
      {isLoading && !chartData ? (
        <YStack gap="$3" animation="quick" enterStyle={{ opacity: 0 }}>
          {/* High/Low skeleton - only show on desktop */}
          {gtMd ? (
            <XStack gap="$4" pt="$6">
              <YStack gap="$2">
                <Skeleton w="$12" h="$3" />
                <Skeleton w="$16" h="$4" />
              </YStack>
              <YStack gap="$2">
                <Skeleton w="$12" h="$3" />
                <Skeleton w="$16" h="$4" />
              </YStack>
            </XStack>
          ) : null}
          {/* Chart area skeleton with responsive height and smooth curve simulation */}
          <Stack
            $gtMd={{ height: 200 }}
            $md={{ height: 180 }}
            $sm={{ height: 160 }}
            height={160}
            position="relative"
            overflow="hidden"
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
        </YStack>
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
        </YStack>
      ) : null}
    </YStack>
  );
};

export const ApyChart = memo(ApyChartComponent);
