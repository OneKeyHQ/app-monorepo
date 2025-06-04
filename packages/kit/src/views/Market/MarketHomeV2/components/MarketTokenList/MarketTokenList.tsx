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
  networkId = 'sol--101',
  sortBy,
  sortType,
  onItemPress,
  pageSize = 10,
}: IMarketTokenListProps) {
  const toDetailPage = useToDetailPage();

  const { data, isLoading, currentPage, setCurrentPage, totalPages } =
    useMarketTokenList({
      networkId,
      sortBy,
      sortType,
      pageSize,
    });

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
            dataSource={isLoading ? [] : data}
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

      {totalPages > 1 ? (
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
