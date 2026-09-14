import { fn } from 'storybook/test';

import { IconButton } from '@onekeyhq/components/src/actions/IconButton';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const VARIANTS = ['secondary', 'tertiary', 'primary', 'destructive'] as const;

const SIZES = ['small', 'medium', 'large'] as const;

const ICONS = [
  'Copy3Outline',
  'PencilOutline',
  'DeleteOutline',
  'RefreshCcwOutline',
  'SearchOutline',
  'SendOutline',
  'GlobusOutline',
] as const;

const meta = {
  title: 'Actions/IconButton',
  component: IconButton,
  args: {
    icon: 'Copy3Outline',
    variant: 'secondary',
    size: 'medium',
    disabled: false,
    loading: false,
    onPress: fn(),
  },
  argTypes: {
    icon: { control: 'select', options: ICONS },
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: SIZES },
  },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <XStack gap="$4" alignItems="center">
      {VARIANTS.map((v) => (
        <IconButton {...args} key={v} variant={v} />
      ))}
    </XStack>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <XStack gap="$4" alignItems="center">
      {SIZES.map((s) => (
        <IconButton {...args} key={s} size={s} />
      ))}
    </XStack>
  ),
};

export const WithTooltip: Story = {
  args: { title: 'Copy address' },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};
