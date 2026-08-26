import { useMemo } from 'react';

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
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { StockSparkline } from './StockSparkline';
import { parseMarketStockNumber } from './utils';

const EMPTY_VALUE = '--';
const COMPANY_COLUMN_WIDTH = '19.736842105263158%';
const METRIC_COLUMN_WIDTH = '16.05263157894737%';

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

export function useMarketStockColumns(): ITableColumn<IMarketStockPublicItem>[] {
  return useMemo(
    () => [
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
        columnWidth: COMPANY_COLUMN_WIDTH,
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
        title: 'Price',
        dataIndex: 'price',
        columnWidth: METRIC_COLUMN_WIDTH,
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
        title: '24h Change',
        dataIndex: 'priceChange24hPercent',
        columnWidth: METRIC_COLUMN_WIDTH,
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
        title: 'MCap',
        dataIndex: 'marketCap',
        columnWidth: METRIC_COLUMN_WIDTH,
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
        title: '24h Volume',
        dataIndex: 'volume24h',
        columnWidth: METRIC_COLUMN_WIDTH,
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
      {
        title: '24h price range',
        dataIndex: 'sparkline',
        columnWidth: METRIC_COLUMN_WIDTH,
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
      },
    ],
    [],
  );
}
