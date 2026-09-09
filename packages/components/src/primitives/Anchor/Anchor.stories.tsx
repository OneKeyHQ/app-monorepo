import { Anchor } from '@onekeyhq/components/src/primitives/Anchor';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Web renders a real <a target="_blank">; native has no href and opens the
// URL through Linking.openURL on press. The trailing arrow indicator is on
// by default.
const meta = {
  title: 'Primitives/Anchor',
  component: Anchor,
  args: {
    children: 'OneKey Help Center',
    href: 'https://help.onekey.so',
    size: '$bodyLg',
  },
} satisfies Meta<typeof Anchor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const PlainLink: Story = {
  args: {
    showExternalIndicator: false,
  },
};

export const Colored: Story = {
  args: {
    color: '$textInfo',
  },
};
