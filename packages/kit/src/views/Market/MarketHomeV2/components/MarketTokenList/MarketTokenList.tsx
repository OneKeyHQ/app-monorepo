import { Table } from '@onekeyhq/components';

import { marketTokenColumns } from './MarketTokenColumns';
import { type IMarketToken, defaultData } from './MarketTokenData';

type IMarketTokenListProps = {
  data?: IMarketToken[];
  isLoading?: boolean;
  onItemPress?: (item: IMarketToken) => void;
};

function MarketTokenList({
  data = defaultData,
  isLoading = false,
  onItemPress,
}: IMarketTokenListProps) {
  return (
    <Table<IMarketToken>
      columns={marketTokenColumns}
      dataSource={isLoading ? [] : data}
      keyExtractor={(item) => item.id}
      onRow={
        onItemPress
          ? (item) => ({
              onPress: () => onItemPress(item),
            })
          : undefined
      }
    />
  );
}

export { MarketTokenList };
