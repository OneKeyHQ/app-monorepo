// cspell:ignore financials
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  getTokenValue,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStockFinancialPeriod } from '@onekeyhq/shared/types/marketStockFinancials';

import { FinancialChart } from './FinancialChart';
import { buildFinancialChart } from './financialChartData';
import { isFinancialNumber } from './financialsUtils';
import { useStockFinancialLabels } from './stockFinancialLabels';
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
  const [width, setWidth] = useState(640);
  const compactConversion = width < 560;
  const quarterly = buildFinancialChart(
    quarter?.data,
    kind,
    labels,
    compactConversion,
  );
  const supportsQuarter = quarterly.rows.some((row) =>
    row.values.some(isFinancialNumber),
  );
  const period =
    selectedPeriod === 'quarter' && supportsQuarter ? 'quarter' : 'annual';
  const result = period === 'annual' ? annual : quarter;
  const chart =
    period === 'quarter'
      ? quarterly
      : buildFinancialChart(annual?.data, kind, labels, compactConversion);
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
    <YStack
      gap="$4"
      flex={1}
      testID={`stock-financials-${kind}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {/* When the title and the period switch cannot share a row (the narrow
          mobile overview, long translations), the switch wraps onto its own
          line, starting from the left. */}
      <XStack
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap="$2"
        minHeight="$10"
      >
        <XStack alignItems="baseline" gap="$3" flexShrink={1}>
          <SizableText size="$headingMd" flexShrink={1}>
            {labels[kind]}
          </SizableText>
          {kind === 'earnings' && showNextDate ? (
            <SizableText
              size="$bodyXs"
              color="$textDisabled"
              numberOfLines={1}
              flexShrink={0}
            >{`${labels.next}: ${intl.formatDate(nextTimestamp, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}`}</SizableText>
          ) : null}
        </XStack>
        <XStack
          height={38}
          py="$1"
          gap="$0.5"
          alignItems="center"
          flexShrink={0}
        >
          {(['annual', 'quarter'] as const)
            .filter((item) => item === 'annual' || supportsQuarter)
            .map((item) => (
              <Button
                key={item}
                size="small"
                height={30}
                m="$0"
                px="$2.5"
                borderWidth={0}
                flexShrink={0}
                textEllipsis
                borderRadius="$full"
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
          currency={chart.currency}
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
            {intl.formatMessage({
              id: result?.failed
                ? ETranslations.global_unknown_error_retry_message
                : ETranslations.global_no_data,
            })}
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

// Gap between the two card columns; also feeds the card width calculation.
const CARD_COLUMN_GAP = '$10';

export function StockFinancials({
  stockId,
  labels: labelsOverride,
  withHorizontalPadding = true,
}: {
  stockId: string;
  withHorizontalPadding?: boolean;
  labels?: IStockFinancialLabels;
}) {
  const translatedLabels = useStockFinancialLabels();
  const labels = labelsOverride ?? translatedLabels;
  const { result, isLoading, retry } = useStockFinancials(stockId);
  const [contentWidth, setContentWidth] = useState(0);
  const columnGap = getTokenValue(CARD_COLUMN_GAP, 'space');
  // Measure the content column: the desktop trade panel also consumes width.
  const cardWidth =
    contentWidth >= 800 ? (contentWidth - columnGap) / 2 : '100%';
  return (
    <YStack
      testID="stock-financials"
      px={withHorizontalPadding ? '$5' : '$0'}
      py="$2"
    >
      <SizableText size="$headingXl" pt="$6" pb="$6">
        {labels.financials}
      </SizableText>
      <XStack
        flexWrap="wrap"
        columnGap={CARD_COLUMN_GAP}
        rowGap="$10"
        pb="$6"
        onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
      >
        {(['performance', 'conversion', 'debt', 'earnings'] as const).map(
          (kind) => (
            <Stack key={`${stockId}-${kind}`} width={cardWidth} minWidth={0}>
              <FinancialCard
                kind={kind}
                annual={result?.annual}
                quarter={result?.quarter}
                labels={labels}
                retry={retry}
                isLoading={isLoading}
              />
            </Stack>
          ),
        )}
      </XStack>
    </YStack>
  );
}
