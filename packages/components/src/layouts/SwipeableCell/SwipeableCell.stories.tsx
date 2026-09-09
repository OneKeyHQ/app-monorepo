import { useMemo } from 'react';

import { fn } from 'storybook/test';

import { SwipeableCell } from '@onekeyhq/components/src/layouts/SwipeableCell';
import type { ISwipeableCellProps } from '@onekeyhq/components/src/layouts/SwipeableCell';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

type ISwipeActionList = NonNullable<ISwipeableCellProps['rightItemList']>;

// react-native-gesture-handler Swipeable underneath: touch-drag on native,
// mouse-drag on web. Opening one cell auto-closes the previously opened one.
function SwipeableCellDemo({
  withLeftActions = false,
  onAction,
}: {
  withLeftActions?: boolean;
  onAction?: (action: string) => void;
}) {
  const rightItemList = useMemo<ISwipeActionList>(
    () => [
      {
        title: 'Archive',
        width: 88,
        backgroundColor: '$bgInfoStrong',
        onPress: ({ close }) => {
          onAction?.('archive');
          close?.();
        },
      },
      {
        title: 'Delete',
        width: 88,
        backgroundColor: '$bgCriticalStrong',
        onPress: ({ close }) => {
          onAction?.('delete');
          close?.();
        },
      },
    ],
    [onAction],
  );

  const leftItemList = useMemo<ISwipeActionList>(
    () =>
      withLeftActions
        ? [
            {
              title: 'Pin',
              width: 88,
              backgroundColor: '$bgSuccessStrong',
              onPress: ({ close }) => {
                onAction?.('pin');
                close?.();
              },
            },
          ]
        : [],
    [withLeftActions, onAction],
  );

  return (
    <YStack w={320} borderRadius="$3" overflow="hidden">
      <SwipeableCell rightItemList={rightItemList} leftItemList={leftItemList}>
        <XStack p="$4" bg="$bgSubdued" ai="center" jc="space-between">
          <YStack>
            <SizableText size="$bodyMdMedium">Ethereum Mainnet</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              Swipe this row to reveal actions
            </SizableText>
          </YStack>
        </XStack>
      </SwipeableCell>
    </YStack>
  );
}

const meta = {
  title: 'Layouts/SwipeableCell',
  component: SwipeableCellDemo,
  args: {
    onAction: fn(),
  },
} satisfies Meta<typeof SwipeableCellDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const BothSides: Story = {
  args: {
    withLeftActions: true,
  },
};
