import { useCallback, useState } from 'react';

import { Pagination, Stack, Table, XStack } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import { parseValueToNumber } from '../../utils';

import { useMarketTokenColumns } from './hooks/useMarketTokenColumns';
import { useMarketTokenList } from './hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from './hooks/useMarketWatchlistTokenList';
import { useToDetailPage } from './hooks/useToDetailPage';
import { type IMarketToken } from './MarketTokenData';

import type { ILiquidityFilter } from '../../types';

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
};

function MarketTokenList({
  networkId = 'sol--101',
  sortBy: initialSortBy,
  sortType: initialSortType,
  onItemPress,
  pageSize = 20,
  liquidityFilter,
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
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
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

  return (
    <>
      <Stack
        className="normal-scrollbar"
        $platform-web={{
          overflow: 'auto',
        }}
        flex={1}
        width="100%"
      >
        <Stack width={1466}>
          {showSkeleton ? (
            <Table.Skeleton columns={marketTokenColumns} count={pageSize} />
          ) : (
            <Table<IMarketToken>
              columns={marketTokenColumns}
              dataSource={data}
              keyExtractor={(item) => item.id}
              onHeaderRow={handleHeaderRow}
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
