import { NetworkStatusBadge } from '@onekeyhq/components/src/content/NetworkStatusBadge';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Pure presentational badge — the netInfo/jotai wiring lives in kit's
// NetworkStatus wrapper, so `connected` fully drives this component.
// The XStack keeps the pill hugging its content instead of filling the row.
const meta = {
  title: 'Content/NetworkStatusBadge',
  component: NetworkStatusBadge,
  args: {
    connected: true,
  },
  decorators: [
    (Story) => (
      <XStack>
        <Story />
      </XStack>
    ),
  ],
} satisfies Meta<typeof NetworkStatusBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Offline: Story = {
  args: {
    connected: false,
  },
};

export const WithLatency: Story = {
  args: {
    badgeSize: 'lg',
    monoLabel: '23ms',
  },
};
