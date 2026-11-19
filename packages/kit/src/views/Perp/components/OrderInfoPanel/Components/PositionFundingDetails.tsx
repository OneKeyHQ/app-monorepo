import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Divider,
  ScrollView,
  SegmentControl,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { useDeviceTimeZone } from '@onekeyhq/kit/src/hooks/useDeviceTimeZone';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getDexIndexByCoin } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import {
  formatPerpsUsd,
  getPerpsValueColor,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useFundingCountdown } from '../../../hooks/useFundingCountdown';
import { usePerpUserFundingHistory } from '../../../hooks/usePerpOrderInfoPanel';
import { usePerpsAccountScopedActivePositions } from '../../../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsAssetCtx } from '../../../hooks/usePerpsAssetCtx';
import { PerpsAccountSelectorProviderMirror } from '../../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';

import {
  buildPositionCumulativeFundingChartData,
  buildPositionFundingProjection,
  formatPositionFundingDateTime,
  resolvePositionFundingAssetCtx,
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
  isFundingHistoryError?: boolean;
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

function formatRate(rate: string | undefined) {
  if (rate === undefined) return '--';
  const rateBN = new BigNumber(rate);
  if (!rateBN.isFinite()) return '--';
  const percentageBN = rateBN.multipliedBy(100);
  return `${percentageBN.toFixed(4)}%`;
}

function formatPayment(payment: string | undefined) {
  if (payment === undefined) return '--';
  const paymentBN = new BigNumber(payment);
  return paymentBN.isFinite()
    ? formatPerpsUsd(paymentBN.toNumber(), true)
    : '--';
}

function getProjectionValueColor(value: string | undefined) {
  const number = new BigNumber(value ?? '');
  return number.isFinite()
    ? getPerpsValueColor(number.toNumber())
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
  const minHeight = isMobile ? 28 : 20;
  const rateColumnWidth = isMobile ? 88 : 76;
  const paymentColumnWidth = isMobile ? 104 : 88;
  return (
    <XStack alignItems="center" minHeight={minHeight} gap="$2">
      <SizableText
        flex={1}
        size={isMobile ? '$bodyMd' : '$bodySm'}
        color="$text"
      >
        {label}
      </SizableText>
      <XStack
        width={rateColumnWidth}
        minHeight={minHeight}
        alignItems="center"
        justifyContent="flex-end"
      >
        <SizableText
          size={isMobile ? '$bodyMdMedium' : '$bodySmMedium'}
          color="$text"
          fontVariant={['tabular-nums']}
        >
          {formatRate(rate)}
        </SizableText>
      </XStack>
      <XStack
        width={paymentColumnWidth}
        minHeight={minHeight}
        alignItems="center"
        justifyContent="flex-end"
      >
        <SizableText
          size={isMobile ? '$bodyMdMedium' : '$bodySmMedium'}
          color={getProjectionValueColor(payment)}
          fontVariant={['tabular-nums']}
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
  isFundingHistoryError,
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
  const resolvedFundingHistoryError = useOwnFundingHistory
    ? ownFundingHistory.isError
    : Boolean(isFundingHistoryError);
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const dexIndex = getDexIndexByCoin(coin);
  const { assetCtx: fallbackAssetCtx, isLoading: isFallbackAssetCtxLoading } =
    usePerpsAssetCtx({
      assetId: assetId ?? -1,
      dexIndex,
    });
  const { assetCtx, usesActiveAssetCtx } = useMemo(
    () =>
      resolvePositionFundingAssetCtx({
        positionCoin: coin,
        activeMode: activeTradeInstrument.mode,
        activeCoin: activeTradeInstrument.coin,
        activeAssetCtx,
        fallbackAssetCtx,
        preferActiveAssetCtx: !isMobile,
      }),
    [
      activeAssetCtx,
      activeTradeInstrument.coin,
      activeTradeInstrument.mode,
      coin,
      fallbackAssetCtx,
      isMobile,
    ],
  );
  const isAssetCtxLoading = isFallbackAssetCtxLoading && !usesActiveAssetCtx;
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
  const chartData = useMemo(
    () =>
      buildPositionCumulativeFundingChartData({
        records: resolvedFundingHistory,
        coin,
        timePeriod,
      }),
    [coin, resolvedFundingHistory, timePeriod],
  );
  const latestPoint = chartData.at(-1);
  const displayPoint = hoverData
    ? ([hoverData.time, hoverData.price] as const)
    : latestPoint;
  const positiveColor = theme.bgAccent?.val ?? '#31E72F';
  const negativeColor = theme.bgCriticalStrong?.val ?? '#EF4444';
  const zeroLineColor = theme.borderSubdued?.val ?? '#3D3D41';
  const chartHeight = isMobile ? 180 : 112;
  const emptyChartHeight = isMobile ? 180 : 96;
  const baselineOptions = useMemo(
    (): BaselineSeriesPartialOptions => ({
      baseValue: { type: 'price', price: 0 },
      topLineColor: positiveColor,
      topFillColor1: 'transparent',
      topFillColor2: 'transparent',
      bottomLineColor: negativeColor,
      bottomFillColor1: 'transparent',
      bottomFillColor2: 'transparent',
    }),
    [negativeColor, positiveColor],
  );
  const zeroReferenceLine = useMemo(
    () => ({
      price: 0,
      color: zeroLineColor,
      lineWidth: 1 as const,
      lineStyle: 'dashed' as const,
      axisLabelVisible: false,
    }),
    [zeroLineColor],
  );
  const handleChartHover = useCallback(
    ({ time, price }: { time?: number; price?: number }) => {
      setHoverData(
        time !== undefined && price !== undefined ? { time, price } : null,
      );
    },
    [],
  );
  const sectionHeaderTextSize = isMobile ? '$bodyMdMedium' : '$bodySm';
  const rateColumnWidth = isMobile ? 88 : 76;
  const paymentColumnWidth = isMobile ? 104 : 88;
  const periodOptions = useMemo(
    () =>
      FUNDING_PERIODS.map((period) => ({
        label: (
          <SizableText
            size={isMobile ? '$bodyMdMedium' : '$bodyXsMedium'}
            color={timePeriod === period.value ? '$text' : '$textSubdued'}
            textAlign="center"
            numberOfLines={1}
          >
            {intl.formatMessage({ id: period.labelId })}
          </SizableText>
        ),
        value: period.value,
      })),
    [intl, isMobile, timePeriod],
  );
  const handleTimePeriodChange = useCallback((value: string | number) => {
    setTimePeriod(value as IPortfolioTimePeriod);
    setHoverData(null);
  }, []);

  return (
    <YStack
      width={isMobile ? '100%' : 300}
      maxWidth="100%"
      px={isMobile ? 0 : '$3'}
      pt={isMobile ? 0 : '$3'}
      pb={isMobile ? 0 : '$3'}
      gap={isMobile ? '$3' : '$2'}
    >
      <YStack gap="$3">
        <XStack gap="$2" alignItems="center">
          <SizableText
            flex={1}
            size={sectionHeaderTextSize}
            color="$textSubdued"
          >
            {intl.formatMessage({
              id: ETranslations.perps_fee_rate_projection,
            })}
          </SizableText>
          <SizableText
            width={rateColumnWidth}
            size={sectionHeaderTextSize}
            color="$textSubdued"
            textAlign="right"
          >
            {intl.formatMessage({
              id: ETranslations.perp_funding_rate__label,
            })}
          </SizableText>
          <SizableText
            width={paymentColumnWidth}
            size={sectionHeaderTextSize}
            color="$textSubdued"
            textAlign="right"
          >
            {intl.formatMessage({
              id: ETranslations.perp_funding_payment__label,
            })}
          </SizableText>
        </XStack>
        <YStack gap="$3">
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

      <Divider
        my="$1"
        borderColor="$borderSubdued"
        borderBottomWidth={isMobile ? 0.5 : undefined}
      />

      <YStack gap="$3">
        <SizableText
          minWidth={0}
          size={sectionHeaderTextSize}
          color="$textSubdued"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {intl.formatMessage({
            id: ETranslations.perp_funding_cumulative__title,
          })}
        </SizableText>
        {isMobile || displayPoint ? (
          <XStack justifyContent="flex-start" gap="$1.5">
            <SizableText size={isMobile ? '$bodyMd' : '$bodyXs'} color="$text">
              {displayPoint
                ? formatPositionFundingDateTime({
                    timestampSeconds: displayPoint[0],
                    timeZone,
                  })
                : // Preserve the text line height when the mobile chart is empty.
                  ' '}
            </SizableText>
            {displayPoint ? (
              <SizableText
                size={isMobile ? '$bodyMdMedium' : '$bodyXsMedium'}
                color={getPerpsValueColor(displayPoint[1])}
              >
                {formatPerpsUsd(displayPoint[1], true)}
              </SizableText>
            ) : null}
          </XStack>
        ) : null}
        {resolvedFundingHistoryLoading ? (
          <Skeleton height={chartHeight} borderRadius="$2" />
        ) : null}
        {!resolvedFundingHistoryLoading && resolvedFundingHistoryError ? (
          <YStack
            height={emptyChartHeight}
            alignItems="center"
            justifyContent="center"
          >
            <SizableText
              size={isMobile ? '$bodySm' : '$bodyXs'}
              color="$textSubdued"
            >
              {intl.formatMessage({ id: ETranslations.global_failed })}
            </SizableText>
          </YStack>
        ) : null}
        {!resolvedFundingHistoryLoading &&
        !resolvedFundingHistoryError &&
        chartData.length === 0 ? (
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
        {!resolvedFundingHistoryLoading &&
        !resolvedFundingHistoryError &&
        chartData.length > 0 ? (
          <MemoizedLightweightChart
            data={chartData}
            height={chartHeight}
            onHover={handleChartHover}
            lineColor={positiveColor}
            lineWidth={2}
            showTimeScale={false}
            priceScaleMargins={FUNDING_CHART_PRICE_SCALE_MARGINS}
            seriesType="baseline"
            baselineOptions={baselineOptions}
            referenceLine={zeroReferenceLine}
            timeZone={timeZone}
            locale={intl.locale}
          />
        ) : null}
        <SegmentControl
          fullWidth
          h={isMobile ? 28 : 24}
          value={timePeriod}
          onChange={handleTimePeriodChange}
          options={periodOptions}
          slotBackgroundColor="$transparent"
          activeBackgroundColor="$bgActive"
          activeTextColor="$text"
          inactiveTextColor="$textSubdued"
          segmentControlItemStyleProps={{
            h: isMobile ? 28 : 24,
            minWidth: isMobile ? 30 : 28,
            px: isMobile ? '$1.5' : '$1',
            py: '$0',
            borderRadius: '$full',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        />
      </YStack>
    </YStack>
  );
}

function MobilePositionFundingDetails({
  coin,
  assetId,
}: Pick<IPositionFundingDetailsProps, 'coin' | 'assetId'>) {
  const activePositions = usePerpsAccountScopedActivePositions();
  const signedSize = useMemo(
    () =>
      activePositions.find((item) => item.position.coin === coin)?.position
        .szi ?? '0',
    [activePositions, coin],
  );

  return (
    <ScrollView maxHeight={560} showsVerticalScrollIndicator={false}>
      <PositionFundingDetails
        coin={coin}
        assetId={assetId}
        signedSize={signedSize}
        useOwnFundingHistory
        isMobile
      />
    </ScrollView>
  );
}

export function showPositionFundingDetailsDialog({
  coin,
  assetId,
  title,
}: Pick<IPositionFundingDetailsProps, 'coin' | 'assetId'> & {
  title: string;
}) {
  Dialog.show({
    title,
    showFooter: false,
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    renderContent: (
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <MobilePositionFundingDetails coin={coin} assetId={assetId} />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
  });
}
