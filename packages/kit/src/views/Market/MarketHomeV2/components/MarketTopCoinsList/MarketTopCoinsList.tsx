import { useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  Icon,
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
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { PriceChangePercentage } from '../../../components/PriceChangePercentage';
import SparklineChart from '../../../components/SparklineChart';
import { MARKET_DESKTOP_CONTENT_FRAME_PROPS } from '../../../marketDesktopLayoutConstants';
import { DesktopStickyHeaderContext } from '../../layouts/DesktopStickyHeaderContext';
import { StickyHeaderPortal } from '../StickyHeaderPortal';

import { useMarketTopCoins } from './hooks/useMarketTopCoins';

type IMarketTopCoinsListProps = {
  tabIntegrated?: boolean;
  tabName?: string;
  listContainerProps?: {
    paddingBottom: number;
  };
};

const TOP_COINS_DESKTOP_ROW_HEIGHT = 72;
const TOP_COINS_SPARKLINE_WIDTH = 132;
const TOP_COINS_SPARKLINE_HEIGHT = 44;
const TOP_COINS_SPARKLINE_COLORS = {
  dark: {
    positive: ['rgba(70, 254, 165, 1)', 'rgba(70, 254, 165, 0.2)'],
    negative: ['rgba(255, 149, 146, 1)', 'rgba(255, 149, 146, 0.2)'],
  },
  light: {
    positive: ['rgba(0, 113, 63, 1)', 'rgba(0, 113, 63, 0.2)'],
    negative: ['rgba(196, 0, 6, 1)', 'rgba(196, 0, 6, 0.2)'],
  },
} as const;

const TOP_COINS_SORTABLE_COLUMN_KEYS = [
  'price',
  'priceChange24hPercent',
  'priceChange7dPercent',
  'marketCap',
  'volume24h',
] as const;

type ITopCoinsSortableColumn = (typeof TOP_COINS_SORTABLE_COLUMN_KEYS)[number];

function isTopCoinsSortableColumn(
  column: string,
): column is ITopCoinsSortableColumn {
  return TOP_COINS_SORTABLE_COLUMN_KEYS.some((item) => item === column);
}

function MissingValue() {
  return (
    <SizableText size="$bodyMd" color="$textSubdued">
      --
    </SizableText>
  );
}

function MarketValue({
  value,
  formatter,
}: {
  value: string | undefined;
  formatter: 'marketCap' | 'price';
}) {
  if (value === undefined || !Number.isFinite(Number(value))) {
    return <MissingValue />;
  }

  return (
    <NumberSizeableText
      size="$bodyLgMedium"
      formatter={formatter}
      formatterOptions={{ currency: '$', capAtMaxT: true }}
    >
      {value}
    </NumberSizeableText>
  );
}

function useTopCoinsColumns(): ITableColumn<IMarketAssetListItem>[] {
  const intl = useIntl();
  const { gt2xl } = useMedia();
  const themeVariant = useThemeVariant();

  return useMemo(() => {
    const metricColumnProps = {
      flexGrow: 1,
      flexBasis: 0,
      px: '$2',
    } as const;
    const columns: (ITableColumn<IMarketAssetListItem> | undefined)[] = [
      {
        title: '#',
        dataIndex: 'star',
        columnWidth: 48,
        columnProps: { flexShrink: 0, px: '$2' },
        render: () => (
          <Icon name="StarOutline" size="$5" color="$iconSubdued" />
        ),
        renderSkeleton: () => (
          <Skeleton width={24} height={24} borderRadius="$full" />
        ),
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_name }),
        dataIndex: 'name',
        columnWidth: 220,
        columnProps: { flexShrink: 0, px: '$2' },
        render: (_: unknown, record: IMarketAssetListItem) => (
          <XStack alignItems="center" gap={14} minWidth={0}>
            <Token
              size="lg"
              borderRadius="$full"
              tokenImageUri={record.logoUrl}
              fallbackIcon="CryptoCoinOutline"
            />
            <XStack alignItems="center" gap="$2" minWidth={0}>
              <SizableText
                size="$bodyLgMedium"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {record.symbol.toUpperCase()}
              </SizableText>
            </XStack>
          </XStack>
        ),
        renderSkeleton: () => (
          <XStack alignItems="center" gap={14}>
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
        columnProps: metricColumnProps,
        render: (value: string) => (
          <MarketValue value={value} formatter="price" />
        ),
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.perp_token_selector_24h_change,
        }),
        dataIndex: 'priceChange24hPercent',
        columnProps: metricColumnProps,
        render: (value: string) => (
          <PriceChangePercentage size="$bodyLgMedium">
            {value}
          </PriceChangePercentage>
        ),
        renderSkeleton: () => <Skeleton width={64} height={16} />,
      },
      gt2xl
        ? {
            title: intl.formatMessage({ id: ETranslations.market_change_7d }),
            dataIndex: 'priceChange7dPercent',
            columnProps: metricColumnProps,
            render: (value: string) => (
              <PriceChangePercentage size="$bodyLgMedium">
                {value}
              </PriceChangePercentage>
            ),
            renderSkeleton: () => <Skeleton width={64} height={16} />,
          }
        : undefined,
      {
        title: intl.formatMessage({ id: ETranslations.market_mcap_short }),
        dataIndex: 'marketCap',
        columnProps: metricColumnProps,
        render: (value: string) => (
          <MarketValue value={value} formatter="marketCap" />
        ),
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.dexmarket_stock_24h_volume,
        }),
        dataIndex: 'volume24h',
        columnProps: metricColumnProps,
        render: (value: string) => (
          <MarketValue value={value} formatter="marketCap" />
        ),
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      gt2xl
        ? {
            title: intl.formatMessage({
              id: ETranslations.market_24h_price_range,
            }),
            dataIndex: 'sparkline24h',
            columnProps: {
              ...metricColumnProps,
              minWidth: TOP_COINS_SPARKLINE_WIDTH,
            },
            render: (
              sparkline: IMarketAssetListItem['sparkline24h'],
              record: IMarketAssetListItem,
            ) => {
              if (!sparkline || sparkline.length < 2) {
                return <MissingValue />;
              }
              const isNegative = Number(record.priceChange24hPercent) < 0;
              const themeColors =
                TOP_COINS_SPARKLINE_COLORS[
                  themeVariant === 'dark' ? 'dark' : 'light'
                ];
              const [lineColor, gradientColor] = isNegative
                ? themeColors.negative
                : themeColors.positive;

              return (
                <SparklineChart
                  data={sparkline.slice(-24)}
                  width={TOP_COINS_SPARKLINE_WIDTH}
                  height={TOP_COINS_SPARKLINE_HEIGHT}
                  lineColor={lineColor}
                  linearGradientColor={gradientColor}
                />
              );
            },
            renderSkeleton: () => (
              <Skeleton
                width={TOP_COINS_SPARKLINE_WIDTH}
                height={TOP_COINS_SPARKLINE_HEIGHT}
              />
            ),
          }
        : undefined,
    ];

    return columns.filter(
      (column): column is ITableColumn<IMarketAssetListItem> => Boolean(column),
    );
  }, [gt2xl, intl, themeVariant]);
}

export function MarketTopCoinsList({
  tabIntegrated,
  tabName,
  listContainerProps,
}: IMarketTopCoinsListProps) {
  const { data, handleItemPress, isLoading } = useMarketTopCoins();
  const columns = useTopCoinsColumns();
  const stickyHeaderContext = useContext(DesktopStickyHeaderContext);
  const tabBarHeight = useScrollContentTabBarOffset();
  const [sortState, setSortState] = useState<
    | {
        column: ITopCoinsSortableColumn;
        order: 'asc' | 'desc';
      }
    | undefined
  >();
  const sortedData = useMemo(() => {
    if (!sortState) {
      return data;
    }
    const { column, order } = sortState;
    return data.toSorted((left, right) => {
      const leftValue = Number(left[column]);
      const rightValue = Number(right[column]);
      if (!Number.isFinite(leftValue)) {
        return Number.isFinite(rightValue) ? 1 : 0;
      }
      if (!Number.isFinite(rightValue)) {
        return -1;
      }
      const difference = leftValue - rightValue;
      return order === 'asc' ? difference : -difference;
    });
  }, [data, sortState]);

  const onHeaderRow = useCallback(
    (column: ITableColumn<IMarketAssetListItem>) => {
      if (!isTopCoinsSortableColumn(column.dataIndex)) {
        return undefined;
      }
      const sortableColumn = column.dataIndex;
      return {
        onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
          setSortState(
            order
              ? {
                  column: sortableColumn,
                  order,
                }
              : undefined,
          );
        },
      };
    },
    [],
  );

  const onRow = useCallback(
    (item: IMarketAssetListItem) => ({
      onPress: () => void handleItemPress(item),
      rowProps: {
        testID: `market-top-coins-row-${item.assetId}`,
      },
    }),
    [handleItemPress],
  );

  const webTabIntegrated = Boolean(tabIntegrated && !platformEnv.isNative);
  const useDesktopPortal = Boolean(
    webTabIntegrated &&
    tabName &&
    stickyHeaderContext?.portalTarget &&
    stickyHeaderContext.activeTabName === tabName,
  );
  const portalTarget = stickyHeaderContext?.portalTarget;
  const contentPaddingBottom =
    listContainerProps?.paddingBottom ?? tabBarHeight;

  return (
    <Stack flex={1} width="100%" testID="market-top-coins-list">
      {useDesktopPortal && portalTarget ? (
        <StickyHeaderPortal target={portalTarget}>
          <YStack {...MARKET_DESKTOP_CONTENT_FRAME_PROPS} bg="$bgApp" px="$3">
            <Table.HeaderRow
              columns={columns}
              headerRowProps={{ height: 36 }}
              onHeaderRow={onHeaderRow}
            />
          </YStack>
        </StickyHeaderPortal>
      ) : null}
      <Stack
        flex={1}
        style={{ paddingTop: 4, overflowX: 'auto', overflowY: 'hidden' }}
      >
        <Table<IMarketAssetListItem>
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: contentPaddingBottom,
          }}
          columns={columns}
          dataSource={sortedData}
          estimatedItemSize={TOP_COINS_DESKTOP_ROW_HEIGHT}
          headerRowProps={{ height: 36 }}
          keyExtractor={(item) => item.assetId}
          onHeaderRow={onHeaderRow}
          onRow={onRow}
          rowProps={{ height: TOP_COINS_DESKTOP_ROW_HEIGHT }}
          scrollEnabled={!webTabIntegrated}
          showHeader={!useDesktopPortal}
          showSkeleton={isLoading ? data.length === 0 : false}
          skeletonCount={12}
          tabIntegrated={tabIntegrated}
        />
      </Stack>
    </Stack>
  );
}
