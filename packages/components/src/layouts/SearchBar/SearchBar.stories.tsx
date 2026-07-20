import { fn } from 'storybook/test';

import { SearchBar } from '@onekeyhq/components/src/layouts/SearchBar';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Uncontrolled by default: SearchBar manages its own value, shows the clear
// add-on once text is entered, and fires onSearchTextChange debounced
// (300ms) — watch the Actions panel while typing. The default placeholder
// comes from intl (global_search).
const meta = {
  title: 'Layouts/SearchBar',
  component: SearchBar,
  args: {
    onSearchTextChange: fn(),
  },
  argTypes: {
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    debounceInterval: { control: 'number' },
    placeholder: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <YStack maxWidth={360}>
        <Story />
      </YStack>
    ),
  ],
} satisfies Meta<typeof SearchBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const CustomPlaceholder: Story = {
  args: {
    placeholder: 'Search tokens',
  },
};

export const Sizes: Story = {
  render: (args) => (
    <YStack gap="$4">
      <SearchBar {...args} size="small" placeholder="small" />
      <SearchBar {...args} size="medium" placeholder="medium" />
      <SearchBar {...args} size="large" placeholder="large" />
    </YStack>
  ),
};
