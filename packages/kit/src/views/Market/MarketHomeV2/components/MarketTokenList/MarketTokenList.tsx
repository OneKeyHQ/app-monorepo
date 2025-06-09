import { useCallback, useState } from 'react';

import { Pagination, Stack, Table, XStack } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';

import { parseValueToNumber } from '../../utils';

import { useMarketTokenColumns } from './hooks/useMarketTokenColumns';
import { useMarketTokenList } from './hooks/useMarketTokenList';
import { useToDetailPage } from './hooks/useToDetailPage';
import { type IMarketToken } from './MarketTokenData';

import type { ILiquidityFilter } from '../../types';

// 支持排序的字段映射
const SORTABLE_COLUMNS = {
  liquidity: 'liquidity',
  marketCap: 'mc',
  turnover: 'v24hUSD',
  volume24hChangePercent: 'v24hChangePercent',
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
  pageSize = 10,
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

  // 表格头部行回调，处理排序
  const handleHeaderRow = useCallback(
    (column: ITableColumn<IMarketToken>) => {
      // 检查列是否支持排序
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

  const marketTokenColumns = useMarketTokenColumns();

  // Convert string values to numbers for the API
  const minLiquidity = liquidityFilter?.min
    ? parseValueToNumber(liquidityFilter.min)
    : undefined;
  const maxLiquidity = liquidityFilter?.max
    ? parseValueToNumber(liquidityFilter.max)
    : undefined;

  const { data, isLoading, currentPage, setCurrentPage, totalPages } =
    useMarketTokenList({
      networkId,
      sortBy: currentSortBy, // 使用内部状态
      sortType: currentSortType, // 使用内部状态
      pageSize,
      minLiquidity,
      maxLiquidity,
    });

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
        width="100%"
      >
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
