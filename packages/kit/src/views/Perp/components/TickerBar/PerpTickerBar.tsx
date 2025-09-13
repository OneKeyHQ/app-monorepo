import { memo, useEffect, useState } from 'react';

import {
  NumberSizeableText,
  ScrollView,
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrentTokenPriceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { usePerpSession } from '../../hooks';
import { PerpTokenSelector } from '../TokenSelector/PerpTokenSelector';

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
  const [priceData] = useCurrentTokenPriceAtom();

  const {
    markPrice,
    oraclePrice,
    funding: fundingRate,
    openInterest,
    volume24h,
    change24hPercent,
    coin,
  } = priceData;

  const formattedMarkPrice = markPrice;
  const formattedOraclePrice = oraclePrice;

  const showSkeleton = !isReady || hasError || parseFloat(markPrice) === 0;

  return (
    <XStack
      bg="$bgApp"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      p="$4"
      alignItems="center"
      justifyContent="flex-start"
      gap="$6"
      h={62}
    >
      <XStack gap="$4" alignItems="center">
        <PerpTokenSelector />
        <XStack alignItems="center" width={140} gap="$1.5" cursor="default">
          {showSkeleton ? (
            <Skeleton width={80} height={28} />
          ) : (
            <SizableText size="$headingXl">{formattedMarkPrice}</SizableText>
          )}

          {showSkeleton ? (
            <Skeleton width={50} height={16} />
          ) : (
            <NumberSizeableText
              size="$headingXs"
              color={change24hPercent >= 0 ? '$green11' : '$red11'}
              formatter="priceChange"
              formatterOptions={{
                showPlusMinusSigns: true,
              }}
            >
              {change24hPercent}
            </NumberSizeableText>
          )}
        </XStack>
      </XStack>

      {/* Right: Market Data */}
      <ScrollView
        cursor="default"
        horizontal
        flex={1}
        contentContainerStyle={{
          gap: '$8',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <YStack>
          <Tooltip
            renderTrigger={
              <SizableText size="$bodySm" color="$textSubdued">
                Oracle Price
              </SizableText>
            }
            renderContent={
              <SizableText size="$bodySm">Oracle Price</SizableText>
            }
            placement="top"
          />

          {showSkeleton ? (
            <Skeleton width={80} height={16} />
          ) : (
            <SizableText size="$headingXs">{formattedOraclePrice}</SizableText>
          )}
        </YStack>

        <YStack>
          <SizableText size="$bodySm" color="$textSubdued">
            24h Volume
          </SizableText>
          {showSkeleton ? (
            <Skeleton width={80} height={16} />
          ) : (
            <SizableText size="$headingXs">
              $
              {formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(volume24h.toString()),
              )}
            </SizableText>
          )}
        </YStack>

        <YStack>
          <Tooltip
            renderTrigger={
              <SizableText size="$bodySm" color="$textSubdued">
                Open Interest
              </SizableText>
            }
            renderContent={
              <SizableText size="$bodySm">Open Interest</SizableText>
            }
            placement="top"
          />
          {showSkeleton ? (
            <Skeleton width={80} height={16} />
          ) : (
            <SizableText size="$headingXs">
              $
              {formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(
                  (Number(openInterest) * Number(markPrice)).toString(),
                ),
              )}
            </SizableText>
          )}
        </YStack>

        <YStack>
          <Tooltip
            renderTrigger={
              <SizableText size="$bodySm" color="$textSubdued">
                Funding / Countdown
              </SizableText>
            }
            renderContent={
              <SizableText size="$bodySm">Funding / Countdown</SizableText>
            }
            placement="top"
          />
          {showSkeleton ? (
            <Skeleton width={120} height={16} />
          ) : (
            <XStack alignItems="center" gap="$2">
              <SizableText
                size="$headingXs"
                color={parseFloat(fundingRate) >= 0 ? '$green11' : '$red11'}
              >
                {(parseFloat(fundingRate) * 100).toFixed(4)}%
              </SizableText>
              <SizableText size="$headingXs" color="$text">
                {countdown}
              </SizableText>
            </XStack>
          )}
        </YStack>
      </ScrollView>
    </XStack>
  );
}

const PerpTickerBarMemo = memo(PerpTickerBar);
export { PerpTickerBarMemo as PerpTickerBar };
