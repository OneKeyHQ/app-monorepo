import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrentTokenPriceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { useFundingCountdown, usePerpSession } from '../../hooks';
import { PerpTokenSelector } from '../TokenSelector/PerpTokenSelector';

function StatRow({
  label,
  children,
  skeletonWidth,
  showSkeleton,
}: {
  label: string;
  children: ReactNode;
  skeletonWidth: number;
  showSkeleton: boolean;
}) {
  return (
    <YStack gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      {showSkeleton ? <Skeleton width={skeletonWidth} height={16} /> : children}
    </YStack>
  );
}

function MobilePerpMarketHeader() {
  const intl = useIntl();
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
  } = priceData;

  const markPriceNumber = useMemo(() => parseFloat(markPrice), [markPrice]);
  const fundingRateNumber = useMemo(
    () => Number.parseFloat(fundingRate ?? ''),
    [fundingRate],
  );

  const showSkeleton =
    !isReady ||
    hasError ||
    !Number.isFinite(markPriceNumber) ||
    markPriceNumber === 0;

  const fundingColor = fundingRateNumber >= 0 ? '$green11' : '$red11';
  const fundingDisplay = Number.isFinite(fundingRateNumber)
    ? `${(fundingRateNumber * 100).toFixed(4)}%`
    : '--';

  const oraclePriceDisplay = useMemo(() => {
    if (
      oraclePrice === undefined ||
      oraclePrice === null ||
      oraclePrice === ''
    ) {
      return '--';
    }
    return oraclePrice;
  }, [oraclePrice]);

  const volumeDisplay = useMemo(() => {
    if (volume24h === undefined || volume24h === null) {
      return '--';
    }
    return `$${formatDisplayNumber(
      NUMBER_FORMATTER.marketCap(volume24h.toString()),
    )}`;
  }, [volume24h]);

  const openInterestDisplay = useMemo(() => {
    if (
      openInterest === undefined ||
      openInterest === null ||
      openInterest === '' ||
      markPrice === undefined ||
      markPrice === null ||
      markPrice === ''
    ) {
      return '--';
    }
    const dollarValue = NUMBER_FORMATTER.marketCap(
      (Number(openInterest) * Number(markPrice || 0)).toString(),
    );
    return `$${formatDisplayNumber(dollarValue)}`;
  }, [markPrice, openInterest]);

  return (
    <YStack
      bg="$bgApp"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      p="$5"
      gap="$5"
    >
      <PerpTokenSelector />

      <XStack alignItems="flex-start" justifyContent="space-between" gap="$6">
        <YStack gap="$1">
          {showSkeleton ? (
            <Skeleton width={120} height={28} />
          ) : (
            <SizableText size="$headingXl">{markPrice}</SizableText>
          )}

          {showSkeleton ? (
            <Skeleton width={72} height={16} />
          ) : (
            <NumberSizeableText
              size="$bodyLg"
              color={change24hPercent >= 0 ? '$green11' : '$red11'}
              formatter="priceChange"
              formatterOptions={{
                showPlusMinusSigns: true,
              }}
            >
              {change24hPercent}
            </NumberSizeableText>
          )}
        </YStack>

        <YStack gap="$4" flex={1}>
          <StatRow
            label={intl.formatMessage({
              id: ETranslations.perp_token_bar_oracle_price,
            })}
            skeletonWidth={96}
            showSkeleton={showSkeleton}
          >
            <SizableText size="$bodyLgMedium">{oraclePriceDisplay}</SizableText>
          </StatRow>

          <StatRow
            label={intl.formatMessage({
              id: ETranslations.perp_token_bar_24h_Volume,
            })}
            skeletonWidth={120}
            showSkeleton={showSkeleton}
          >
            <SizableText size="$bodyLgMedium">{volumeDisplay}</SizableText>
          </StatRow>

          <StatRow
            label={intl.formatMessage({
              id: ETranslations.perp_token_bar_open_Interest,
            })}
            skeletonWidth={120}
            showSkeleton={showSkeleton}
          >
            <SizableText size="$bodyLgMedium">
              {openInterestDisplay}
            </SizableText>
          </StatRow>

          <StatRow
            label={intl.formatMessage({
              id: ETranslations.perp_token_bar_Funding,
            })}
            skeletonWidth={140}
            showSkeleton={showSkeleton}
          >
            <XStack alignItems="center" gap="$2">
              <SizableText size="$bodyLgMedium" color={fundingColor}>
                {fundingDisplay}
              </SizableText>
              <SizableText size="$bodySm" color="$text">
                {countdown}
              </SizableText>
            </XStack>
          </StatRow>
        </YStack>
      </XStack>
    </YStack>
  );
}

const MobilePerpMarketHeaderMemo = memo(MobilePerpMarketHeader);
export { MobilePerpMarketHeaderMemo as MobilePerpMarketHeader };
