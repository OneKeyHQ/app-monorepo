import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { PriceChangePercentage } from '../../../components/PriceChangePercentage';
import SparklineChart from '../../../components/SparklineChart';
import {
  MARKET_LIST_NAME_COLUMN_WIDTH,
  MARKET_LIST_STAR_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '../../../marketDesktopLayoutConstants';
import { DesktopStickyHeaderContext } from '../../layouts/DesktopStickyHeaderContext';
import { MarketDesktopStickyHeader } from '../MarketDesktopStickyHeader';
import { MARKET_CELL_LOGO_GAP } from '../MarketListCell';
import { StickyHeaderPortal } from '../StickyHeaderPortal';
import { useMarketDesktopResponsiveColumns } from '../useMarketDesktopResponsiveColumns';

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
const TOP_COINS_METRIC_COLUMN_MINIMUM_WIDTHS = {
  priceChange24hPercent: 112,
  priceChange7dPercent: 112,
  sparkline: 148,
} as const;

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
  const themeVariant = useThemeVariant();

  return useMemo(() => {
    const metricColumnProps = {
      flexGrow: 1,
      flexBasis: 0,
      px: '$2',
    } as const;
    const columns: (ITableColumn<IMarketAssetListItem> | undefined)[] = [
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
        ),
        dataIndex: 'star',
        // No right padding: the column's trailing space IS the design's 6px gap
        // to the name group, so the next column starts its logo flush.
        columnProps: { flexShrink: 0, pl: '$2', pr: 0 },
        columnWidth: MARKET_LIST_STAR_COLUMN_WIDTH,
        // Not a `MarketStarV2`: this list is served by the legacy CoinGecko
        // category endpoint, whose items carry no chain/contract pair, and the
        // V2 watchlist is keyed by one. Plain icon on the shared slot.
        render: () => (
          <Stack
            width={MARKET_LIST_STAR_SLOT_WIDTH}
            alignItems="center"
            justifyContent="center"
          >
            <Icon name="StarOutline" size="$4" color="$iconSubdued" />
          </Stack>
        ),
        renderSkeleton: () => (
          <Skeleton width={24} height={24} borderRadius="$full" />
        ),
      },
      {
        title: 'Name',
        dataIndex: 'name',
        columnWidth: MARKET_LIST_NAME_COLUMN_WIDTH,
        // No left padding: the star column already spends the shared star-to-
        // logo distance, so the logo starts on this column's edge.
        columnProps: { flexShrink: 0, pl: 0, pr: '$2' },
        render: (_: unknown, record: IMarketAssetListItem) => (
          <XStack
            width="100%"
            minWidth={0}
            overflow="hidden"
            alignItems="center"
            gap={MARKET_CELL_LOGO_GAP}
          >
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
        title: 'Price',
        dataIndex: 'price',
        columnProps: metricColumnProps,
        render: (value: string) => (
          <MarketValue value={value} formatter="price" />
        ),
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      {
        title: '24h Change',
        dataIndex: 'priceChange24hPercent',
        columnProps: metricColumnProps,
        render: (value: string) => (
          <PriceChangePercentage size="$bodyLgMedium">
            {value}
          </PriceChangePercentage>
        ),
        renderSkeleton: () => <Skeleton width={64} height={16} />,
      },
      {
        title: '7d Change',
        dataIndex: 'priceChange7dPercent',
        columnProps: metricColumnProps,
        render: (value: string) => (
          <PriceChangePercentage size="$bodyLgMedium">
            {value}
          </PriceChangePercentage>
        ),
        renderSkeleton: () => <Skeleton width={64} height={16} />,
      },
      {
        title: 'Mcap',
        dataIndex: 'marketCap',
        columnProps: metricColumnProps,
        render: (value: string) => (
          <MarketValue value={value} formatter="marketCap" />
        ),
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      {
        title: '24h Volume',
        dataIndex: 'volume24h',
        columnProps: metricColumnProps,
        render: (value: string) => (
          <MarketValue value={value} formatter="marketCap" />
        ),
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      {
        title: '24h price range',
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
      },
    ];

    return columns.filter(
      (column): column is ITableColumn<IMarketAssetListItem> => Boolean(column),
    );
  }, [themeVariant]);
}

export function MarketTopCoinsList({
  tabIntegrated,
  tabName,
  listContainerProps,
}: IMarketTopCoinsListProps) {
  const { data, handleItemPress, isLoading } = useMarketTopCoins();
  const baseColumns = useTopCoinsColumns();
  const { columns, handleContainerLayout: handleResponsiveContainerLayout } =
    useMarketDesktopResponsiveColumns({
      columns: baseColumns,
      enabled: !platformEnv.isNative,
      firstColumnCount: 2,
      metricColumnMinimumWidths: TOP_COINS_METRIC_COLUMN_MINIMUM_WIDTHS,
    });
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
  useEffect(() => {
    if (
      sortState &&
      !columns.some((column) => column.dataIndex === sortState.column)
    ) {
      setSortState(undefined);
    }
  }, [columns, sortState]);

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
    <Stack
      flex={1}
      width="100%"
      testID="market-top-coins-list"
      onLayout={handleResponsiveContainerLayout}
    >
      {useDesktopPortal && portalTarget ? (
        <StickyHeaderPortal target={portalTarget}>
          {/* No toolbar on this page: the shared header falls back to the
              design's table inset. */}
          <MarketDesktopStickyHeader<IMarketAssetListItem>
            columns={columns}
            onHeaderRow={onHeaderRow}
          />
        </StickyHeaderPortal>
      ) : null}
      <Stack flex={1} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <Table<IMarketAssetListItem>
          contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
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
          showSkeleton={isLoading && data.length === 0}
          skeletonCount={12}
          tabIntegrated={tabIntegrated}
        />
      </Stack>
    </Stack>
  );
}
