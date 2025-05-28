import { useMemo } from 'react';

import { Pagination, Stack, Table, XStack } from '@onekeyhq/components';

import { useMarketTokenList } from './hooks/useMarketTokenList';
import { useToDetailPage } from './hooks/useToDetailPage';
import { marketTokenColumns } from './MarketTokenColumns';
import { type IMarketToken } from './MarketTokenData';

type IMarketTokenListProps = {
  networkId?: string;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  onItemPress?: (item: IMarketToken) => void;
  pageSize?: number;
};

function MarketTokenList({
  networkId = 'sol--101', // 默认使用 Solana 网络，实际应该从上层组件传入
  sortBy,
  sortType,
  onItemPress,
  pageSize = 10,
}: IMarketTokenListProps) {
  const toDetailPage = useToDetailPage();

  const { data, isLoading, currentPage, setCurrentPage } = useMarketTokenList({
    networkId,
    sortBy,
    sortType,
    pageSize,
  });

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, currentPage, pageSize]);

  const actualTotalPages = useMemo(
    () => Math.ceil(data.length / pageSize),
    [data.length, pageSize],
  );

  return (
    <>
      <Stack
        className="normal-scrollbar"
        $platform-web={{
          overflow: 'auto',
        }}
        width="100%"
      >
        <Stack width={1500}>
          <Table<IMarketToken>
            columns={marketTokenColumns}
            dataSource={isLoading ? [] : paginatedData}
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
        </Stack>
      </Stack>
      {!isLoading && actualTotalPages > 1 ? (
        <XStack justifyContent="center" py="$4">
          <Pagination
            current={currentPage}
            total={actualTotalPages}
            onChange={setCurrentPage}
          />
        </XStack>
      ) : null}
    </>
  );
}

export { MarketTokenList };
