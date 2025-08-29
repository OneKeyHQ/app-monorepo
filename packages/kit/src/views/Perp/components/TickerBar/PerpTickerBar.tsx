import React, { memo, useEffect, useMemo, useState } from 'react';

import {
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrentTokenData, usePerpSession } from '../../hooks';

import { PerpTokenSelector } from '../TokenSelector/PerpTokenSelector';
import { formatAssetCtx, formatLargeNumber } from '../../utils/formatData';
import { useActiveAssetCtxAtom } from '../../../../states/jotai/contexts/hyperliquid/atoms';

// Countdown timer hook for funding rate countdown (every hour)
function useFundingCountdown() {
  const [countdown, setCountdown] = useState('00:00');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

      const diff = nextHour.getTime() - now.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(
        `${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`,
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return countdown;
}

// Format funding rate percentage
function formatFundingRate(rate: string | number): string {
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (Number.isNaN(num)) return '0.000000%';

  // Convert to percentage and format with 6 decimal places
  return `${(num * 100).toFixed(6)}%`;
}

function PerpTickerBar() {
  const countdown = useFundingCountdown();
  const { isReady, hasError } = usePerpSession();
  const [activeAssets] = useActiveAssetCtxAtom();
  const {
    markPrice,
    oraclePrice,
    fundingRate,
    openInterest,
    volume24h,
    change24hPercent,
  } = useMemo(() => {
    return formatAssetCtx(activeAssets?.ctx || null);
  }, [activeAssets]);


  const formattedMarkPrice = markPrice;
  const formattedOraclePrice = oraclePrice;

  const showSkeleton = !isReady || hasError || parseFloat(markPrice) === 0;

  return (
    <XStack
      bg="$bg"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      p="$4"
      alignItems="center"
      justifyContent="flex-start"
      space="$6"
      minHeight={80}
    >
      {/* Left: Token Info and Price */}
      <XStack alignItems="center" space="$4">
        <PerpTokenSelector />

        {showSkeleton ? (
          <Skeleton width={120} height={32} />
        ) : (
          <SizableText size="$headingLg" fontWeight="bold">
            ${formattedMarkPrice}
          </SizableText>
        )}

        {showSkeleton ? (
          <Skeleton width={80} height={24} />
        ) : (
          <SizableText
            size="$bodySm"
            color={change24hPercent >= 0 ? '$textSuccess' : '$textCritical'}
            bg={change24hPercent >= 0 ? '$green3' : '$red3'}
            px="$2"
            py="$1"
            borderRadius="$2"
          >
            {change24hPercent >= 0 ? '+' : ''}
            {change24hPercent.toFixed(2)}%
          </SizableText>
        )}
      </XStack>

      {/* Right: Market Data */}
      <XStack space="$6" alignItems="center" flex={1} justifyContent="flex-start">
        {/* Oracle Price */}
        <YStack space="$1" alignItems="flex-start" minWidth={120}>
          <SizableText size="$bodySm" color="$textSubdued">
            Oracle Price
          </SizableText>
          {showSkeleton ? (
            <Skeleton width={100} height={20} />
          ) : (
            <SizableText size="$bodyMd" fontWeight="600">
              ${formattedOraclePrice}
            </SizableText>
          )}
        </YStack>

        {/* 24h Volume */}
        <YStack space="$1" alignItems="flex-start" minWidth={120}>
          <SizableText size="$bodySm" color="$textSubdued">
            24h Volume
          </SizableText>
          {showSkeleton ? (
            <Skeleton width={100} height={20} />
          ) : (
            <SizableText size="$bodyMd" fontWeight="600">
              ${formatLargeNumber(volume24h)}
            </SizableText>
          )}
        </YStack>

        {/* Open Interest */}
        <YStack space="$1" alignItems="flex-start" minWidth={120}>
          <SizableText size="$bodySm" color="$textSubdued">
            Open Interest
          </SizableText>
          {showSkeleton ? (
            <Skeleton width={100} height={20} />
          ) : (
            <SizableText size="$bodyMd" fontWeight="600">
              ${formatLargeNumber(openInterest)}
            </SizableText>
          )}
        </YStack>

        {/* Funding Rate */}
        <YStack space="$1" alignItems="flex-start" minWidth={140}>
          <SizableText size="$bodySm" color="$textSubdued">
            Funding / Countdown
          </SizableText>
          {showSkeleton ? (
            <XStack alignItems="center" space="$2">
              <Skeleton width={80} height={20} />
              <Skeleton width={40} height={20} />
            </XStack>
          ) : (
            <XStack alignItems="center" space="$2">
              <SizableText
                size="$bodyMd"
                fontWeight="600"
                color={
                  parseFloat(fundingRate) >= 0
                    ? '$textSuccess'
                    : '$textCritical'
                }
              >
                {formatFundingRate(fundingRate)}
              </SizableText>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                fontFamily="$body"
                minWidth={40}
                textAlign="center"
              >
                {countdown}
              </SizableText>
            </XStack>
          )}
        </YStack>
      </XStack>
    </XStack>
  );
}

const PerpTickerBarMemo = memo(PerpTickerBar);
export { PerpTickerBarMemo as PerpTickerBar };