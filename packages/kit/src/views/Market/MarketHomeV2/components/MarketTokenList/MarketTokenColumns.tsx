import { SizableText } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';

import { type IMarketToken } from './MarketTokenData';

export const marketTokenColumns: ITableColumn<IMarketToken>[] = [
  {
    title: 'Name',
    dataIndex: 'name',
    columnWidth: 100,
    render: (_, record) => (
      <SizableText size="$bodyMd">{record.name}</SizableText>
    ),
  },
  {
    title: 'Price',
    dataIndex: 'price',
    columnWidth: 100,
    render: (text: number) => (
      <SizableText size="$bodyMd">
        ${text < 1 ? text.toString() : text.toLocaleString()}
      </SizableText>
    ),
    align: 'right',
  },
  {
    title: 'Change(%)',
    dataIndex: 'change24h',
    columnWidth: 100,
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
  {
    title: 'Market cap',
    dataIndex: 'marketCap',
    columnWidth: 100,
    render: (text: number) => (
      <SizableText size="$bodyMd">${(text / 1e9).toFixed(2)}B</SizableText>
    ),
    align: 'right',
  },
  {
    title: 'Liquidity',
    dataIndex: 'liquidity',
    columnWidth: 100,
    render: (text: number) => (
      <SizableText size="$bodyMd">${(text / 1e6).toFixed(2)}M</SizableText>
    ),
    align: 'right',
  },
  {
    title: 'Txns',
    dataIndex: 'transactions',
    columnWidth: 100,
    render: (text: number) => (
      <SizableText size="$bodyMd">{text.toLocaleString()}K</SizableText>
    ),
    align: 'right',
  },
  {
    title: 'Unique traders',
    dataIndex: 'uniqueTraders',
    columnWidth: 100,
    render: (text: number) => (
      <SizableText size="$bodyMd">{text.toLocaleString()}K</SizableText>
    ),
    align: 'right',
  },
  {
    title: 'Holders',
    dataIndex: 'holders',
    columnWidth: 100,
    render: (text: number) => (
      <SizableText size="$bodyMd">{text.toLocaleString()}K</SizableText>
    ),
    align: 'right',
  },
  {
    title: 'Turnover',
    dataIndex: 'turnover',
    columnWidth: 100,
    render: (text: number) => (
      <SizableText size="$bodyMd">${(text / 1e6).toFixed(2)}M</SizableText>
    ),
    align: 'right',
  },
  {
    title: 'Token age',
    dataIndex: 'tokenAge',
    columnWidth: 100,
    render: (text: string) => <SizableText size="$bodyMd">{text}</SizableText>,
    align: 'center',
  },
  {
    title: 'Audit',
    dataIndex: 'audit',
    columnWidth: 100,
    render: (text: string) => <SizableText size="$bodyMd">{text}</SizableText>,
    align: 'center',
  },
  {
    title: 'Wallet Info',
    dataIndex: 'walletInfo',
    columnWidth: 100,
    render: (text: string) => (
      <SizableText size="$bodyMd">{text || '-'}</SizableText>
    ),
    align: 'right',
  },
];
