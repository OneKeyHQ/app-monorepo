import { SizableText } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';

import { RiskIndicator } from './components/RiskIndicator';
import { TokenIdentityItem } from './components/TokenIdentityItem';
import { Txns } from './components/Txns';
import { type IMarketToken } from './MarketTokenData';

import type { IRiskIndicatorType } from './components/RiskIndicator';

export const marketTokenColumns: ITableColumn<IMarketToken>[] = [
  {
    title: 'Name',
    dataIndex: 'name',
    columnWidth: 200,
    render: (_, record) => (
      <TokenIdentityItem
        tokenLogoURI={record.tokenImageUri}
        networkLogoURI={record.tokenImageUri}
        symbol={record.symbol}
        address={record.address}
      />
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
    render: (text: number, record) => (
      <Txns transactions={text} walletInfo={record.walletInfo} />
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
    render: (type: IRiskIndicatorType) => <RiskIndicator type={type} />,
    align: 'center',
  },
];
