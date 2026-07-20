import { StyleSheet } from 'react-native';

import { Divider } from '@onekeyhq/components/src/content/Divider';
import { ListView } from '@onekeyhq/components/src/layouts/ListView';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { ListRenderItem } from 'react-native';

interface INetworkRow {
  name: string;
  symbol: string;
}

const NETWORKS: INetworkRow[] = [
  { name: 'Bitcoin', symbol: 'BTC' },
  { name: 'Ethereum', symbol: 'ETH' },
  { name: 'Solana', symbol: 'SOL' },
  { name: 'BNB Chain', symbol: 'BNB' },
  { name: 'XRP Ledger', symbol: 'XRP' },
  { name: 'Dogecoin', symbol: 'DOGE' },
  { name: 'Toncoin', symbol: 'TON' },
  { name: 'Cardano', symbol: 'ADA' },
  { name: 'Litecoin', symbol: 'LTC' },
  { name: 'Polygon', symbol: 'POL' },
];

const renderNetworkRow: ListRenderItem<INetworkRow> = ({ item }) => (
  <XStack px="$4" py="$3" ai="center" jc="space-between">
    <SizableText size="$bodyMdMedium">{item.name}</SizableText>
    <SizableText size="$bodyMd" color="$textSubdued">
      {item.symbol}
    </SizableText>
  </XStack>
);

const keyExtractor = (item: INetworkRow) => item.symbol;

const renderSeparator = () => <Divider mx="$4" />;

// FlashList backs the native variant, so the list needs a bounded frame in an
// unbounded parent or it collapses to zero height.
function ListViewDemo() {
  return (
    <YStack
      h={360}
      w={320}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <ListView
        data={NETWORKS}
        renderItem={renderNetworkRow}
        keyExtractor={keyExtractor}
        estimatedItemSize={44}
        ItemSeparatorComponent={renderSeparator}
      />
    </YStack>
  );
}

const meta = {
  title: 'Layouts/ListView',
  component: ListViewDemo,
} satisfies Meta<typeof ListViewDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
