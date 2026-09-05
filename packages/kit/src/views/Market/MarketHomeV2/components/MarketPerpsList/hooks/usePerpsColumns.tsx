import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { MarketPerpsStarV2 } from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import {
  LeverageBadge,
  PerpDexBadge,
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  MARKET_LIST_NAME_COLUMN_WIDTH,
  MARKET_LIST_STAR_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '@onekeyhq/kit/src/views/Market/marketDesktopLayoutConstants';
import {
  MARKET_CELL_PRIMARY_SIZE,
  MARKET_CELL_SUBTITLE_SIZE,
  MarketCellPrimary,
  MarketIdentityCell,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketListCell';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePerpsColumnsMobile } from './usePerpsColumnsMobile';

import type { IMarketPerpsToken } from './useMarketPerpsTokenList';

// The metric columns share the row's remaining width evenly, on the same 8px
// padding the other list pages use.
const METRIC_COLUMN_PROPS = {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  px: '$2',
} as const;

export function usePerpsColumnsDesktop(): ITableColumn<IMarketPerpsToken>[] {
  const intl = useIntl();

  return useMemo(
    () =>
      [
        // Column 1: Star (perps watchlist)
        {
          title: (
            <SizableText
              width={MARKET_LIST_STAR_SLOT_WIDTH}
              textAlign="center"
              size="$bodySmMedium"
              color="$textSubdued"
            >
              #
            </SizableText>
          ) as any,
          dataIndex: 'star',
          // The shared first-column frame: same star slot and 240px total as
          // the other list pages.
          columnProps: { flexShrink: 0, pl: '$2', pr: 0 },
          columnWidth: MARKET_LIST_STAR_COLUMN_WIDTH,
          render: (_: unknown, record: IMarketPerpsToken) => (
            <Stack
              width={MARKET_LIST_STAR_SLOT_WIDTH}
              alignItems="center"
              justifyContent="center"
            >
              <MarketPerpsStarV2
                perpsCoin={record.name}
                size="small"
                customIconSize="$4"
              />
            </Stack>
          ),
          renderSkeleton: () => (
            <Skeleton width={24} height={24} borderRadius="$full" />
          ),
        },

        // Column 2: Token Name
        {
          title: intl.formatMessage({ id: ETranslations.global_name }),
          dataIndex: 'name',
          columnProps: { flexShrink: 0, pl: 0, pr: '$2' },
          columnWidth: MARKET_LIST_NAME_COLUMN_WIDTH,
          render: (_: unknown, record: IMarketPerpsToken) => (
            <MarketIdentityCell
              logo={
                <Token
                  size="lg"
                  borderRadius="$full"
                  tokenImageUri={record.tokenImageUrl}
                  fallbackIcon="CryptoCoinOutline"
                />
              }
              primary={
                <XStack alignItems="center" gap="$1" minWidth={0}>
                  <MarketCellPrimary flexShrink={1} userSelect="none">
                    {record.displayName}
                  </MarketCellPrimary>
                  <LeverageBadge leverage={record.maxLeverage} />
                  <PerpDexBadge dexLabel={record.dexLabel} />
                </XStack>
              }
              secondary={
                record.subtitle ? (
                  // The list tables run their subtitle at the row's own
                  // secondary size rather than the badge default.
                  <SubtitleText
                    subtitle={record.subtitle}
                    size={MARKET_CELL_SUBTITLE_SIZE}
                  />
                ) : null
              }
            />
          ),
          renderSkeleton: () => (
            <XStack alignItems="center" gap="$3">
              <XStack position="relative">
                <Skeleton width={32} height={32} borderRadius="$full" />
              </XStack>
              <YStack gap="$1">
                <Skeleton width={80} height={16} />
                <Skeleton width={60} height={12} />
              </YStack>
            </XStack>
          ),
        },

        // Column 3: Price
        {
          title: intl.formatMessage({ id: ETranslations.global_price }),
          dataIndex: 'price',
          columnProps: METRIC_COLUMN_PROPS,
          render: (_: unknown, record: IMarketPerpsToken) => (
            <NumberSizeableText
              size={MARKET_CELL_PRIMARY_SIZE}
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {record.markPrice ?? '--'}
            </NumberSizeableText>
          ),
          renderSkeleton: () => <Skeleton width={70} height={16} />,
        },

        // Column 4: 24h Change (absolute / percent)
        {
          title: intl.formatMessage({
            id: ETranslations.perp_token_selector_24h_change,
          }),
          dataIndex: 'change24h',
          columnProps: METRIC_COLUMN_PROPS,
          render: (_: unknown, record: IMarketPerpsToken) => {
            if (
              record.change24hPercent === undefined ||
              !record.markPrice ||
              !record.prevDayPrice
            ) {
              return (
                <SizableText
                  size={MARKET_CELL_PRIMARY_SIZE}
                  color="$textSubdued"
                >
                  --
                </SizableText>
              );
            }
            const absChange =
              Number(record.markPrice) - Number(record.prevDayPrice);
            const color =
              record.change24hPercent >= 0 ? '$textSuccess' : '$textCritical';
            return (
              <XStack gap="$1" alignItems="center">
                <NumberSizeableText
                  size={MARKET_CELL_PRIMARY_SIZE}
                  color={color}
                  formatter="price"
                  formatterOptions={{
                    showPlusMinusSigns: true,
                    currency: '',
                  }}
                >
                  {absChange}
                </NumberSizeableText>
                <SizableText size={MARKET_CELL_PRIMARY_SIZE} color={color}>
                  /
                </SizableText>
                <NumberSizeableText
                  size={MARKET_CELL_PRIMARY_SIZE}
                  color={color}
                  formatter="priceChange"
                  formatterOptions={{ showPlusMinusSigns: true }}
                >
                  {record.change24hPercent}
                </NumberSizeableText>
              </XStack>
            );
          },
          renderSkeleton: () => <Skeleton width={100} height={16} />,
        },

        // Column 5: Funding
        {
          title: intl.formatMessage({
            id: ETranslations.perp_position_funding,
          }),
          dataIndex: 'fundingRate',
          columnProps: METRIC_COLUMN_PROPS,
          render: (_: unknown, record: IMarketPerpsToken) => {
            if (record.fundingRate === undefined) {
              return (
                <SizableText
                  size={MARKET_CELL_PRIMARY_SIZE}
                  color="$textSubdued"
                >
                  --
                </SizableText>
              );
            }
            const rate = Number(record.fundingRate) * 100;
            return (
              <SizableText
                size={MARKET_CELL_PRIMARY_SIZE}
                color={rate >= 0 ? '$textSuccess' : '$textCritical'}
              >
                {`${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%`}
              </SizableText>
            );
          },
          renderSkeleton: () => <Skeleton width={60} height={16} />,
        },

        // Column 6: 24h Volume
        {
          title: intl.formatMessage({
            id: ETranslations.dexmarket_stock_24h_volume,
          }),
          dataIndex: 'volume24h',
          columnProps: METRIC_COLUMN_PROPS,
          render: (_: unknown, record: IMarketPerpsToken) => (
            <NumberSizeableText
              size={MARKET_CELL_PRIMARY_SIZE}
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {record.volume24h ?? '--'}
            </NumberSizeableText>
          ),
          renderSkeleton: () => <Skeleton width={80} height={16} />,
        },

        // Column 7: Open Interest
        {
          title: intl.formatMessage({
            id: ETranslations.perp_token_bar_open_Interest,
          }),
          dataIndex: 'openInterest',
          columnProps: METRIC_COLUMN_PROPS,
          render: (_: unknown, record: IMarketPerpsToken) => (
            <NumberSizeableText
              size={MARKET_CELL_PRIMARY_SIZE}
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {record.openInterest ?? '--'}
            </NumberSizeableText>
          ),
          renderSkeleton: () => <Skeleton width={80} height={16} />,
        },
      ].filter(Boolean) as ITableColumn<IMarketPerpsToken>[],
    [intl],
  );
}

export function usePerpsColumns(): ITableColumn<IMarketPerpsToken>[] {
  const desktopColumns = usePerpsColumnsDesktop();
  const mobileColumns = usePerpsColumnsMobile();
  const media = useMedia();

  return useMemo(
    () => (media.gtMd ? desktopColumns : mobileColumns),
    [media.gtMd, desktopColumns, mobileColumns],
  );
}
