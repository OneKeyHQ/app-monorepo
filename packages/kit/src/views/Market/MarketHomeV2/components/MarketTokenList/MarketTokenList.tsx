import { Pagination, Stack, Table, XStack } from '@onekeyhq/components';

import { parseValueToNumber } from '../../utils';

import { useMarketTokenColumns } from './hooks/useMarketTokenColumns';
import { useMarketTokenList } from './hooks/useMarketTokenList';
import { useToDetailPage } from './hooks/useToDetailPage';
import { type IMarketToken } from './MarketTokenData';

import type { ILiquidityFilter } from '../../types';

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
  sortBy,
  sortType,
  onItemPress,
  pageSize = 10,
  liquidityFilter,
}: IMarketTokenListProps) {
  const toDetailPage = useToDetailPage();
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
      sortBy,
      sortType,
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
