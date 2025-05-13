import { useMemo, useState } from 'react';

import { Pagination, Stack, Table, XStack } from '@onekeyhq/components';

import { useToDetailPage } from './hooks/useToDetailPage';
import { marketTokenColumns } from './MarketTokenColumns';
import { type IMarketToken, defaultData } from './MarketTokenData';

type IMarketTokenListProps = {
  data?: IMarketToken[];
  isLoading?: boolean;
  onItemPress?: (item: IMarketToken) => void;
  pageSize?: number;
};

function MarketTokenList({
  data = defaultData,
  isLoading = false,
  onItemPress,
  pageSize = 10,
}: IMarketTokenListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const toDetailPage = useToDetailPage();

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, currentPage, pageSize]);

  const totalPages = useMemo(
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
                : (_item) => ({
                    onPress: () =>
                      toDetailPage({
                        coingeckoId: 'bitcoin',
                      }),
                  })
            }
          />
        </Stack>
      </Stack>
      {!isLoading && totalPages > 1 ? (
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
