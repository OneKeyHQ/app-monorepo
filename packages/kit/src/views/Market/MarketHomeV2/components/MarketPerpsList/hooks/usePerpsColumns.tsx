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
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
          columnWidth: 50,
          render: (_: unknown, record: IMarketPerpsToken) => (
            <Stack pl="$2">
              <MarketPerpsStarV2 perpsCoin={record.name} />
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
            <XStack alignItems="center" gap="$3" minWidth={0} overflow="hidden">
              <Token
                size="md"
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
          title: intl.formatMessage({
            id: ETranslations.dexmarket_turnover,
          }),
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
      ].filter(Boolean) as ITableColumn<IMarketPerpsToken>[],
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
