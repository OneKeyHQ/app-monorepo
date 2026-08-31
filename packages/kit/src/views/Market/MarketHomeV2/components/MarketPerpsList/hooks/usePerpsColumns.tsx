import { useMemo } from 'react';
import type { ReactNode } from 'react';

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
import type {
  ITableColumn,
  ITableColumnSortContext,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { MarketPerpsStarV2 } from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import {
  LeverageBadge,
  PerpDexBadge,
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  REDESIGN_NAME_ICON_GAP,
  REDESIGN_STAR_COLUMN_WIDTH,
  REDESIGN_STAR_ICON_SIZE,
  renderRedesignHeaderTitle,
} from '../../marketListRedesignVisuals';

import { usePerpsColumnsMobile } from './usePerpsColumnsMobile';

import type { IMarketPerpsToken } from './useMarketPerpsTokenList';

export function usePerpsColumnsDesktop(): ITableColumn<IMarketPerpsToken>[] {
  const intl = useIntl();
  const { gtXl } = useMedia();

  return useMemo(
    () =>
      [
        // Column 1: Star (perps watchlist)
        {
          title: (
            <SizableText pl="$3.5" size="$bodyMd" color="$textSubdued">
              #
            </SizableText>
          ) as any,
          dataIndex: 'star',
          columnWidth: REDESIGN_STAR_COLUMN_WIDTH,
          render: (_: unknown, record: IMarketPerpsToken) => (
            <Stack pl="$3">
              <MarketPerpsStarV2
                perpsCoin={record.name}
                size="small"
                customIconSize={REDESIGN_STAR_ICON_SIZE}
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
          columnWidth: gtXl ? 340 : 260,
          render: (_: unknown, record: IMarketPerpsToken) => (
            <XStack
              alignItems="center"
              gap={REDESIGN_NAME_ICON_GAP}
              minWidth={0}
              overflow="hidden"
            >
              <Token
                size="lg"
                borderRadius="$full"
                tokenImageUri={record.tokenImageUrl}
                fallbackIcon="CryptoCoinOutline"
              />
              <Stack flex={1} minWidth={0}>
                <XStack alignItems="center" gap="$1" minWidth={0}>
                  <SizableText
                    size="$bodyLgMedium"
                    numberOfLines={1}
                    maxWidth="$32"
                    flexShrink={1}
                    ellipsizeMode="tail"
                    userSelect="none"
                  >
                    {record.displayName}
                  </SizableText>
                  <LeverageBadge leverage={record.maxLeverage} />
                  <PerpDexBadge dexLabel={record.dexLabel} />
                </XStack>
                {record.subtitle ? (
                  <SubtitleText subtitle={record.subtitle} />
                ) : null}
              </Stack>
            </XStack>
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
          columnProps: { flex: 1 },
          render: (_: unknown, record: IMarketPerpsToken) => (
            <NumberSizeableText
              size="$bodyMd"
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
          title: `${intl.formatMessage({
            id: ETranslations.dexmarket_token_change,
          })}(%)`,
          dataIndex: 'change24h',
          columnProps: { flex: 1.2 },
          render: (_: unknown, record: IMarketPerpsToken) => {
            if (
              record.change24hPercent === undefined ||
              !record.markPrice ||
              !record.prevDayPrice
            ) {
              return (
                <SizableText size="$bodyMd" color="$textSubdued">
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
                  size="$bodyMd"
                  color={color}
                  formatter="price"
                  formatterOptions={{
                    showPlusMinusSigns: true,
                    currency: '',
                  }}
                >
                  {absChange}
                </NumberSizeableText>
                <SizableText size="$bodyMd" color={color}>
                  /
                </SizableText>
                <NumberSizeableText
                  size="$bodyMd"
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

        // Column 5: 24h Volume
        {
          title: `24h ${intl.formatMessage({
            id: ETranslations.perp_token_selector_volume,
          })}`,
          dataIndex: 'volume24h',
          columnProps: { flex: 1 },
          render: (_: unknown, record: IMarketPerpsToken) => (
            <NumberSizeableText
              size="$bodyMd"
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {record.volume24h ?? '--'}
            </NumberSizeableText>
          ),
          renderSkeleton: () => <Skeleton width={80} height={16} />,
        },

        // Column 6: Open Interest
        {
          title: intl.formatMessage({
            id: ETranslations.perp_token_bar_open_Interest,
          }),
          dataIndex: 'openInterest',
          columnProps: { flex: 1 },
          render: (_: unknown, record: IMarketPerpsToken) => (
            <NumberSizeableText
              size="$bodyMd"
              formatter="marketCap"
              formatterOptions={{ currency: '$' }}
            >
              {record.openInterest ?? '--'}
            </NumberSizeableText>
          ),
          renderSkeleton: () => <Skeleton width={80} height={16} />,
        },

        // Column 7: Funding Rate (only on larger screens)
        gtXl
          ? {
              title: intl.formatMessage({
                id: ETranslations.perp_position_funding,
              }),
              dataIndex: 'fundingRate',
              columnProps: { flex: 0.8 },
              render: (_: unknown, record: IMarketPerpsToken) => {
                if (record.fundingRate === undefined) {
                  return (
                    <SizableText size="$bodyMd" color="$textSubdued">
                      --
                    </SizableText>
                  );
                }
                const rate = Number(record.fundingRate) * 100;
                return (
                  <SizableText
                    size="$bodyMd"
                    color={rate >= 0 ? '$textSuccess' : '$textCritical'}
                  >
                    {`${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%`}
                  </SizableText>
                );
              },
              renderSkeleton: () => <Skeleton width={60} height={16} />,
            }
          : undefined,
      ]
        .filter(Boolean)
        .map((column) => {
          const typed = column as ITableColumn<IMarketPerpsToken>;
          // Same header chrome as the spot lists. Perps has no sorting, so
          // sortContext carries no onSortPress and no glyph is drawn.
          if (
            String(typed.dataIndex) === 'star' ||
            typeof typed.title !== 'string'
          ) {
            return typed;
          }
          const label = typed.title;
          return {
            ...typed,
            renderTitle: (
              _sortIcon: ReactNode,
              sortContext: ITableColumnSortContext,
            ) => renderRedesignHeaderTitle({ label, sortContext }),
          };
        }) as ITableColumn<IMarketPerpsToken>[],
    [intl, gtXl],
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
