import { StyleSheet } from 'react-native';

import { SectionList } from '@onekeyhq/components/src/layouts/SectionList';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

interface IActivityRow {
  id: string;
  title: string;
  amount: string;
}

interface IActivitySection {
  title: string;
  data: IActivityRow[];
}

const SECTIONS: IActivitySection[] = [
  {
    title: 'Today',
    data: [
      { id: '1', title: 'Receive', amount: '+0.012 BTC' },
      { id: '2', title: 'Send', amount: '-0.4 ETH' },
    ],
  },
  {
    title: 'Yesterday',
    data: [
      { id: '3', title: 'Swap', amount: '120 USDC' },
      { id: '4', title: 'Approve', amount: 'Unlimited USDT' },
      { id: '5', title: 'Send', amount: '-25 SOL' },
    ],
  },
  {
    title: 'Earlier',
    data: [
      { id: '6', title: 'Receive', amount: '+1,500 DOGE' },
      { id: '7', title: 'Stake', amount: '32 ETH' },
      { id: '8', title: 'Send', amount: '-0.2 BTC' },
    ],
  },
];

const renderActivityRow = ({ item }: { item: IActivityRow }) => (
  <XStack px="$5" py="$2.5" ai="center" jc="space-between">
    <SizableText size="$bodyMd">{item.title}</SizableText>
    <SizableText size="$bodyMd" color="$textSubdued">
      {item.amount}
    </SizableText>
  </XStack>
);

const renderSectionHeader = ({ section }: { section: IActivitySection }) => (
  <SectionList.SectionHeader title={section.title} />
);

const keyExtractor = (item: unknown) => (item as IActivityRow).id;

// Sections are flattened into one FlashList-backed ListView, so the same
// bounded-height rule applies as ListView.
function SectionListDemo({ sticky = false }: { sticky?: boolean }) {
  return (
    <YStack
      h={400}
      w={320}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <SectionList
        sections={SECTIONS}
        renderItem={renderActivityRow}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        estimatedItemSize={40}
        stickySectionHeadersEnabled={sticky}
      />
    </YStack>
  );
}

const meta = {
  title: 'Layouts/SectionList',
  component: SectionListDemo,
} satisfies Meta<typeof SectionListDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const StickyHeaders: Story = {
  args: {
    sticky: true,
  },
};
