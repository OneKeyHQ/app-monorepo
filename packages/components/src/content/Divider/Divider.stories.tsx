import { Divider } from '@onekeyhq/components/src/content/Divider';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// A bare hairline is invisible on an empty canvas, so every story renders the
// divider between real content.
const meta = {
  title: 'Content/Divider',
  component: Divider,
} satisfies Meta<typeof Divider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <YStack gap="$3" maxWidth={360}>
      <SizableText>Wallet settings</SizableText>
      <Divider {...args} />
      <SizableText>Security</SizableText>
    </YStack>
  ),
};

export const Vertical: Story = {
  render: () => (
    <XStack gap="$3" alignItems="center">
      <SizableText size="$bodyMd">Slippage 0.5%</SizableText>
      <Divider vertical h="$4" />
      <SizableText size="$bodyMd">Fee $1.24</SizableText>
    </XStack>
  ),
};
