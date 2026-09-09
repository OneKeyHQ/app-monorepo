import { Spinner } from '@onekeyhq/components/src/primitives/Spinner';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const meta = {
  title: 'Primitives/Spinner',
  component: Spinner,
  args: {
    size: 'small',
  },
  argTypes: {
    size: { control: 'select', options: ['small', 'large'] },
    color: {
      control: 'select',
      options: ['$icon', '$iconSuccess', '$iconCritical', '$textInteractive'],
    },
  },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <XStack gap="$6" alignItems="center">
      <Spinner {...args} size="small" />
      <Spinner {...args} size="large" />
    </XStack>
  ),
};
