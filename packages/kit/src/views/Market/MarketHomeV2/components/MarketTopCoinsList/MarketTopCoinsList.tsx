import { useCallback, useContext, useMemo, useState } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketToken } from '@onekeyhq/shared/types/market';

import { PriceChangePercentage } from '../../../components/PriceChangePercentage';
import SparklineChart from '../../../components/SparklineChart';
import {
  MARKET_DESKTOP_CONTENT_FRAME_PROPS,
  MARKET_LIST_STAR_COLUMN_WIDTH,
  MARKET_LIST_STAR_SLOT_WIDTH,
} from '../../../marketDesktopLayoutConstants';
import { DesktopStickyHeaderContext } from '../../layouts/DesktopStickyHeaderContext';
import {
  MARKET_SPARKLINE_COLORS,
  MARKET_SPARKLINE_HEIGHT,
  MARKET_SPARKLINE_WIDTH,
} from '../MarketSparkline';
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

const TOP_COINS_SORTABLE_COLUMN_KEYS = [
  'price',
  'priceChangePercentage24H',
  'priceChangePercentage7D',
  'marketCap',
  'totalVolume',
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
  value: number | undefined;
  formatter: 'marketCap' | 'price';
}) {
  if (value === undefined || !Number.isFinite(value)) {
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

function useTopCoinsColumns(): ITableColumn<IMarketToken>[] {
  const { gt2xl } = useMedia();
  const themeVariant = useThemeVariant();

  return useMemo(() => {
    const metricColumnProps = {
      flexGrow: 1,
      flexBasis: 0,
      px: '$2',
    } as const;
    const columns: (ITableColumn<IMarketToken> | undefined)[] = [
      {
        title: '#',
        dataIndex: 'star',
        // The column width carries the distance from the star slot to the next
        // column's logo, so the name column below starts flush at its own edge.
        columnWidth: MARKET_LIST_STAR_COLUMN_WIDTH,
        columnProps: { flexShrink: 0, px: '$2' },
        // Not a `MarketStarV2`: this list is served by the legacy CoinGecko
        // category endpoint, whose items carry only a `coingeckoId` — the V2
        // watchlist is keyed by chain + contract, so there is nothing to
        // favorite yet. Plain icon on the same slot as the other lists.
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
        columnWidth: 220,
        // No left padding: the star column already spends the shared star-to-
        // logo distance, so the logo starts on this column's edge.
        columnProps: { flexShrink: 0, pl: 0, pr: '$2' },
        render: (_: unknown, record: IMarketToken) => (
          // `width="100%"` + `overflow="hidden"` bound the cell to its column so
          // the symbol and the name below it can actually ellipsize; without
          // them the row is a non-shrinking flex item and the text overflows.
          <XStack
            width="100%"
            minWidth={0}
            overflow="hidden"
            alignItems="center"
            gap={14}
          >
            <Token
              size="lg"
              borderRadius="$full"
              tokenImageUri={record.image || record.iconUrl}
              fallbackIcon="CryptoCoinOutline"
            />
            <YStack flex={1} minWidth={0} justifyContent="center">
              <SizableText
                size="$bodyLgMedium"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {record.symbol.toUpperCase()}
              </SizableText>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {record.name}
              </SizableText>
            </YStack>
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
        render: (value: number) => (
          <MarketValue value={value} formatter="price" />
        ),
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      {
        title: '24h Change',
        dataIndex: 'priceChangePercentage24H',
        columnProps: metricColumnProps,
        render: (value: number) => (
          <PriceChangePercentage size="$bodyLgMedium">
            {value}
          </PriceChangePercentage>
        ),
        renderSkeleton: () => <Skeleton width={64} height={16} />,
      },
      gt2xl
        ? {
            title: '7d Change',
            dataIndex: 'priceChangePercentage7D',
            columnProps: metricColumnProps,
            render: (value: number) => (
              <PriceChangePercentage size="$bodyLgMedium">
                {value}
              </PriceChangePercentage>
            ),
            renderSkeleton: () => <Skeleton width={64} height={16} />,
          }
        : undefined,
      {
        title: 'Mcap',
        dataIndex: 'marketCap',
        columnProps: metricColumnProps,
        render: (value: number) => (
          <MarketValue value={value} formatter="marketCap" />
        ),
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      {
        title: '24h Volume',
        dataIndex: 'totalVolume',
        columnProps: metricColumnProps,
        render: (value: number) => (
          <MarketValue value={value} formatter="marketCap" />
        ),
        renderSkeleton: () => <Skeleton width={72} height={16} />,
      },
      gt2xl
        ? {
            title: '24h price range',
            dataIndex: 'sparkline',
            columnProps: {
              ...metricColumnProps,
              minWidth: MARKET_SPARKLINE_WIDTH,
            },
            render: (
              sparkline: IMarketToken['sparkline'],
              record: IMarketToken,
            ) => {
              if (!sparkline || sparkline.length < 2) {
                return <MissingValue />;
              }
              const isNegative = record.priceChangePercentage24H < 0;
              const themeColors =
                MARKET_SPARKLINE_COLORS[
                  themeVariant === 'dark' ? 'dark' : 'light'
                ];
              const [lineColor, gradientColor] = isNegative
                ? themeColors.negative
                : themeColors.positive;

              return (
                <SparklineChart
                  data={sparkline.slice(-24)}
                  width={MARKET_SPARKLINE_WIDTH}
                  height={MARKET_SPARKLINE_HEIGHT}
                  lineColor={lineColor}
                  linearGradientColor={gradientColor}
                />
              );
            },
            renderSkeleton: () => (
              <Skeleton
                width={MARKET_SPARKLINE_WIDTH}
                height={MARKET_SPARKLINE_HEIGHT}
              />
            ),
          }
        : undefined,
    ];

    return columns.filter((column): column is ITableColumn<IMarketToken> =>
      Boolean(column),
    );
  }, [gt2xl, themeVariant]);
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
      const difference = left[column] - right[column];
      return order === 'asc' ? difference : -difference;
    });
  }, [data, sortState]);

  const onHeaderRow = useCallback((column: ITableColumn<IMarketToken>) => {
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
  }, []);

  const onRow = useCallback(
    (item: IMarketToken) => ({
      onPress: () => void handleItemPress(item),
      rowProps: {
        testID: `market-top-coins-row-${item.coingeckoId}`,
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
        <Table<IMarketToken>
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: contentPaddingBottom,
          }}
          columns={columns}
          dataSource={sortedData}
          estimatedItemSize={TOP_COINS_DESKTOP_ROW_HEIGHT}
          headerRowProps={{ height: 36 }}
          keyExtractor={(item) => item.coingeckoId}
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
