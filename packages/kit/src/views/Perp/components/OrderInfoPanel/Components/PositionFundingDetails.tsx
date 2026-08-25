import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Divider,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { useDeviceTimeZone } from '@onekeyhq/kit/src/hooks/useDeviceTimeZone';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getDexIndexByCoin } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import {
  formatPerpsUsd,
  getPerpsValueColor,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useFundingCountdown } from '../../../hooks/useFundingCountdown';
import { usePerpUserFundingHistory } from '../../../hooks/usePerpOrderInfoPanel';
import { usePerpsAssetCtx } from '../../../hooks/usePerpsAssetCtx';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';

import {
  buildPositionCumulativeFundingChartData,
  buildPositionFundingProjection,
  formatPositionFundingDateTime,
} from './positionFundingUtils';

import type { IPortfolioTimePeriod } from '../../Portfolio/portfolioStats';
import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

// cspell:ignore Fundings

type IPositionFundingDetailsProps = {
  coin: string;
  assetId?: number;
  signedSize: string;
  fundingHistory?: IUserFunding[];
  isFundingHistoryLoading?: boolean;
  useOwnFundingHistory?: boolean;
  isMobile?: boolean;
};

const FUNDING_PERIODS: Array<{
  labelId: ETranslations;
  value: IPortfolioTimePeriod;
}> = [
  { labelId: ETranslations.perp_portfolio_period_1d, value: 'day' },
  { labelId: ETranslations.perp_portfolio_period_1w, value: 'week' },
  { labelId: ETranslations.perp_portfolio_period_1m, value: 'month' },
  { labelId: ETranslations.perp_portfolio_period_all, value: 'allTime' },
];

const EMPTY_FUNDING_HISTORY: IUserFunding[] = [];
const FUNDING_CHART_PRICE_SCALE_MARGINS = { top: 0.08, bottom: 0.08 };
const MemoizedLightweightChart = memo(LightweightChart);

function colorWithAlpha(color: string, alpha: number) {
  const normalized = color.trim();
  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  const fullHex =
    hex.length === 3
      ? hex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : hex;

  if (fullHex.length !== 6) {
    return `color-mix(in srgb, ${normalized} ${Math.round(
      alpha * 100,
    )}%, transparent)`;
  }

  return `rgba(${parseInt(fullHex.slice(0, 2), 16)}, ${parseInt(
    fullHex.slice(2, 4),
    16,
  )}, ${parseInt(fullHex.slice(4, 6), 16)}, ${alpha})`;
}

function formatRate(rate: string | undefined) {
  if (rate === undefined) return '--';
  const rateBN = new BigNumber(rate);
  if (!rateBN.isFinite()) return '--';
  const percentageBN = rateBN.multipliedBy(100);
  const sign = percentageBN.gt(0) ? '+' : '';
  return `${sign}${percentageBN.toFixed(4)}%`;
}

function formatPayment(payment: string | undefined) {
  if (payment === undefined) return '--';
  const paymentBN = new BigNumber(payment);
  return paymentBN.isFinite()
    ? formatPerpsUsd(paymentBN.toNumber(), true)
    : '--';
}

function getPaymentColor(payment: string | undefined) {
  if (payment === undefined) return '$text' as const;
  const paymentBN = new BigNumber(payment);
  return paymentBN.isFinite()
    ? getPerpsValueColor(paymentBN.toNumber())
    : ('$text' as const);
}

function getRateColor(rate: string | undefined) {
  if (rate === undefined) return '$text' as const;
  const rateBN = new BigNumber(rate);
  return rateBN.isFinite()
    ? getPerpsValueColor(rateBN.toNumber())
    : ('$text' as const);
}

function FundingProjectionRow({
  label,
  rate,
  payment,
  isMobile,
}: {
  label: string;
  rate?: string;
  payment?: string;
  isMobile: boolean;
}) {
  return (
    <XStack alignItems="center" minHeight={isMobile ? 24 : 20} gap="$2">
      <SizableText
        flex={1}
        size={isMobile ? '$bodySm' : '$bodyXs'}
        color="$text"
      >
        {label}
      </SizableText>
      <XStack
        width={76}
        minHeight={isMobile ? 24 : 20}
        alignItems="center"
        justifyContent="flex-end"
      >
        <SizableText
          size={isMobile ? '$bodySmMedium' : '$bodyXsMedium'}
          color={getRateColor(rate)}
        >
          {formatRate(rate)}
        </SizableText>
      </XStack>
      <XStack
        width={88}
        minHeight={isMobile ? 24 : 20}
        alignItems="center"
        justifyContent="flex-end"
      >
        <SizableText
          size={isMobile ? '$bodySmMedium' : '$bodyXsMedium'}
          color={getPaymentColor(payment)}
        >
          {formatPayment(payment)}
        </SizableText>
      </XStack>
    </XStack>
  );
}

export function PositionFundingDetails({
  coin,
  assetId,
  signedSize,
  fundingHistory,
  isFundingHistoryLoading,
  useOwnFundingHistory = false,
  isMobile = false,
}: IPositionFundingDetailsProps) {
  const intl = useIntl();
  const theme = useTheme();
  const timeZone = useDeviceTimeZone();
  const [timePeriod, setTimePeriod] = useState<IPortfolioTimePeriod>('allTime');
  const [hoverData, setHoverData] = useState<{
    time: number;
    price: number;
  } | null>(null);
  const ownFundingHistory = usePerpUserFundingHistory({
    isActive: useOwnFundingHistory,
  });
  const resolvedFundingHistory = useOwnFundingHistory
    ? ownFundingHistory.records
    : (fundingHistory ?? EMPTY_FUNDING_HISTORY);
  const resolvedFundingHistoryLoading = useOwnFundingHistory
    ? ownFundingHistory.isLoading
    : Boolean(isFundingHistoryLoading);
  const dexIndex = getDexIndexByCoin(coin);
  const { assetCtx, isLoading: isAssetCtxLoading } = usePerpsAssetCtx({
    assetId: assetId ?? -1,
    dexIndex,
  });
  const countdown = useFundingCountdown();
  const projection = useMemo(() => {
    if (assetId === undefined || isAssetCtxLoading) return null;
    return buildPositionFundingProjection({
      signedSize,
      oraclePrice: assetCtx.oraclePrice,
      fundingRate: assetCtx.fundingRate,
    });
  }, [
    assetCtx.fundingRate,
    assetCtx.oraclePrice,
    assetId,
    isAssetCtxLoading,
    signedSize,
  ]);
  const cumulativeFunding = useMemo(
    () =>
      buildPositionCumulativeFundingChartData({
        records: resolvedFundingHistory,
        coin,
        timePeriod,
      }),
    [coin, resolvedFundingHistory, timePeriod],
  );
  const chartData = cumulativeFunding.chartData;
  const latestPoint = chartData.at(-1);
  const displayPoint = hoverData
    ? ([hoverData.time, hoverData.price] as const)
    : latestPoint;
  const positiveColor = theme.bgAccent?.val ?? '#31E72F';
  const negativeColor = theme.bgCriticalStrong?.val ?? '#EF4444';
  const chartHeight = isMobile ? 180 : 144;
  const emptyChartHeight = isMobile ? 180 : 96;
  const baselineOptions = useMemo(
    (): BaselineSeriesPartialOptions => ({
      baseValue: { type: 'price', price: 0 },
      topLineColor: positiveColor,
      topFillColor1: colorWithAlpha(positiveColor, 0.1),
      topFillColor2: colorWithAlpha(positiveColor, 0.1),
      bottomLineColor: negativeColor,
      bottomFillColor1: colorWithAlpha(negativeColor, 0.1),
      bottomFillColor2: colorWithAlpha(negativeColor, 0.1),
    }),
    [negativeColor, positiveColor],
  );
  const handleChartHover = useCallback(
    ({ time, price }: { time?: number; price?: number }) => {
      setHoverData(
        time !== undefined && price !== undefined ? { time, price } : null,
      );
    },
    [],
  );

  return (
    <YStack
      width={isMobile ? '100%' : 300}
      maxWidth="100%"
      px={isMobile ? 0 : '$3'}
      pt={isMobile ? 0 : '$3'}
      pb={isMobile ? '$4' : '$3'}
      gap={isMobile ? '$3' : '$2'}
    >
      <YStack gap={isMobile ? '$3' : '$2'}>
        <XStack gap="$2" alignItems="center">
          <SizableText
            flex={1}
            size={isMobile ? '$bodyMdMedium' : '$bodySmMedium'}
            color="$textSubdued"
          >
            {intl.formatMessage({
              id: ETranslations.perps_fee_rate_projection,
            })}
          </SizableText>
          <SizableText
            width={76}
            size={isMobile ? '$bodySm' : '$bodyXs'}
            color="$textSubdued"
            textAlign="right"
          >
            {intl.formatMessage({
              id: ETranslations.perp_funding_rate__label,
            })}
          </SizableText>
          <SizableText
            width={88}
            size={isMobile ? '$bodySm' : '$bodyXs'}
            color="$textSubdued"
            textAlign="right"
          >
            {intl.formatMessage({
              id: ETranslations.perp_funding_payment__label,
            })}
          </SizableText>
        </XStack>
        <YStack gap={isMobile ? '$3' : '$2'}>
          <FundingProjectionRow
            label={intl.formatMessage(
              {
                id: ETranslations.perp_funding_current_countdown__label,
              },
              { countdown },
            )}
            rate={projection?.currentRate}
            payment={projection?.currentPayment}
            isMobile={isMobile}
          />
          <FundingProjectionRow
            label={intl.formatMessage({
              id: ETranslations.perp_funding_next_24h__label,
            })}
            rate={projection?.next24hRate}
            payment={projection?.next24hPayment}
            isMobile={isMobile}
          />
          <FundingProjectionRow
            label={intl.formatMessage({
              id: ETranslations.perp_funding_apr__label,
            })}
            rate={projection?.annualizedRate}
            payment={projection?.annualizedPayment}
            isMobile={isMobile}
          />
        </YStack>
        <SizableText
          size={isMobile ? '$bodySm' : '$bodyXs'}
          color="$textSubdued"
        >
          {intl.formatMessage({
            id: ETranslations.perp_funding_projection_note__desc,
          })}
        </SizableText>
      </YStack>

      <Divider my="$1" />

      <YStack gap="$2">
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <SizableText
            size={isMobile ? '$bodyMdMedium' : '$bodySmMedium'}
            color="$textSubdued"
          >
            {intl.formatMessage({
              id: ETranslations.perp_funding_cumulative__title,
            })}
          </SizableText>
          <XStack gap="$0.5">
            {FUNDING_PERIODS.map((period) => {
              const isSelected = period.value === timePeriod;
              return (
                <XStack
                  key={period.value}
                  h={isMobile ? 28 : 24}
                  minWidth={isMobile ? 30 : 28}
                  px={isMobile ? '$1.5' : '$1'}
                  py={0}
                  borderRadius="$full"
                  borderCurve="continuous"
                  alignItems="center"
                  justifyContent="center"
                  bg={isSelected ? '$bgActive' : '$transparent'}
                  cursor="pointer"
                  pressStyle={{ bg: '$bgStrong' }}
                  onPress={() => {
                    setTimePeriod(period.value);
                    setHoverData(null);
                  }}
                >
                  <SizableText
                    size={isMobile ? '$bodySmMedium' : '$bodyXsMedium'}
                    color={isSelected ? '$text' : '$textSubdued'}
                  >
                    {intl.formatMessage({ id: period.labelId })}
                  </SizableText>
                </XStack>
              );
            })}
          </XStack>
        </XStack>
        {displayPoint ? (
          <XStack justifyContent="flex-start" gap="$1.5">
            <SizableText size={isMobile ? '$bodySm' : '$bodyXs'} color="$text">
              {formatPositionFundingDateTime({
                timestampSeconds: displayPoint[0],
                timeZone,
              })}
            </SizableText>
            <SizableText
              size={isMobile ? '$bodySmMedium' : '$bodyXsMedium'}
              color={getPerpsValueColor(displayPoint[1])}
            >
              {formatPerpsUsd(displayPoint[1], true)}
            </SizableText>
          </XStack>
        ) : null}
        {resolvedFundingHistoryLoading ? (
          <Skeleton height={chartHeight} borderRadius="$2" />
        ) : null}
        {!resolvedFundingHistoryLoading && chartData.length === 0 ? (
          <YStack
            height={emptyChartHeight}
            alignItems="center"
            justifyContent="center"
          >
            <SizableText
              size={isMobile ? '$bodySm' : '$bodyXs'}
              color="$textSubdued"
            >
              {intl.formatMessage({
                id: ETranslations.perp_funding_market_empty__desc,
              })}
            </SizableText>
          </YStack>
        ) : null}
        {!resolvedFundingHistoryLoading && chartData.length > 0 ? (
          <MemoizedLightweightChart
            data={chartData}
            height={chartHeight}
            onHover={handleChartHover}
            lineColor={positiveColor}
            topColor={colorWithAlpha(positiveColor, 0.1)}
            bottomColor={colorWithAlpha(positiveColor, 0)}
            lineWidth={2}
            showTimeScale={false}
            priceScaleMargins={FUNDING_CHART_PRICE_SCALE_MARGINS}
            seriesType="baseline"
            baselineOptions={baselineOptions}
            timeZone={timeZone}
            locale={intl.locale}
          />
        ) : null}
      </YStack>
    </YStack>
  );
}

export function showPositionFundingDetailsDialog({
  coin,
  assetId,
  signedSize,
  title,
}: Pick<IPositionFundingDetailsProps, 'coin' | 'assetId' | 'signedSize'> & {
  title: string;
}) {
  Dialog.show({
    title,
    showFooter: false,
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    renderContent: (
      <PerpsProviderMirror>
        <ScrollView maxHeight={560} showsVerticalScrollIndicator={false}>
          <PositionFundingDetails
            coin={coin}
            assetId={assetId}
            signedSize={signedSize}
            useOwnFundingHistory
            isMobile
          />
        </ScrollView>
      </PerpsProviderMirror>
    ),
  });
}
