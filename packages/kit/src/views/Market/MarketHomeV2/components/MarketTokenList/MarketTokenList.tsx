import { useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

import { Stack, Table, useMedia } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import {
  useMarketWatchListV2Atom,
  useShowWatchlistOnlyValue,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { parseValueToNumber } from '../../utils';

import { useMarketTokenColumns } from './hooks/useMarketTokenColumns';
import { useMarketTokenList } from './hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';
import { useToDetailPage } from './hooks/useToDetailPage';
import { type IMarketToken } from './MarketTokenData';

import type { ILiquidityFilter } from '../../types';

const SORTABLE_COLUMNS = {
  liquidity: 'liquidity',
  marketCap: 'mc',
  turnover: 'v24hUSD',
} as const;

type IMarketTokenListProps = {
  networkId?: string;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  onItemPress?: (item: IMarketToken) => void;
  pageSize?: number;
  liquidityFilter?: ILiquidityFilter;
  /**
   * Custom toolbar element that will be rendered above the token list table.
   * Useful for placing extra action buttons or controls that relate to the
   * current list view (e.g. refresh button, export menu, etc.)
   */
  toolbar?: ReactNode;
};

function MarketTokenList({
  networkId = 'sol--101',
  sortBy: initialSortBy,
  sortType: initialSortType,
  onItemPress,
  pageSize = 20,
  liquidityFilter,
  toolbar,
}: IMarketTokenListProps) {
  const toDetailPage = useToDetailPage();

  // ---------------- WATCHLIST ------------------
  const [watchlistState] = useMarketWatchListV2Atom();
  const watchlistItems = watchlistState.data;
  const [showWatchlistOnly] = useShowWatchlistOnlyValue();
  const { md } = useMedia();

  const marketTokenColumns = useMarketTokenColumns(
    networkId,
    showWatchlistOnly,
  );

  // Convert string values to numbers for the API
  const minLiquidity = liquidityFilter?.min
    ? parseValueToNumber(liquidityFilter.min)
    : undefined;
  const maxLiquidity = liquidityFilter?.max
    ? parseValueToNumber(liquidityFilter.max)
    : undefined;

  // Call hooks unconditionally to follow React rules
  const watchlistResult = useMarketWatchlistTokenList({
    watchlist: watchlistItems || [],
    pageSize,
    minLiquidity,
    maxLiquidity,
  });

  const normalResult = useMarketTokenList({
    networkId,
    initialSortBy,
    initialSortType,
    pageSize,
    minLiquidity,
    maxLiquidity,
  });

  // Listen to MarketWatchlistOnlyChanged event to update sort settings
  useEffect(() => {
    const handleWatchlistOnlyChanged = (payload: {
      showWatchlistOnly: boolean;
    }) => {
      if (payload.showWatchlistOnly) {
        watchlistResult.setSortBy(undefined);
        watchlistResult.setSortType(undefined);
      } else {
        normalResult.setSortBy('v24hUSD');
        normalResult.setSortType('desc');
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
  }, [watchlistResult, normalResult]);

  const handleSortChange = useCallback(
    (sortBy: string, sortType: 'asc' | 'desc' | undefined) => {
      const result: {
        setSortBy: (sortBy: string | undefined) => void;
        setSortType: (sortType: 'asc' | 'desc' | undefined) => void;
      } = showWatchlistOnly ? watchlistResult : normalResult;

      result.setSortBy(sortBy);
      result.setSortType(sortType);
    },

    [showWatchlistOnly, watchlistResult, normalResult],
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

  const result = showWatchlistOnly ? watchlistResult : normalResult;
  const { data, isLoading } = result;

  // Show skeleton only on initial load (when there's no data yet)
  // This provides better UX by avoiding skeleton flash during pagination
  const showSkeleton = isLoading && data.length === 0;

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
          overflowX: 'auto',
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
              stickyHeader
              columns={marketTokenColumns}
              dataSource={data}
              keyExtractor={(item) => item.address + item.symbol + item.name}
              onHeaderRow={handleHeaderRow}
              rowProps={{
                minHeight: '$14',
              }}
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

export { MarketTokenList };
