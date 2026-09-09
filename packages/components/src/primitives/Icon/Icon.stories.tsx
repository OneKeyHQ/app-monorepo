import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Icon modules load lazily (dynamic import per name); an empty box holds the
// frame until the SVG arrives.
const meta = {
  title: 'Primitives/Icon',
  component: Icon,
  args: {
    name: 'BellOutline',
    size: '$8',
    color: '$icon',
  },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <XStack ai="center" gap="$4">
      <Icon {...args} name="SearchOutline" size="$4" />
      <Icon {...args} name="SearchOutline" size="$6" />
      <Icon {...args} name="SearchOutline" size="$8" />
      <Icon {...args} name="SearchOutline" size="$10" />
    </XStack>
  ),
};

export const Colors: Story = {
  render: (args) => (
    <XStack ai="center" gap="$4">
      <Icon {...args} color="$iconSubdued" />
      <Icon {...args} color="$iconActive" />
      <Icon {...args} color="$iconSuccess" />
      <Icon {...args} color="$iconCritical" />
    </XStack>
  ),
};
