import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatPerpsUsd,
  getHyperliquidTokenImageUris,
  getPerpsValueColor,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  type IPortfolioTimePeriod,
  buildFundingMarketBreakdown,
  buildFundingPaymentSummary,
} from './portfolioStats';

const FUNDING_MARKET_DISPLAY_LIMIT = 8;

const PERIOD_LABELS: Record<IPortfolioTimePeriod, ETranslations> = {
  day: ETranslations.perp_portfolio_period_1d,
  week: ETranslations.perp_portfolio_period_1w,
  month: ETranslations.perp_portfolio_period_1m,
  allTime: ETranslations.perp_portfolio_period_all,
};

function formatMarketName(coin: string) {
  return parseDexCoin(coin).displayName;
}

function FundingChartSkeleton() {
  return (
    <YStack gap="$2" pt="$1">
      {Array.from({ length: 8 }, (_, index) => (
        <XStack key={index} height={28} gap="$3" alignItems="center">
          <Skeleton width="$12" height="$3.5" />
          <Skeleton flex={1} height="$2.5" borderRadius="$full" />
          <Skeleton width="$16" height="$3.5" />
        </XStack>
      ))}
    </YStack>
  );
}

export function PerpFundingBreakdown({
  records,
  timePeriod,
  isLoading,
  isMobile,
}: {
  records: IUserFunding[];
  timePeriod: IPortfolioTimePeriod;
  isLoading: boolean;
  isMobile: boolean;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const breakdown = useMemo(
    () =>
      buildFundingMarketBreakdown({
        records,
        timePeriod,
        bucketCount: 1,
        maxMarkets: Number.MAX_SAFE_INTEGER,
      }),
    [records, timePeriod],
  );
  const visibleRows = useMemo(
    () =>
      breakdown.rows
        .toSorted(
          (rowA, rowB) =>
            Math.abs(rowB.total) - Math.abs(rowA.total) ||
            rowB.activity - rowA.activity,
        )
        .slice(0, FUNDING_MARKET_DISPLAY_LIMIT),
    [breakdown.rows],
  );
  const paymentSummary = useMemo(
    () => buildFundingPaymentSummary(records),
    [records],
  );
  const maxAbsTotal = Math.max(
    0,
    ...visibleRows.map((row) => Math.abs(row.total)),
  );
  const negativeColor = theme.bgCriticalStrong?.val ?? '#EF4444';
  const positiveColor = theme.bgAccent?.val ?? '#31E72F';
  const marketWidth = isMobile ? 84 : 92;
  const amountWidth = isMobile ? 74 : 88;

  let chartContent = (
    <YStack gap="$2" pt="$1">
      {visibleRows.map((row) => {
        const width =
          maxAbsTotal > 0 ? (Math.abs(row.total) / maxAbsTotal) * 100 : 0;
        return (
          <XStack key={row.coin} minHeight={34} alignItems="center" gap="$3">
            <XStack
              width={marketWidth}
              flexShrink={0}
              gap="$1.5"
              alignItems="center"
            >
              <Token
                size="xs"
                borderRadius="$full"
                tokenImageUris={getHyperliquidTokenImageUris(row.coin)}
                fallbackIcon="CryptoCoinOutline"
                flexShrink={0}
              />
              <SizableText
                flex={1}
                minWidth={0}
                size="$bodySmMedium"
                color="$textSubdued"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {formatMarketName(row.coin)}
              </SizableText>
            </XStack>
            <YStack flex={1} height={18} justifyContent="center">
              <Stack
                width={`${width}%`}
                minWidth={row.total === 0 ? 0 : 3}
                height={14}
                borderRadius="$1"
                bg={row.total >= 0 ? positiveColor : negativeColor}
                opacity={0.85}
              />
            </YStack>
            <SizableText
              width={amountWidth}
              flexShrink={0}
              size="$bodySmMedium"
              color={getPerpsValueColor(row.total)}
              textAlign="right"
              numberOfLines={1}
              fontVariant={['tabular-nums']}
            >
              {formatPerpsUsd(row.total, true)}
            </SizableText>
          </XStack>
        );
      })}
    </YStack>
  );
  if (visibleRows.length === 0) {
    chartContent = (
      <YStack flex={1} minHeight={260} justifyContent="center">
        <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.perp_portfolio_funding_empty__desc,
          })}
        </SizableText>
      </YStack>
    );
  }
  if (isLoading && visibleRows.length === 0) {
    chartContent = <FundingChartSkeleton />;
  }

  const marketBreakdownPanel = (
    <YStack
      flex={isMobile ? undefined : 1}
      minHeight={isMobile ? 390 : 0}
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3.5"
      gap="$4"
    >
      <XStack justifyContent="space-between" alignItems="baseline">
        <SizableText
          size="$bodyXs"
          color="$textDisabled"
          textTransform="uppercase"
          letterSpacing={1.2}
        >
          {intl.formatMessage({
            id: ETranslations.perp_portfolio_funding_by_market__title,
          })}
        </SizableText>
        <SizableText size="$bodyXs" color="$textDisabled">
          {intl.formatMessage({ id: PERIOD_LABELS[timePeriod] })}
        </SizableText>
      </XStack>
      {chartContent}
    </YStack>
  );

  return (
    <YStack flex={isMobile ? undefined : 1} gap="$3">
      {marketBreakdownPanel}
      <YStack bg="$bgSubdued" borderRadius="$3" p="$3.5">
        <XStack alignItems="center">
          <YStack flex={1} gap={isMobile ? '$1' : '$0.5'}>
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_funding_total_paid__label,
              })}
            </SizableText>
            {isLoading && records.length === 0 ? (
              <Skeleton width="$16" height="$5" />
            ) : (
              <SizableText
                size="$headingSm"
                color="$text"
                fontVariant={['tabular-nums']}
              >
                {formatPerpsUsd(paymentSummary.totalPaid)}
              </SizableText>
            )}
          </YStack>
          <YStack flex={1} gap={isMobile ? '$1' : '$0.5'} alignItems="flex-end">
            <SizableText size="$bodyXs" color="$textDisabled">
              {intl.formatMessage({
                id: ETranslations.perp_portfolio_funding_total_received__label,
              })}
            </SizableText>
            {isLoading && records.length === 0 ? (
              <Skeleton width="$16" height="$5" />
            ) : (
              <SizableText
                size="$headingSm"
                color="$text"
                fontVariant={['tabular-nums']}
              >
                {formatPerpsUsd(paymentSummary.totalReceived)}
              </SizableText>
            )}
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}
