import { SizableText, Table, YStack } from '@onekeyhq/components';

import { cryptoData } from './data';
import type { ICryptoData } from './types';

// Custom Rendering Demo
export const CustomRenderingDemo = () => {
  const columns = [
    {
      title: 'Token',
      dataIndex: 'symbol',
      columnWidth: 100,
      render: (text: string, record: ICryptoData) => (
        <YStack>
          <SizableText size="$bodyMdMedium" color="$text">
            {text}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {record.name}
          </SizableText>
        </YStack>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      columnWidth: 100,
      align: 'right' as const,
      render: (price: number) => (
        <SizableText size="$bodyMd" color="$text">
          ${price.toLocaleString()}
        </SizableText>
      ),
    },
    {
      title: '24h Change',
      dataIndex: 'change24h',
      columnWidth: 100,
      align: 'right' as const,
      render: (change: number) => (
        <SizableText
          size="$bodyMd"
          color={change >= 0 ? '$textSuccess' : '$textCritical'}
        >
          {change >= 0 ? '+' : ''}
          {change.toFixed(2)}%
        </SizableText>
      ),
    },
  ];

  return (
    <Table
      dataSource={cryptoData}
      columns={columns}
      keyExtractor={(item: ICryptoData) => item.id}
      estimatedItemSize={60}
      rowProps={{
        borderBottomWidth: 1,
        borderColor: '$borderSubdued',
        px: '$3',
        py: '$3',
      }}
      headerRowProps={{
        bg: '$bgSubdued',
        px: '$3',
        py: '$3',
      }}
    />
  );
};