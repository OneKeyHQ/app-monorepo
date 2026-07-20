import { PulseContainer } from '@onekeyhq/components/src/content/PulseContainer';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const AMOUNT_TEXT = <SizableText size="$heading2xl">$12,345.67</SizableText>;

// Opacity pulse for in-flight values (token balances while loading):
// `isActive` starts the fade loop, false snaps back to full opacity.
const meta = {
  title: 'Content/PulseContainer',
  component: PulseContainer,
  args: {
    isActive: true,
    children: AMOUNT_TEXT,
  },
} satisfies Meta<typeof PulseContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Idle: Story = {
  args: {
    isActive: false,
  },
};
