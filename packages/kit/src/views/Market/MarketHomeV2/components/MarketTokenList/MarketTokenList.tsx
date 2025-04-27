import { Table } from '@onekeyhq/components';

import { marketTokenColumns } from './MarketTokenColumns';
import { type IMarketToken, defaultData } from './MarketTokenData';

type IMarketTokenListProps = {
  data?: IMarketToken[];
};

function MarketTokenList({ data = defaultData }: IMarketTokenListProps) {
  return (
    <Table<IMarketToken>
      columns={marketTokenColumns}
      dataSource={data}
      keyExtractor={(item) => item.id}
      // Add other Table props as needed, e.g., rowProps, onRow, etc.
    />
  );
}

export { MarketTokenList };
