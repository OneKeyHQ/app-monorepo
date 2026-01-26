import { useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import {
  ListEndIndicator,
  Spinner,
  Stack,
  Table,
  useMedia,
} from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import { ESortWay } from '@onekeyhq/shared/src/logger/scopes/dex/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMarketTokenColumns } from './hooks/useMarketTokenColumns';
import { useToDetailPage } from './hooks/useToMarketDetailPage';
import { type IMarketToken } from './MarketTokenData';

const SPINNER_HEIGHT = 52;
const SORTABLE_COLUMNS = {
  liquidity: 'liquidity',
  marketCap: 'mc',
  turnover: 'v24hUSD',
} as const;

// Map sort keys to ESortWay enum values for logging
const SORT_KEY_TO_ENUM: Record<string, ESortWay> = {
  liquidity: ESortWay.Liquidity,
  mc: ESortWay.MC,
  v24hUSD: ESortWay.Volume,
};

export type IMarketTokenListResult = {
  data: IMarketToken[];
  isLoading: boolean | undefined;
  isLoadingMore?: boolean;
  isNetworkSwitching?: boolean;
  canLoadMore?: boolean;
  loadMore?: () => void | Promise<void>;
  setSortBy: (sortBy: string | undefined) => void;
  setSortType: (sortType: 'asc' | 'desc' | undefined) => void;
  initialSortBy?: string;
  initialSortType?: 'asc' | 'desc';
};

type IMarketTokenListBaseProps = {
  networkId?: string;
  onItemPress?: (item: IMarketToken) => void;
  toolbar?: ReactNode;
  result: IMarketTokenListResult;
  isWatchlistMode?: boolean;
  showEndReachedIndicator?: boolean;
  hideTokenAge?: boolean;
  watchlistFrom?: EWatchlistFrom;
  copyFrom?: ECopyFrom;
};

function MarketTokenListBase({
  networkId = 'sol--101',
  onItemPress,
  toolbar,
  result,
  isWatchlistMode = false,
  showEndReachedIndicator = false,
  hideTokenAge = false,
  watchlistFrom,
  copyFrom,
}: IMarketTokenListBaseProps) {
  const toMarketDetailPage = useToDetailPage();
  const { md } = useMedia();

  const marketTokenColumns = useMarketTokenColumns(
    networkId,
    isWatchlistMode,
    hideTokenAge,
    watchlistFrom,
    copyFrom,
  );

  const {
    data,
    isLoading,
    isLoadingMore,
    isNetworkSwitching,
    canLoadMore,
    loadMore,
    setSortBy,
    setSortType,
    initialSortBy,
    initialSortType,
  } = result;

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
      console.log('handleSortChange', sortBy, sortType);

      // Log sort action
      const sortWay =
        sortType === undefined
          ? ESortWay.Default
          : SORT_KEY_TO_ENUM[sortBy] || ESortWay.Default;

      defaultLogger.dex.list.dexSort({
        sortWay,
        sortDirection: sortType,
      });

      if (sortType === undefined) {
        setSortBy(initialSortBy);
        setSortType(initialSortType);
      } else {
        setSortBy(sortBy);
        setSortType(sortType);
      }
    },
    [setSortBy, setSortType, initialSortBy, initialSortType],
  );

  const handleHeaderRow = useCallback(
    (column: ITableColumn<IMarketToken>) => {
      if (!isWatchlistMode) {
        return undefined;
      }

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
    [handleSortChange, isWatchlistMode],
  );

  const handleEndReached = useCallback(() => {
    if (canLoadMore && loadMore && !isLoadingMore) {
      void loadMore();
    }
  }, [canLoadMore, loadMore, isLoadingMore]);

  // Show skeleton on initial load or network switching
  // Initial load: when there's no data yet
  // Network switching: when network is changing (provides better UX feedback)
  const showSkeleton =
    (Boolean(isLoading) && data.length === 0) || Boolean(isNetworkSwitching);

  const TableFooterComponent = useMemo(() => {
    if (isLoadingMore) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Spinner size="small" />
        </Stack>
      );
    }

    // Show end indicator when no more data to load
    if (showEndReachedIndicator && !canLoadMore && data.length > 0) {
      return <ListEndIndicator />;
    }

    return null;
  }, [isLoadingMore, showEndReachedIndicator, canLoadMore, data.length]);

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
        <Stack flex={1} minHeight={platformEnv.isNative ? undefined : 400}>
          {showSkeleton ? (
            <Table.Skeleton
              columns={marketTokenColumns}
              count={30}
              rowProps={{
                minHeight: '$14',
              }}
            />
          ) : (
            <Table<IMarketToken>
              // Add padding bottom to content container to provide space for loading spinner
              // Fix Android loading spinner visibility issue by ensuring proper content height
              contentContainerStyle={
                platformEnv.isNativeAndroid
                  ? {
                      paddingBottom: SPINNER_HEIGHT * 2,
                    }
                  : undefined
              }
              stickyHeader
              scrollEnabled
              columns={marketTokenColumns}
              onEndReached={handleEndReached}
              dataSource={data}
              keyExtractor={(item) =>
                item.address + item.symbol + item.networkId
              }
              extraData={networkId}
              onHeaderRow={handleHeaderRow}
              TableFooterComponent={TableFooterComponent}
              estimatedItemSize="$14"
              onRow={
                onItemPress
                  ? (item) => ({
                      onPress: () => onItemPress(item),
                    })
                  : (item) => ({
                      onPress: () =>
                        toMarketDetailPage({
                          symbol: item.symbol,
                          tokenAddress: item.address,
                          networkId: item.networkId,
                          isNative: item.isNative,
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
