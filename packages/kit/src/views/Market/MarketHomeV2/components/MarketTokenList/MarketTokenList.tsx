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

// 支持排序的字段映射
const SORTABLE_COLUMNS = {
  liquidity: 'liquidity',
  marketCap: 'mc',
  turnover: 'v24hUSD',
  change24h: 'v24hChangePercent',
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
  /**
   * Callback fired when the list scroll position changes. `offsetY` is the
   * vertical scroll distance in pixels. It can be used by parent components
   * to react to scroll, such as collapsing toolbars.
   */
  onScrollOffsetChange?: (offsetY: number) => void;
  /**
   * If provided, the list will initially display only tokens in the user's
   * watchlist. This prop controls the *initial* state only; users can still
   * toggle between watchlist-only and full list by tapping the star column
   * header.
   */
  defaultShowWatchlistOnly?: boolean;
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
  defaultShowWatchlistOnly,
}: IMarketTokenListProps) {
  const toDetailPage = useToDetailPage();

  // 内部排序状态管理 - 设置默认为 mc(市值) 降序排序
  const [currentSortBy, setCurrentSortBy] = useState<string | undefined>(
    initialSortBy || 'liquidity',
  );
  const [currentSortType, setCurrentSortType] = useState<
    'asc' | 'desc' | undefined
  >(initialSortType || 'desc');

  // 排序变更处理函数
  const handleSortChange = useCallback(
    (sortBy: string, sortType: 'asc' | 'desc' | undefined) => {
      setCurrentSortBy(sortBy);
      setCurrentSortType(sortType);
    },
    [],
  );

  // ---------------- WATCHLIST ------------------
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(
    defaultShowWatchlistOnly ?? false,
  );
  const [watchlistState] = useMarketWatchListV2Atom();
  const watchlistItems = watchlistState.data;

  // 表格头部行回调，处理排序 / watchlist toggle
  const handleHeaderRow = useCallback(
    (column: ITableColumn<IMarketToken>) => {
      // Star column toggle watchlist
      if (column.dataIndex === 'star') {
        return {
          onPress: () => {
            setShowWatchlistOnly((prev) => !prev);
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
    [handleSortChange, setShowWatchlistOnly],
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
      <Stack
        className="normal-scrollbar"
        $platform-web={{
          // Enable horizontal scrolling while keeping vertical overflow visible so that
          // the Table component can manage its own vertical scroll and keep the header sticky.
          overflowX: 'auto',
        }}
        flex={1}
        width="100%"
      >
        {/* render custom toolbar if provided */}
        {toolbar ? (
          <Stack width={md ? '100%' : 1466} mb="$3">
            {toolbar}
          </Stack>
        ) : null}
        {/* here */}
        <Stack width={md ? '100%' : 1466}>
          {showSkeleton ? (
            <Table.Skeleton columns={marketTokenColumns} count={pageSize} />
          ) : (
            <Table<IMarketToken>
              stickyHeader
              columns={marketTokenColumns}
              dataSource={data}
              keyExtractor={(item) => item.id}
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
                          // Call original onScroll if exists
                          // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,react/prop-types
                          (props as any)?.onScroll?.(e);
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

      {/* Hide pagination during skeleton loading */}
      {!showSkeleton && totalPages > 1 ? (
        <XStack justifyContent="center" py="$4">
          <Pagination
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
