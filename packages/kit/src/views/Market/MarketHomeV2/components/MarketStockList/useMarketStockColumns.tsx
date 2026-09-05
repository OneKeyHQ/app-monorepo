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
import type {
  ISizableTextProps,
  IStackProps,
  ITableColumn,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  MARKET_LIST_FIRST_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_TO_LOGO_GAP,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '../../../marketDesktopLayoutConstants';
import { MarketHoverRevealLine } from '../MarketHoverRevealLine';
import { MARKET_CELL_SUBTITLE_SIZE } from '../MarketListCell';
import { MarketVariantLogoGroup } from '../MarketVariantLogoGroup';

import { StockSparkline } from './StockSparkline';
import { parseMarketStockNumber } from './utils';

const EMPTY_VALUE = '--';

// `$bodyMd`'s line box: the company name and the variant summary share it so
// the hover slide lands cleanly on the second line.
const STOCK_SUBTITLE_LINE_HEIGHT = 20;
const COMPACT_COMPANY_COLUMN_PERCENTAGE = 32;

const COMPACT_METRIC_COLUMN_PROPS: IStackProps = {
  flexShrink: 0,
  px: '$2',
};

const FLEX_METRIC_COLUMN_PROPS: IStackProps = {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  px: '$2',
};

function getStockColumnWidths(
  metricColumnCount: number,
  compact: boolean,
): {
  companyColumnWidth: `${number}%` | number;
  metricColumnWidth: `${number}%`;
  metricColumnProps: IStackProps;
} {
  if (compact) {
    return {
      companyColumnWidth: `${COMPACT_COMPANY_COLUMN_PERCENTAGE}%`,
      metricColumnWidth: `${
        (100 - COMPACT_COMPANY_COLUMN_PERCENTAGE) / metricColumnCount
      }%`,
      metricColumnProps: COMPACT_METRIC_COLUMN_PROPS,
    };
  }
  // The design splits the row into a fixed 240 `Left Fixed` company column and
  // a `Right Flex` region the metric columns share evenly. `flexBasis: 0` makes
  // that split independent of each column's own content width.
  return {
    companyColumnWidth: MARKET_LIST_FIRST_COLUMN_WIDTH,
    metricColumnWidth: `${100 / metricColumnCount}%`,
    metricColumnProps: FLEX_METRIC_COLUMN_PROPS,
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
    const { companyColumnWidth, metricColumnWidth, metricColumnProps } =
      getStockColumnWidths(showSparkline ? 5 : 4, compact);
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
            gap={MARKET_LIST_STAR_SLOT_TO_LOGO_GAP}
          >
            <Stack
              width={MARKET_LIST_STAR_SLOT_WIDTH}
              alignItems="center"
              justifyContent="center"
            >
              <Icon name="StarOutline" size="$4" color="$iconSubdued" />
            </Stack>
            <XStack
              flex={1}
              minWidth={0}
              alignItems="center"
              gap={compact ? '$1.5' : 14}
            >
              <Token
                size={compact ? 'xs' : 'lg'}
                borderRadius="$full"
                tokenImageUri={record.logoUrl}
                fallbackIcon="CryptoCoinOutline"
              />
              <YStack flex={1} minWidth={0} justifyContent="center">
                <SizableText
                  size={compact ? '$bodySmMedium' : '$bodyLgMedium'}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {record.symbol}
                </SizableText>
                <MarketHoverRevealLine
                  lineHeight={STOCK_SUBTITLE_LINE_HEIGHT}
                  resting={
                    <SizableText
                      height={STOCK_SUBTITLE_LINE_HEIGHT}
                      size={compact ? '$bodySm' : MARKET_CELL_SUBTITLE_SIZE}
                      color="$textSubdued"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {record.name}
                    </SizableText>
                  }
                  revealed={
                    record.variants?.length && !compact ? (
                      <XStack
                        height={STOCK_SUBTITLE_LINE_HEIGHT}
                        alignItems="center"
                        gap="$1"
                        minWidth={0}
                      >
                        <SizableText
                          size={MARKET_CELL_SUBTITLE_SIZE}
                          color="$textSubdued"
                          numberOfLines={1}
                        >
                          {intl.formatMessage(
                            { id: ETranslations.market_number_tokens },
                            { number: record.variants.length },
                          )}
                        </SizableText>
                        <MarketVariantLogoGroup variants={record.variants} />
                      </XStack>
                    ) : undefined
                  }
                />
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
                // The header still sorts on press; the dashes and the tooltip
                // are the hover affordance, so the cursor stays a pointer.
                cursor="pointer"
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
