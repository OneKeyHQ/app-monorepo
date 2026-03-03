import { memo, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  Table,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketPerpsStarV2 } from '../../../components/MarketStarV2';
import { LeverageBadge, SubtitleBadge } from '../../../components/PerpsBadges';
import { useMarketBasicConfig } from '../../../hooks/useMarketBasicConfig';
import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';

import { useMarketPerpsTokenList } from './hooks/useMarketPerpsTokenList';
import { MarketPerpsCategorySelector } from './MarketPerpsCategorySelector';

import type { IMarketPerpsToken } from './hooks/useMarketPerpsTokenList';

function usePerpsColumnsDesktop(): ITableColumn<IMarketPerpsToken>[] {
  const intl = useIntl();
  const { gtLg } = useMedia();

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
          columnWidth: 200,
          render: (_: unknown, record: IMarketPerpsToken) => (
            <XStack alignItems="center" gap="$3">
              <Token
                size="md"
                borderRadius="$full"
                tokenImageUri={record.tokenImageUrl}
                fallbackIcon="CryptoCoinOutline"
              />
              <Stack flex={1} minWidth={0}>
                <XStack alignItems="center" gap="$1">
                  <SizableText
                    size="$bodyLgMedium"
                    numberOfLines={1}
                    maxWidth="$32"
                    userSelect="none"
                  >
                    {record.displayName}
                  </SizableText>
                  <LeverageBadge leverage={record.maxLeverage} />
                  {record.subtitle ? (
                    <SubtitleBadge subtitle={record.subtitle} />
                  ) : null}
                </XStack>
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

        // Column 2: Price
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

        // Column 3: 24h Change (absolute / percent)
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

        // Column 4: 24h Volume
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

        // Column 5: Open Interest
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

        // Column 6: Funding Rate (only on larger screens)
        gtLg
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
    [intl, gtLg],
  );
}

function usePerpsColumnsMobile(): ITableColumn<IMarketPerpsToken>[] {
  return useMemo(
    () => [
      // Column 1: Token info
      {
        title: 'Token',
        titleProps: { paddingBottom: '$2', paddingLeft: '$3' },
        dataIndex: 'tokenInfo',
        columnWidth: '50%',
        render: (_: unknown, record: IMarketPerpsToken) => (
          <XStack alignItems="center" gap="$3" ml="$3">
            <Token
              size="md"
              borderRadius="$full"
              tokenImageUri={record.tokenImageUrl}
              fallbackIcon="CryptoCoinOutline"
            />
            <YStack>
              <XStack alignItems="center" gap="$1">
                <SizableText
                  size="$bodyLgMedium"
                  numberOfLines={1}
                  maxWidth="$32"
                  userSelect="none"
                >
                  {record.displayName}
                </SizableText>
                <LeverageBadge leverage={record.maxLeverage} />
              </XStack>
              <NumberSizeableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
                formatter="marketCap"
                userSelect="none"
              >
                {record.volume24h ?? '0'}
              </NumberSizeableText>
            </YStack>
          </XStack>
        ),
        renderSkeleton: () => (
          <XStack alignItems="center" paddingLeft="$5" gap="$3">
            <Skeleton width={32} height={32} borderRadius="$full" />
            <YStack gap="$1">
              <Skeleton width={80} height={16} />
              <Skeleton width={60} height={12} />
            </YStack>
          </XStack>
        ),
      },
      // Column 2: Price + Change
      {
        title: 'Price / Change',
        titleProps: { paddingBottom: '$2', paddingRight: '$3' },
        dataIndex: 'price',
        columnWidth: '50%',
        align: 'right' as const,
        render: (_: unknown, record: IMarketPerpsToken) => {
          let changeColor = '$textSubdued';
          if (record.change24hPercent !== undefined) {
            changeColor =
              record.change24hPercent >= 0 ? '$textSuccess' : '$textCritical';
          }
          return (
            <XStack justifyContent="flex-end" alignItems="center" mr="$3">
              <YStack alignItems="flex-end">
                <NumberSizeableText
                  userSelect="none"
                  flexShrink={1}
                  numberOfLines={1}
                  size="$bodyLgMedium"
                  formatter="price"
                  formatterOptions={{ currency: '$' }}
                >
                  {record.markPrice ?? '0'}
                </NumberSizeableText>
                <NumberSizeableText
                  size="$bodyMd"
                  color={changeColor}
                  formatter="priceChange"
                  formatterOptions={{ showPlusMinusSigns: true }}
                >
                  {record.change24hPercent ?? 0}
                </NumberSizeableText>
              </YStack>
            </XStack>
          );
        },
        renderSkeleton: () => (
          <XStack
            justifyContent="flex-end"
            alignItems="center"
            paddingRight="$5"
          >
            <Skeleton width="$20" height="$8" borderRadius="$2" />
          </XStack>
        ),
      },
    ],
    [],
  );
}

function usePerpsColumns(): ITableColumn<IMarketPerpsToken>[] {
  const desktopColumns = usePerpsColumnsDesktop();
  const mobileColumns = usePerpsColumnsMobile();
  const media = useMedia();

  return useMemo(
    () => (media.gtMd ? desktopColumns : mobileColumns),
    [media.gtMd, desktopColumns, mobileColumns],
  );
}

type IMarketPerpsTokenListProps = {
  tabIntegrated?: boolean;
  listContainerProps?: {
    paddingBottom: number;
  };
};

function MarketPerpsTokenListImpl({
  tabIntegrated,
  listContainerProps,
}: IMarketPerpsTokenListProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const { navigateToPerps } = usePerpsNavigation();
  const intl = useIntl();
  const { md } = useMedia();

  const { perpsCategories } = useMarketBasicConfig();

  // Auto-select first category when categories load
  useEffect(() => {
    if (!selectedCategoryId && perpsCategories.length > 0) {
      setSelectedCategoryId(perpsCategories[0].categoryId);
    }
  }, [perpsCategories, selectedCategoryId]);

  const { tokens, isLoading, hasRealTimeData } = useMarketPerpsTokenList({
    selectedCategoryId,
  });

  const perpsColumns = usePerpsColumns();

  const handleTokenPress = navigateToPerps;

  const categoryTabs = useMemo(
    () =>
      perpsCategories.map((c) => ({
        tabId: c.categoryId,
        name: c.name,
      })),
    [perpsCategories],
  );

  const CategorySelector = useMemo(
    () => (
      <MarketPerpsCategorySelector
        categories={categoryTabs}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        containerStyle={{
          px: '$4',
          pt: '$3',
          pb: '$2',
        }}
      />
    ),
    [categoryTabs, selectedCategoryId],
  );

  const showSkeleton = Boolean(isLoading) && tokens.length === 0;

  const tabBarHeight = useScrollContentTabBarOffset();

  const TableEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [isLoading, intl]);

  return (
    <Stack flex={1} width="100%">
      {CategorySelector}
      <Stack
        flex={1}
        className="normal-scrollbar"
        style={{
          paddingTop: 4,
          overflowX: 'auto',
          ...(md ? { marginLeft: 8, marginRight: 8 } : {}),
        }}
      >
        <Stack flex={1} minHeight={platformEnv.isNative ? undefined : 400}>
          {showSkeleton ? (
            <Table.Skeleton
              columns={perpsColumns}
              count={20}
              rowProps={{ minHeight: '$14' }}
            />
          ) : (
            <Table<IMarketPerpsToken>
              contentContainerStyle={
                tabIntegrated
                  ? {
                      paddingTop: 8 + (platformEnv.isNative ? 150 : 0),
                      paddingBottom: platformEnv.isNativeAndroid
                        ? (listContainerProps?.paddingBottom ?? 104)
                        : tabBarHeight,
                    }
                  : {
                      paddingBottom: platformEnv.isNativeAndroid
                        ? 104
                        : tabBarHeight,
                    }
              }
              stickyHeader
              scrollEnabled={!tabIntegrated || platformEnv.isNative}
              columns={perpsColumns}
              dataSource={tokens}
              keyExtractor={(item) => item.name}
              estimatedItemSize="$14"
              extraData={hasRealTimeData}
              TableEmptyComponent={TableEmptyComponent}
              onRow={(item) => ({
                onPress: () => handleTokenPress(item.name),
              })}
            />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}

export const MarketPerpsTokenList = memo(MarketPerpsTokenListImpl);
export type { IMarketPerpsTokenListProps };
