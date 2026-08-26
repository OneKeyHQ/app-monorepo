import { ListEndIndicator } from '@onekeyhq/components/src/content/ListEndIndicator';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Line-dot-line footer that Market lists append when there is nothing
// more to load; the decorator bounds the row width like a list would.
const meta = {
  title: 'Content/ListEndIndicator',
  component: ListEndIndicator,
  decorators: [
    (Story) => (
      <YStack w={320}>
        <Story />
      </YStack>
    ),
  ],
} satisfies Meta<typeof ListEndIndicator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
