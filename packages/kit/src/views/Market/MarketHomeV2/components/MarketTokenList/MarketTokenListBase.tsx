import { useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

import { Stack, Table, useMedia } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useMarketTokenColumns } from './hooks/useMarketTokenColumns';
import { useToDetailPage } from './hooks/useToDetailPage';
import { type IMarketToken } from './MarketTokenData';

const SORTABLE_COLUMNS = {
  liquidity: 'liquidity',
  marketCap: 'mc',
  turnover: 'v24hUSD',
} as const;

export type IMarketTokenListResult = {
  data: IMarketToken[];
  isLoading: boolean | undefined;
  setSortBy: (sortBy: string | undefined) => void;
  setSortType: (sortType: 'asc' | 'desc' | undefined) => void;
};

type IMarketTokenListBaseProps = {
  networkId?: string;
  onItemPress?: (item: IMarketToken) => void;
  pageSize?: number;
  toolbar?: ReactNode;
  result: IMarketTokenListResult;
  isWatchlistMode?: boolean;
};

function MarketTokenListBase({
  networkId = 'sol--101',
  onItemPress,
  pageSize = 20,
  toolbar,
  result,
  isWatchlistMode = false,
}: IMarketTokenListBaseProps) {
  const toDetailPage = useToDetailPage();
  const { md } = useMedia();

  const marketTokenColumns = useMarketTokenColumns(networkId, isWatchlistMode);

  const { data, isLoading, setSortBy, setSortType } = result;

  // Listen to MarketWatchlistOnlyChanged event to update sort settings
  useEffect(() => {
    const handleWatchlistOnlyChanged = (payload: {
      showWatchlistOnly: boolean;
    }) => {
      if (payload.showWatchlistOnly && isWatchlistMode) {
        setSortBy(undefined);
        setSortType(undefined);
      } else if (!payload.showWatchlistOnly && !isWatchlistMode) {
        setSortBy('v24hUSD');
        setSortType('desc');
      }
    };

    // Register event listener
    appEventBus.on(
      EAppEventBusNames.MarketWatchlistOnlyChanged,
      handleWatchlistOnlyChanged,
    );

    // Cleanup event listener on unmount
    return () => {
      appEventBus.off(
        EAppEventBusNames.MarketWatchlistOnlyChanged,
        handleWatchlistOnlyChanged,
      );
    };
  }, [setSortBy, setSortType, isWatchlistMode]);

  const handleSortChange = useCallback(
    (sortBy: string, sortType: 'asc' | 'desc' | undefined) => {
      setSortBy(sortBy);
      setSortType(sortType);
    },
    [setSortBy, setSortType],
  );

  const handleHeaderRow = useCallback(
    (column: ITableColumn<IMarketToken>) => {
      // Sorting logic
      const sortKey =
        SORTABLE_COLUMNS[column.dataIndex as keyof typeof SORTABLE_COLUMNS];

      if (sortKey) {
        return {
          onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
            handleSortChange(sortKey, order);
          },
        };
      }

      return undefined;
    },
    [handleSortChange],
  );

  const handleEndReached = useCallback(() => {
    console.log('onEndReached');
  }, []);

  // Show skeleton only on initial load (when there's no data yet)
  // This provides better UX by avoiding skeleton flash during pagination
  const showSkeleton = Boolean(isLoading) && data.length === 0;

  return (
    <Stack flex={1} width="100%">
      {/* render custom toolbar if provided */}
      {toolbar ? (
        <Stack width="100%" mb="$3">
          {toolbar}
        </Stack>
      ) : null}

      {/* Table container with horizontal scroll support */}
      <Stack
        flex={1}
        className="normal-scrollbar"
        style={{
          paddingTop: 4,
          overflowX: 'auto',
          ...(md ? { marginLeft: 8, marginRight: 8 } : {}),
        }}
      >
        <Stack minWidth={md ? '100%' : 1466} flex={1} minHeight={400}>
          {showSkeleton ? (
            <Table.Skeleton
              columns={marketTokenColumns}
              count={pageSize}
              rowProps={{
                minHeight: '$14',
              }}
            />
          ) : (
            <Table<IMarketToken>
              key={networkId}
              stickyHeader
              scrollEnabled
              columns={marketTokenColumns}
              onEndReached={handleEndReached}
              dataSource={data}
              keyExtractor={(item) => item.address + item.symbol + item.name}
              onHeaderRow={handleHeaderRow}
              estimatedItemSize="$14"
              onRow={
                onItemPress
                  ? (item) => ({
                      onPress: () => onItemPress(item),
                    })
                  : (item) => ({
                      onPress: () =>
                        toDetailPage({
                          symbol: item.symbol,
                          tokenAddress: item.address,
                          networkId,
                        }),
                    })
              }
            />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}

export { MarketTokenListBase };
