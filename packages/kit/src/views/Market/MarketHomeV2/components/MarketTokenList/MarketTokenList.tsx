import { useMemo } from 'react';

import { SizableText, Table } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';

interface IMarketToken {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
}

const defaultData: IMarketToken[] = [
  { id: '1', name: 'Bitcoin', symbol: 'BTC', price: 45_000, change24h: 2.5 },
  { id: '2', name: 'Ethereum', symbol: 'ETH', price: 3000, change24h: -1.2 },
  // Add more sample data as needed
];

type IMarketTokenListProps = {
  data?: IMarketToken[];
};

function MarketTokenList({ data = defaultData }: IMarketTokenListProps) {
  const columns = useMemo<ITableColumn<IMarketToken>[]>(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        render: (_, record) => (
          <SizableText size="$bodyMd">
            {record.name} ({record.symbol})
          </SizableText>
        ),
      },
      {
        title: 'Price',
        dataIndex: 'price',
        render: (text: number) => (
          <SizableText size="$bodyMd">${text.toLocaleString()}</SizableText>
        ),
        align: 'right',
      },
      {
        title: '24h Change',
        dataIndex: 'change24h',
        render: (text: number) => (
          <SizableText
            size="$bodyMd"
            color={text >= 0 ? '$textSuccess' : '$textCritical'}
          >
            {text >= 0 ? '+' : ''}
            {text.toFixed(2)}%
          </SizableText>
        ),
        align: 'right',
      },
    ],
    [],
  );

  return (
    <Table<IMarketToken>
      columns={columns}
      dataSource={data}
      keyExtractor={(item) => item.id}
      // Add other Table props as needed, e.g., rowProps, onRow, etc.
    />
  );
}

export { MarketTokenList };
