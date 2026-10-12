import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
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
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  MARKET_LIST_FIRST_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_TO_LOGO_GAP,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '../../../marketDesktopLayoutConstants';
import { MarketHoverRevealLine } from '../MarketHoverRevealLine';
import {
  MARKET_CELL_SUBTITLE_LINE_HEIGHT,
  MARKET_CELL_SUBTITLE_SIZE,
} from '../MarketListCell';
import { MarketVariantLogoGroup } from '../MarketVariantLogoGroup';

import { MarketStockStar } from './MarketStockStar';
import { StockSparkline } from './StockSparkline';
import { parseMarketStockNumber } from './utils';

const EMPTY_VALUE = '--';

// The selector dropdown's `Left Fixed` company column (Figma 27032:41642),
// matching the selector's token tabs so every tab lines up. The metric columns
// share the rest evenly, like the full table.
const COMPACT_COMPANY_COLUMN_WIDTH = 288;
// `$bodySm`'s line box, the compact subtitle line.
const COMPACT_SUBTITLE_LINE_HEIGHT = 16;

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
  companyColumnWidth: number;
  metricColumnWidth: `${number}%`;
  metricColumnProps: IStackProps;
} {
  // The design splits the row into a fixed `Left Fixed` company column and a
  // `Right Flex` region the metric columns share evenly. `flexBasis: 0` makes
  // that split independent of each column's own content width.
  return {
    companyColumnWidth: compact
      ? COMPACT_COMPANY_COLUMN_WIDTH
      : MARKET_LIST_FIRST_COLUMN_WIDTH,
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

// The company name line, led by the listing market badges when requested.
// Badges share the line so they slide away with the name on hover.
function renderCompanySubtitle({
  record,
  compact,
  showMarketTags,
}: {
  record: IMarketStockPublicItem;
  compact: boolean;
  showMarketTags: boolean;
}) {
  const marketTags = showMarketTags ? (record.tags?.filter(Boolean) ?? []) : [];
  const hasMarketTags = marketTags.length > 0;
  const lineHeight = compact
    ? COMPACT_SUBTITLE_LINE_HEIGHT
    : MARKET_CELL_SUBTITLE_LINE_HEIGHT;
  const companyName = (
    <SizableText
      // Beside the badges the row centers the name instead: a fixed height
      // would pin the compact 16px line to the top of the 20px row and leave
      // the name sitting above the badge.
      height={hasMarketTags ? undefined : lineHeight}
      size={compact ? '$bodySm' : MARKET_CELL_SUBTITLE_SIZE}
      color="$textSubdued"
      numberOfLines={1}
      ellipsizeMode="tail"
      flexShrink={hasMarketTags ? 1 : undefined}
    >
      {record.name}
    </SizableText>
  );
  if (!hasMarketTags) {
    return companyName;
  }
  return (
    <XStack
      height={lineHeight}
      alignItems="center"
      gap={compact ? '$1.5' : '$1'}
      minWidth={0}
    >
      {marketTags.map((tag) => (
        <Badge
          key={tag}
          badgeType="default"
          badgeSize="sm"
          px="$1"
          py="$0.5"
          flexShrink={0}
        >
          {/* The design sets 11/12, tighter than the token's 14 line height. */}
          <Badge.Text size="$bodyXs" lineHeight={12}>
            {tag}
          </Badge.Text>
        </Badge>
      ))}
      {companyName}
    </XStack>
  );
}

export function useMarketStockColumns({
  compact = false,
  showSparkline = true,
  showWatchlist = false,
  showMarketTags = false,
  watchlistFrom = EWatchlistFrom.Homepage,
}: {
  /** Use the selector layout with a wider company column and denser rows. */
  compact?: boolean;
  /** Compact surfaces such as the token selector dropdown hide the sparkline. */
  showSparkline?: boolean;
  showWatchlist?: boolean;
  /** Show the listing market badges (US / HK) before the company name. */
  showMarketTags?: boolean;
  watchlistFrom?: EWatchlistFrom;
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
            gap={MARKET_LIST_STAR_SLOT_TO_LOGO_GAP}
          >
            <Stack
              width={MARKET_LIST_STAR_SLOT_WIDTH}
              alignItems="center"
              justifyContent="center"
            >
              {showWatchlist ? (
                <MarketStockStar stock={record} from={watchlistFrom} />
              ) : (
                <Icon name="StarOutline" size="$4" color="$iconSubdued" />
              )}
            </Stack>
            <XStack
              flex={1}
              minWidth={0}
              alignItems="center"
              gap={compact ? '$3' : 14}
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
                gap={compact ? '$1' : undefined}
                justifyContent="center"
              >
                <SizableText
                  size={compact ? '$headingSm' : '$bodyLgMedium'}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {record.symbol}
                </SizableText>
                <MarketHoverRevealLine
                  lineHeight={
                    compact
                      ? COMPACT_SUBTITLE_LINE_HEIGHT
                      : MARKET_CELL_SUBTITLE_LINE_HEIGHT
                  }
                  resting={renderCompanySubtitle({
                    record,
                    compact,
                    showMarketTags,
                  })}
                  revealed={
                    record.variants?.length && !compact ? (
                      <XStack
                        height={MARKET_CELL_SUBTITLE_LINE_HEIGHT}
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
        title: intl.formatMessage({ id: ETranslations.global_price }),
        // The header sorts on press, so the tooltip is built by HeaderColumn
        // rather than nested in the title: a trigger in there would swallow
        // the click.
        titleTooltip: intl.formatMessage({
          id: ETranslations.market_stock_price_underlying_tooltip,
        }),
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
          id: ETranslations.market_stock_change__title,
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
              formatter="priceChangeCapped"
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
          id: ETranslations.market_stock_volume__title,
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
          id: ETranslations.market_stock_day_range__title,
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
  }, [
    compact,
    intl,
    showMarketTags,
    showSparkline,
    showWatchlist,
    watchlistFrom,
  ]);
}
