// cspell:ignore financials
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStockFinancialPeriod } from '@onekeyhq/shared/types/marketStockFinancials';

import { FinancialChart } from './FinancialChart';
import { buildFinancialChart } from './financialChartData';
import { isFinancialNumber } from './financialsUtils';
import { useStockFinancials } from './useStockFinancials';

import type {
  IFinancialChartKind,
  IStockFinancialLabels,
} from './financialChartData';
import type { IFinancialPeriodResult } from './useStockFinancials';

function FinancialCard({
  kind,
  annual,
  quarter,
  labels,
  retry,
  isLoading,
}: {
  kind: IFinancialChartKind;
  annual?: IFinancialPeriodResult;
  quarter?: IFinancialPeriodResult;
  labels: IStockFinancialLabels;
  retry: () => Promise<void>;
  isLoading: boolean;
}) {
  const intl = useIntl();
  const [selectedPeriod, setSelectedPeriod] =
    useState<IStockFinancialPeriod>('annual');
  const quarterly = buildFinancialChart(quarter?.data, kind, labels);
  const supportsQuarter = quarterly.rows.some((row) =>
    row.values.some(isFinancialNumber),
  );
  const period =
    selectedPeriod === 'quarter' && supportsQuarter ? 'quarter' : 'annual';
  const result = period === 'annual' ? annual : quarter;
  const chart =
    period === 'quarter'
      ? quarterly
      : buildFinancialChart(annual?.data, kind, labels);
  const hasData = chart.rows.some((row) => row.values.some(isFinancialNumber));
  const nextDate = result?.data?.earnings.nextEarningsDate;
  const nextTimestamp =
    nextDate && /^\d{4}-\d{2}-\d{2}$/.test(nextDate)
      ? Date.parse(`${nextDate}T00:00:00Z`)
      : NaN;
  const today = new Date().toISOString().slice(0, 10);
  const showNextDate = Boolean(
    nextDate && nextDate >= today && Number.isFinite(nextTimestamp),
  );
  const hasPartial = result?.data?.partial || quarter?.failed || annual?.failed;
  return (
    <YStack gap="$3" py="$5" testID={`stock-financials-${kind}`}>
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        flexWrap="wrap"
      >
        <YStack gap="$1" flexShrink={1}>
          <SizableText size="$headingSm">{labels[kind]}</SizableText>
          {kind === 'earnings' && showNextDate ? (
            <SizableText
              size="$bodyXs"
              color="$textSubdued"
            >{`${labels.next}: ${intl.formatDate(nextTimestamp, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}`}</SizableText>
          ) : null}
        </YStack>
        <XStack gap="$1" alignItems="center">
          {chart.currency ? (
            <SizableText size="$bodyXs" color="$textSubdued" mr="$2">
              {chart.currency}
            </SizableText>
          ) : null}
          {(['annual', 'quarter'] as const)
            .filter((item) => item === 'annual' || supportsQuarter)
            .map((item) => (
              <Button
                key={item}
                size="small"
                variant={period === item ? 'secondary' : 'tertiary'}
                testID={`stock-financials-${kind}-${item}`}
                aria-pressed={period === item}
                onPress={() => setSelectedPeriod(item)}
              >
                {labels[item]}
              </Button>
            ))}
        </XStack>
      </XStack>
      {!annual && isLoading ? <Skeleton height={300} width="100%" /> : null}
      {annual && hasData ? (
        <FinancialChart
          key={`${kind}-${period}`}
          rows={chart.rows}
          series={chart.series}
          testID={`stock-financials-${kind}-chart`}
        />
      ) : null}
      {annual && !hasData ? (
        <YStack
          height={160}
          alignItems="center"
          justifyContent="center"
          gap="$3"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_no_data })}
          </SizableText>
          <Button
            testID={`stock-financials-${kind}-retry`}
            size="small"
            variant="tertiary"
            loading={isLoading}
            onPress={() => void retry()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </YStack>
      ) : null}
      {chart.simplified && hasData ? (
        <SizableText size="$bodyXs" color="$textSubdued">
          {labels.simplified}
        </SizableText>
      ) : null}
      {hasPartial && hasData ? (
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <SizableText size="$bodyXs" color="$textSubdued">
            {labels.partial}
          </SizableText>
          <Button
            testID={`stock-financials-${kind}-retry`}
            size="small"
            variant="tertiary"
            loading={isLoading}
            onPress={() => void retry()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </XStack>
      ) : null}
    </YStack>
  );
}

export function StockFinancials({
  stockId,
  labels,
}: {
  stockId: string;
  labels: IStockFinancialLabels;
}) {
  const { result, isLoading, retry } = useStockFinancials(stockId);
  return (
    <YStack testID="stock-financials" px="$5" py="$2">
      <SizableText size="$headingXl" pt="$6">
        {labels.financials}
      </SizableText>
      {(['performance', 'conversion', 'debt', 'earnings'] as const).map(
        (kind) => (
          <FinancialCard
            key={`${stockId}-${kind}`}
            kind={kind}
            annual={result?.annual}
            quarter={result?.quarter}
            labels={labels}
            retry={retry}
            isLoading={isLoading}
          />
        ),
      )}
    </YStack>
  );
}
