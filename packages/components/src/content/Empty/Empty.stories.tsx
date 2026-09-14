import { fn } from 'storybook/test';

import { Empty } from '@onekeyhq/components/src/content/Empty';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Illustration names actually used by the app's empty states
// (packages/kit/src/components/Empty/*).
const ILLUSTRATIONS = [
  'QuestionMark',
  'WalletAdd',
  'Nft',
  'BookPencil',
  'Coins',
] as const;

const meta = {
  title: 'Content/Empty',
  component: Empty,
  args: {
    illustration: 'QuestionMark',
    title: 'No Results',
    description: 'Try a different keyword or check the spelling.',
  },
  argTypes: {
    illustration: { control: 'select', options: ILLUSTRATIONS },
    title: { control: 'text' },
    description: { control: 'text' },
  },
} satisfies Meta<typeof Empty>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithAction: Story = {
  args: {
    illustration: 'WalletAdd',
    title: 'No Wallet',
    description: 'Create or import a wallet to get started.',
    buttonProps: {
      children: 'Create Wallet',
      onPress: fn(),
    },
  },
};

// Icon-based variant (SearchOutline at $16, $iconSubdued) — the lighter
// alternative to a full illustration.
export const WithIcon: Story = {
  args: {
    illustration: undefined,
    icon: 'SearchOutline',
    title: 'No transactions yet',
    description: 'Your transaction history will appear here.',
  },
};
