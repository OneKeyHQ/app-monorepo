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

import {
  MARKET_LIST_STAR_SLOT_TO_LOGO_GAP,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '../../../marketDesktopLayoutConstants';

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
  /**
   * Use the selector layout: a wider company column and denser metric columns.
   * The company cell itself stays identical to the full Stocks table so the
   * dropdown reads as the same list.
   */
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
          <XStack alignItems="center" gap={MARKET_LIST_STAR_SLOT_TO_LOGO_GAP}>
            <SizableText
              width={MARKET_LIST_STAR_SLOT_WIDTH}
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
          <XStack
            width="100%"
            minWidth={0}
            overflow="hidden"
            alignItems="center"
            // Star-slot to logo distance shared with Trending and Top coins.
            gap={MARKET_LIST_STAR_SLOT_TO_LOGO_GAP}
          >
            {/* Not a `MarketStarV2`: the stock list payload carries no
                chain/contract pair, and the V2 watchlist is keyed by one, so
                there is nothing to favorite yet. Plain icon until the list
                endpoint returns a tokenized variant to watch. */}
            <Stack
              width={MARKET_LIST_STAR_SLOT_WIDTH}
              alignItems="center"
              justifyContent="center"
            >
              <Icon name="StarOutline" size="$4" color="$iconSubdued" />
            </Stack>
            {/* The company cell keeps the full Stocks table presentation on
                every surface: `compact` only affects column widths and the
                metric columns. */}
            <XStack flex={1} minWidth={0} alignItems="center" gap={14}>
              {/* Stock logos are often white artwork on a transparent
                  background (QQQ, SPY), which vanishes against the `$bgApp`
                  default this component uses in the light theme. */}
              <Token
                size="lg"
                borderRadius="$full"
                bg="$bgStrong"
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
        title: (
          <Tooltip
            renderTrigger={
              <DashText
                size="$bodySmMedium"
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
                The displayed price is the underlying stock price.
              </SizableText>
            }
            placement="top"
          />
        ),
        dataIndex: 'price',
        columnWidth: metricColumnWidth,
        columnProps: metricColumnProps,
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
