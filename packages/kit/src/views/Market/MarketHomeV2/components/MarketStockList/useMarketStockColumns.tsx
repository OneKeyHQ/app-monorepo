import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ISizableTextProps, ITableColumn } from '@onekeyhq/components';
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
const COMPACT_COMPANY_COLUMN_PERCENTAGE = 32;

function getStockColumnWidths(
  metricColumnCount: number,
  compact: boolean,
): {
  companyColumnWidth: `${number}%`;
  metricColumnWidth: `${number}%`;
} {
  if (compact) {
    return {
      companyColumnWidth: `${COMPACT_COMPANY_COLUMN_PERCENTAGE}%`,
      metricColumnWidth: `${
        (100 - COMPACT_COMPANY_COLUMN_PERCENTAGE) / metricColumnCount
      }%`,
    };
  }
  const totalUnits =
    COMPANY_COLUMN_UNITS + METRIC_COLUMN_UNITS * metricColumnCount;
  return {
    companyColumnWidth: `${(COMPANY_COLUMN_UNITS / totalUnits) * 100}%`,
    metricColumnWidth: `${(METRIC_COLUMN_UNITS / totalUnits) * 100}%`,
  };
}

function MissingValue({
  size = '$bodyMd',
}: {
  size?: ISizableTextProps['size'];
}) {
  return (
    <SizableText size={size} color="$textSubdued">
      {EMPTY_VALUE}
    </SizableText>
  );
}

const metricColumnProps = {
  flexShrink: 0,
  px: '$2',
} as const;

export function useMarketStockColumns({
  compact = false,
  showSparkline = true,
}: {
  /** Use the selector layout with a wider company column and denser rows. */
  compact?: boolean;
  /** Compact surfaces such as the token selector dropdown hide the sparkline. */
  showSparkline?: boolean;
} = {}): ITableColumn<IMarketStockPublicItem>[] {
  const intl = useIntl();

  return useMemo(() => {
    const { companyColumnWidth, metricColumnWidth } = getStockColumnWidths(
      showSparkline ? 5 : 4,
      compact,
    );
    const metricTextSize = compact ? '$bodyMdMedium' : '$bodyLgMedium';
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
              {intl.formatMessage({ id: ETranslations.market_stock_company })}
            </SizableText>
          </XStack>
        ),
        dataIndex: 'company',
        columnWidth: companyColumnWidth,
        columnProps: { flexShrink: 0, px: '$2' },
        render: (_: unknown, record: IMarketStockPublicItem) => (
          <XStack
            width="100%"
            minWidth={0}
            overflow="hidden"
            alignItems="center"
            gap="$1.5"
          >
            {/* Decorative for now — the public stocks payload carries no
                chainId/contractAddress, so the watchlist cannot identify a
                stock yet. The 24px box centers the star under the header's
                24px "#" cell and starts the logo where "Company" starts. */}
            <Stack width={24} alignItems="center" justifyContent="center">
              <Icon name="StarOutline" size="$4" color="$iconSubdued" />
            </Stack>
            <XStack
              flex={1}
              minWidth={0}
              alignItems="center"
              gap={compact ? '$2.5' : 14}
            >
              <Token
                size={compact ? 'md' : 'lg'}
                borderRadius="$full"
                tokenImageUri={record.logoUrl}
                fallbackIcon="CryptoCoinOutline"
              />
              <YStack
                flex={1}
                minWidth={0}
                gap={compact ? '$0.5' : undefined}
                justifyContent="center"
              >
                <SizableText
                  size={compact ? '$bodyMdMedium' : '$bodyLgMedium'}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {record.symbol}
                </SizableText>
                <SizableText
                  size={compact ? '$bodySm' : '$bodyMd'}
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
          <XStack alignItems="center" gap={compact ? '$1.5' : 14}>
            <Skeleton width={24} height={16} />
            <Skeleton
              width={compact ? 20 : 40}
              height={compact ? 20 : 40}
              borderRadius="$full"
            />
            <YStack gap="$1">
              <Skeleton width={64} height={16} />
              <Skeleton width={96} height={14} />
            </YStack>
          </XStack>
        ),
      },
      {
        title: compact ? (
          <Tooltip
            renderTrigger={
              <DashText
                size="$bodySm"
                dashThickness={0.5}
                dashSpacing={0}
                color="$textSubdued"
                cursor="help"
              >
                {intl.formatMessage({ id: ETranslations.global_price })}
              </DashText>
            }
            renderContent={
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.market_stock_price_underlying_tooltip,
                })}
              </SizableText>
            }
            placement="top"
          />
        ) : (
          intl.formatMessage({ id: ETranslations.global_price })
        ),
        dataIndex: 'price',
        columnWidth: metricColumnWidth,
        columnProps: metricColumnProps,
        titleProps: compact ? undefined : { textDecorationLine: 'underline' },
        render: (_: unknown, record: IMarketStockPublicItem) => {
          const value = parseMarketStockNumber(record.price);
          return value === undefined ? (
            <MissingValue size={metricTextSize} />
          ) : (
            <NumberSizeableText
              size={metricTextSize}
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
            return <MissingValue size={metricTextSize} />;
          }
          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange: value,
          });
          return (
            <NumberSizeableText
              size={metricTextSize}
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
            <MissingValue size={metricTextSize} />
          ) : (
            <NumberSizeableText
              size={metricTextSize}
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
            <MissingValue size={metricTextSize} />
          ) : (
            <NumberSizeableText
              size={metricTextSize}
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
  }, [compact, intl, showSparkline]);
}
