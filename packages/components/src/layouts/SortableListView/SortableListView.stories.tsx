import { useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';
import { fn } from 'storybook/test';

import { SortableListView } from '@onekeyhq/components/src/layouts/SortableListView';
import type {
  IDragEndParamsWithItem,
  IRenderItemParams,
} from '@onekeyhq/components/src/layouts/SortableListView';
import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import {
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const CELL_HEIGHT = 52;

interface IChainItem {
  id: string;
  label: string;
}

const INITIAL_CHAINS: IChainItem[] = [
  { id: 'btc', label: 'Bitcoin' },
  { id: 'eth', label: 'Ethereum' },
  { id: 'sol', label: 'Solana' },
  { id: 'doge', label: 'Dogecoin' },
  { id: 'ton', label: 'Toncoin' },
  { id: 'ada', label: 'Cardano' },
];

const keyExtractor = (item: IChainItem) => item.id;

// The web engine positions rows from getItemLayout (fixed row height);
// native drags go through the draggable list library instead.
const getItemLayout = (
  _: ArrayLike<IChainItem> | null | undefined,
  index: number,
) => ({ length: CELL_HEIGHT, offset: CELL_HEIGHT * index, index });

const renderChainRow = ({
  item,
  drag,
  dragProps,
  isActive,
}: IRenderItemParams<IChainItem>) => (
  <XStack
    h={CELL_HEIGHT}
    px="$4"
    ai="center"
    jc="space-between"
    bg={isActive ? '$bgActive' : '$bgApp'}
  >
    <SizableText size="$bodyMdMedium">{item.label}</SizableText>
    <Stack onPressIn={drag} dataSet={dragProps} cursor="move" p="$2">
      <Icon name="DragOutline" size="$5" color="$iconSubdued" />
    </Stack>
  </XStack>
);

function SortableListViewDemo({
  onOrderChange,
}: {
  onOrderChange?: (ids: string[]) => void;
}) {
  const [data, setData] = useState(INITIAL_CHAINS);

  const handleDragEnd = useCallback(
    ({ data: next }: IDragEndParamsWithItem<IChainItem>) => {
      setData(next);
      onOrderChange?.(next.map((item) => item.id));
    },
    [onOrderChange],
  );

  return (
    <YStack
      h={CELL_HEIGHT * INITIAL_CHAINS.length + 2}
      w={320}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <SortableListView
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderChainRow}
        getItemLayout={getItemLayout}
        onDragEnd={handleDragEnd}
      />
    </YStack>
  );
}

const meta = {
  title: 'Layouts/SortableListView',
  component: SortableListViewDemo,
  args: {
    onOrderChange: fn(),
  },
} satisfies Meta<typeof SortableListViewDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
