import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { ScrollView } from 'react-native';

import {
  Pagination,
  Stack,
  Table,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import { parseValueToNumber } from '../../utils';

import { useMarketTokenColumns } from './hooks/useMarketTokenColumns';
import { useMarketTokenList } from './hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';
import { useToDetailPage } from './hooks/useToDetailPage';
import { type IMarketToken } from './MarketTokenData';

import type { ILiquidityFilter } from '../../types';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

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
  onScrollOffsetChange?: (offsetY: number) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * If provided, the list will initially display only tokens in the user's
   * watchlist. This prop controls the *initial* state only; users can still
   * toggle between watchlist-only and full list by tapping the star column
   * header.
   */
  defaultShowWatchlistOnly?: boolean;
  /**
   * External control for watchlist display state. When provided, the star
   * column header will no longer be clickable and the watchlist toggle
   * is controlled externally.
   */
  externalWatchlistControl?: {
    showWatchlistOnly: boolean;
    onToggle: () => void;
  };
};

function MarketTokenList({
  networkId = 'sol--101',
  sortBy: initialSortBy,
  sortType: initialSortType,
  onItemPress,
  pageSize = 20,
  liquidityFilter,
  toolbar,
  onScrollOffsetChange,
  onScroll,
  defaultShowWatchlistOnly,
  externalWatchlistControl,
}: IMarketTokenListProps) {
  const toDetailPage = useToDetailPage();

  const [currentSortBy, setCurrentSortBy] = useState<string | undefined>(
    initialSortBy || 'v24hUSD',
  );
  const [currentSortType, setCurrentSortType] = useState<
    'asc' | 'desc' | undefined
  >(initialSortType || 'desc');

  const handleSortChange = useCallback(
    (sortBy: string, sortType: 'asc' | 'desc' | undefined) => {
      setCurrentSortBy(sortBy);
      setCurrentSortType(sortType);
    },
    [],
  );

  // ---------------- WATCHLIST ------------------
  const [internalShowWatchlistOnly, setInternalShowWatchlistOnly] = useState(
    defaultShowWatchlistOnly ?? false,
  );
  const [watchlistState] = useMarketWatchListV2Atom();
  const watchlistItems = watchlistState.data;

  // Use external control if provided, otherwise use internal state
  const showWatchlistOnly =
    externalWatchlistControl?.showWatchlistOnly ?? internalShowWatchlistOnly;

  const handleHeaderRow = useCallback(
    (column: ITableColumn<IMarketToken>) => {
      // Star column toggle watchlist - only if not externally controlled
      if (column.dataIndex === 'star' && !externalWatchlistControl) {
        return {
          onPress: () => {
            setInternalShowWatchlistOnly((prev) => !prev);
          },
        };
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
    [handleSortChange, externalWatchlistControl],
  );

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
    sortBy: currentSortBy,
    sortType: currentSortType,
    pageSize,
    minLiquidity,
    maxLiquidity,
  });

  const normalResult = useMarketTokenList({
    networkId,
    sortBy: currentSortBy,
    sortType: currentSortType,
    pageSize,
    minLiquidity,
    maxLiquidity,
  });

  const { data, isLoading, currentPage, setCurrentPage, totalPages } =
    showWatchlistOnly ? watchlistResult : normalResult;

  // Show skeleton only on initial load (when there's no data yet)
  // This provides better UX by avoiding skeleton flash during pagination
  const showSkeleton = isLoading && data.length === 0;

  const { md } = useMedia();

  return (
    <>
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
          <Stack minWidth={md ? '100%' : 1466} height="100%">
            {showSkeleton ? (
              <Table.Skeleton columns={marketTokenColumns} count={pageSize} />
            ) : (
              <Table<IMarketToken>
                stickyHeader
                columns={marketTokenColumns}
                dataSource={data}
                keyExtractor={(item) => item.address + item.symbol}
                onHeaderRow={handleHeaderRow}
                // Inject custom scroll component if callback provided
                renderScrollComponent={
                  onScrollOffsetChange
                    ? (props) => (
                        <ScrollView
                          {...props}
                          onScroll={(
                            e: NativeSyntheticEvent<NativeScrollEvent>,
                          ) => {
                            onScrollOffsetChange?.(
                              e.nativeEvent?.contentOffset?.y ?? 0,
                            );
                            onScroll?.(e);
                          }}
                          scrollEventThrottle={16}
                        />
                      )
                    : undefined
                }
                onRow={
                  onItemPress
                    ? (item) => ({
                        onPress: () => onItemPress(item),
                      })
                    : (item) => ({
                        onPress: () =>
                          toDetailPage({
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

      {/* Hide pagination during skeleton loading */}
      {!showSkeleton && totalPages > 1 ? (
        <XStack justifyContent="center" py="$4">
          <Pagination
            maxPages={20}
            current={currentPage}
            total={totalPages}
            onChange={setCurrentPage}
          />
        </XStack>
      ) : null}
    </>
  );
}

export { MarketTokenList };
