import type { ComponentProps } from 'react';
import { fn } from 'storybook/test';

import { DescriptionList } from '@onekeyhq/components/src/content/DescriptionList';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';


type IGap = ComponentProps<typeof DescriptionList>['gap'];

// The transaction-details idiom: Key on the left, Value on the right. Value
// takes optional icon/iconAfter and becomes pressable (hover opacity) when
// onPress is set — the copy-txid row below.
// The gap default mirrors the styled frame's own default: passing an explicit
// `gap={undefined}` would override (drop) it rather than fall back to it.
function TransactionDetailsDemo({
  onCopyPress,
  gap = '$4',
}: {
  onCopyPress: () => void;
  gap?: IGap;
}) {
  return (
    <DescriptionList maxWidth={360} gap={gap}>
      <DescriptionList.Item>
        <DescriptionList.Item.Key>Network</DescriptionList.Item.Key>
        <DescriptionList.Item.Value>Bitcoin</DescriptionList.Item.Value>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Item.Key>Amount</DescriptionList.Item.Key>
        <DescriptionList.Item.Value>0.05 BTC</DescriptionList.Item.Value>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Item.Key>Network fee</DescriptionList.Item.Key>
        <DescriptionList.Item.Value>0.00012 BTC</DescriptionList.Item.Value>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Item.Key>Status</DescriptionList.Item.Key>
        <DescriptionList.Item.Value icon="CheckRadioSolid">
          Confirmed
        </DescriptionList.Item.Value>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Item.Key>Transaction ID</DescriptionList.Item.Key>
        <DescriptionList.Item.Value
          iconAfter="Copy3Outline"
          onPress={onCopyPress}
        >
          4a5e1e…33fd7
        </DescriptionList.Item.Value>
      </DescriptionList.Item>
    </DescriptionList>
  );
}

const meta = {
  title: 'Content/DescriptionList',
  component: TransactionDetailsDemo,
  args: {
    onCopyPress: fn(),
  },
} satisfies Meta<typeof TransactionDetailsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Dense: Story = {
  args: {
    gap: '$2.5',
  },
};
