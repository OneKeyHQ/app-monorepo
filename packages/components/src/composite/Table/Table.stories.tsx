import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { Table } from '@onekeyhq/components/src/composite/Table';
import type { ITableColumn } from '@onekeyhq/components/src/composite/Table';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { Skeleton } from '@onekeyhq/components/src/primitives/Skeleton';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

interface ITokenRow {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

const TOKENS: ITokenRow[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 63_240.12, change: 2.4 },
  { symbol: 'ETH', name: 'Ethereum', price: 3480.55, change: -1.2 },
  { symbol: 'SOL', name: 'Solana', price: 164.78, change: 5.9 },
  { symbol: 'BNB', name: 'BNB', price: 585.01, change: 0.6 },
  { symbol: 'XRP', name: 'XRP', price: 0.52, change: -3.1 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.21, change: 8.7 },
  { symbol: 'TON', name: 'Toncoin', price: 7.19, change: -0.4 },
  { symbol: 'ADA', name: 'Cardano', price: 0.44, change: 1.1 },
];

const renderTokenCell = (_: unknown, record: ITokenRow) => (
  <YStack>
    <SizableText size="$bodyMdMedium">{record.symbol}</SizableText>
    <SizableText size="$bodySm" color="$textSubdued">
      {record.name}
    </SizableText>
  </YStack>
);

const renderPriceCell = (price: number) => (
  <SizableText size="$bodyMd">${price.toFixed(2)}</SizableText>
);

const renderChangeCell = (change: number) => (
  <SizableText
    size="$bodyMd"
    color={change >= 0 ? '$textSuccess' : '$textCritical'}
  >
    {change >= 0 ? '+' : ''}
    {change.toFixed(1)}%
  </SizableText>
);

const renderCellSkeleton = () => <Skeleton w="$14" h="$3" />;

const COLUMNS: ITableColumn<ITokenRow>[] = [
  {
    title: 'Token',
    dataIndex: 'symbol',
    columnWidth: 148,
    render: renderTokenCell,
    renderSkeleton: renderCellSkeleton,
  },
  {
    title: 'Price',
    dataIndex: 'price',
    columnWidth: 104,
    align: 'right',
    render: renderPriceCell,
    renderSkeleton: renderCellSkeleton,
  },
  {
    title: '24h',
    dataIndex: 'change',
    columnWidth: 88,
    align: 'right',
    render: renderChangeCell,
    renderSkeleton: renderCellSkeleton,
  },
];

// Skeleton rows are `{}` placeholders, so key by index when the symbol is
// missing.
const keyExtractor = (item: ITokenRow, index: number) =>
  item?.symbol ?? String(index);

// The demo binds Table to a fixed-height stack: its internal ListView is
// virtualized and collapses to zero height in an unbounded parent on native.
// Only the Price header sorts here — tap it to cycle asc/desc/off.
function TableDemo({
  showSkeleton = false,
  onRowPress,
}: {
  showSkeleton?: boolean;
  onRowPress?: (symbol: string) => void;
}) {
  const [rows, setRows] = useState(TOKENS);

  const handleHeaderRow = useCallback((column: ITableColumn<ITokenRow>) => {
    if (column.dataIndex !== 'price') {
      return undefined;
    }
    return {
      onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
        if (!order) {
          setRows(TOKENS);
          return;
        }
        setRows(
          [...TOKENS].toSorted((a, b) =>
            order === 'asc' ? a.price - b.price : b.price - a.price,
          ),
        );
      },
    };
  }, []);

  const handleRow = useCallback(
    (record: ITokenRow) => ({
      onPress: () => onRowPress?.(record.symbol),
    }),
    [onRowPress],
  );

  return (
    <YStack h={360}>
      <Table
        dataSource={rows}
        columns={COLUMNS}
        keyExtractor={keyExtractor}
        onHeaderRow={handleHeaderRow}
        onRow={handleRow}
        showSkeleton={showSkeleton}
        skeletonCount={4}
      />
    </YStack>
  );
}

const meta = {
  title: 'Composite/Table',
  component: TableDemo,
  args: {
    onRowPress: fn(),
  },
} satisfies Meta<typeof TableDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Loading: Story = {
  args: {
    showSkeleton: true,
  },
};
