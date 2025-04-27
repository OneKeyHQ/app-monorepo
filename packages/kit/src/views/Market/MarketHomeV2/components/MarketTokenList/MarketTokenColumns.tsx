import { SizableText } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';

import { type IMarketToken } from './MarketTokenData';

export const marketTokenColumns: ITableColumn<IMarketToken>[] = [
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
];
