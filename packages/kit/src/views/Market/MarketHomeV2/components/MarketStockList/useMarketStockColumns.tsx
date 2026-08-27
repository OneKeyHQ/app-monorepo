import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { StockSparkline } from './StockSparkline';
import { parseMarketStockNumber } from './utils';

const EMPTY_VALUE = '--';
// Column widths follow the 760px design grid: a 150px company column plus 122px
// metric columns. Widths are derived from those units so that hiding a metric
// column redistributes the freed space instead of leaving a gap in the row.
const COMPANY_COLUMN_UNITS = 150;
const METRIC_COLUMN_UNITS = 122;

function getStockColumnWidths(metricColumnCount: number): {
  companyColumnWidth: `${number}%`;
  metricColumnWidth: `${number}%`;
} {
  const totalUnits =
    COMPANY_COLUMN_UNITS + METRIC_COLUMN_UNITS * metricColumnCount;
  return {
    companyColumnWidth: `${(COMPANY_COLUMN_UNITS / totalUnits) * 100}%`,
    metricColumnWidth: `${(METRIC_COLUMN_UNITS / totalUnits) * 100}%`,
  };
}

function MissingValue() {
  return (
    <SizableText size="$bodyMd" color="$textSubdued">
      {EMPTY_VALUE}
    </SizableText>
  );
}

const metricColumnProps = {
  flexShrink: 0,
  px: '$2',
} as const;

export function useMarketStockColumns({
  showSparkline = true,
}: {
  /** Compact surfaces such as the token selector dropdown hide the sparkline. */
  showSparkline?: boolean;
} = {}): ITableColumn<IMarketStockPublicItem>[] {
  const intl = useIntl();

  return useMemo(() => {
    const { companyColumnWidth, metricColumnWidth } = getStockColumnWidths(
      showSparkline ? 5 : 4,
    );
    const columns: ITableColumn<IMarketStockPublicItem>[] = [
      {
        title: (
          <XStack alignItems="center" gap="$1.5">
            <SizableText
              width={24}
              textAlign="center"
              color="$textSubdued"
              size="$bodySmMedium"
            >
              #
            </SizableText>
            <SizableText color="$textSubdued" size="$bodySmMedium">
              Company
            </SizableText>
          </XStack>
        ),
        dataIndex: 'company',
        columnWidth: companyColumnWidth,
        columnProps: { flexShrink: 0, px: '$2' },
        render: (_: unknown, record: IMarketStockPublicItem) => (
          <XStack alignItems="center" gap="$1.5" minWidth={0}>
            <Stack width={24} alignItems="center" justifyContent="center">
              <Icon name="StarOutline" size="$4" color="$iconSubdued" />
            </Stack>
            <XStack flex={1} minWidth={0} alignItems="center" gap={14}>
              <Token
                size="lg"
                borderRadius="$full"
                tokenImageUri={record.logoUrl}
                fallbackIcon="CryptoCoinOutline"
              />
              <YStack flex={1} minWidth={0} justifyContent="center">
                <SizableText
                  size="$bodyLgMedium"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {record.symbol}
                </SizableText>
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {record.name}
                </SizableText>
              </YStack>
            </XStack>
          </XStack>
        ),
        renderSkeleton: () => (
          <XStack alignItems="center" gap={14}>
            <Skeleton width={24} height={16} />
            <Skeleton width={40} height={40} borderRadius="$full" />
            <YStack gap="$1">
              <Skeleton width={64} height={16} />
              <Skeleton width={96} height={14} />
            </YStack>
          </XStack>
        ),
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_price }),
        dataIndex: 'price',
        columnWidth: metricColumnWidth,
        columnProps: metricColumnProps,
        titleProps: { textDecorationLine: 'underline' },
        render: (_: unknown, record: IMarketStockPublicItem) => {
          const value = parseMarketStockNumber(record.price);
          return value === undefined ? (
            <MissingValue />
          ) : (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {value}
            </NumberSizeableText>
          );
        },
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.dexmarket_banner_token_24hchange,
        }),
        dataIndex: 'priceChange24hPercent',
        columnWidth: metricColumnWidth,
        columnProps: metricColumnProps,
        render: (_: unknown, record: IMarketStockPublicItem) => {
          const value = parseMarketStockNumber(record.priceChange24hPercent);
          if (value === undefined) {
            return <MissingValue />;
          }
          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange: value,
          });
          return (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="priceChange"
              color={changeColor}
              formatterOptions={{ showPlusMinusSigns }}
            >
              {value}
            </NumberSizeableText>
          );
        },
        renderSkeleton: () => <Skeleton width={64} height={16} />,
      },
      {
        title: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
        dataIndex: 'marketCap',
        columnWidth: metricColumnWidth,
        columnProps: metricColumnProps,
        render: (_: unknown, record: IMarketStockPublicItem) => {
          const value = parseMarketStockNumber(record.marketCap);
          return value === undefined ? (
            <MissingValue />
          ) : (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="marketCap"
              formatterOptions={{ currency: '$', capAtMaxT: true }}
            >
              {value}
            </NumberSizeableText>
          );
        },
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.dexmarket_stock_24h_volume,
        }),
        dataIndex: 'volume24h',
        columnWidth: metricColumnWidth,
        columnProps: metricColumnProps,
        render: (_: unknown, record: IMarketStockPublicItem) => {
          const value = parseMarketStockNumber(record.volume24h);
          return value === undefined ? (
            <MissingValue />
          ) : (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="marketCap"
              formatterOptions={{ currency: '$', capAtMaxT: true }}
            >
              {value}
            </NumberSizeableText>
          );
        },
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
    ];
    if (showSparkline) {
      columns.push({
        title: intl.formatMessage({
          id: ETranslations.market_24h_price_range,
        }),
        dataIndex: 'sparkline',
        columnWidth: metricColumnWidth,
        columnProps: metricColumnProps,
        render: (_: unknown, record: IMarketStockPublicItem) =>
          record.sparkline?.length ? (
            <StockSparkline
              data={record.sparkline}
              priceChange24hPercent={record.priceChange24hPercent}
            />
          ) : (
            <MissingValue />
          ),
        renderSkeleton: () => <Skeleton width={132} height={40} />,
      });
    }
    return columns;
  }, [intl, showSparkline]);
}
