import { fn } from 'storybook/test';

import { Button } from '@onekeyhq/components/src/primitives/Button';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const VARIANTS = [
  'secondary',
  'tertiary',
  'primary',
  'destructive',
  'accent',
  'link',
] as const;

const SIZES = ['small', 'medium', 'large'] as const;

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: {
    children: 'Button',
    variant: 'secondary',
    size: 'medium',
    disabled: false,
    loading: false,
    onPress: fn(),
  },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: SIZES },
    icon: {
      control: 'select',
      options: [undefined, 'PlusCircleOutline', 'ArrowRightOutline'],
    },
    iconAfter: {
      control: 'select',
      options: [undefined, 'PlusCircleOutline', 'ArrowRightOutline'],
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <XStack gap="$4" flexWrap="wrap">
      {VARIANTS.map((v) => (
        <Button {...args} key={v} variant={v}>
          {v}
        </Button>
      ))}
    </XStack>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <XStack gap="$4" alignItems="center" flexWrap="wrap">
      {SIZES.map((s) => (
        <Button {...args} key={s} size={s}>
          {s}
        </Button>
      ))}
    </XStack>
  ),
};

export const WithIcon: Story = {
  args: { icon: 'PlusCircleOutline', children: 'Add wallet' },
};

export const IconAfter: Story = {
  args: { iconAfter: 'ArrowRightOutline', children: 'Continue' },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const AllVariantsAndSizes: Story = {
  render: (args) => (
    <YStack gap="$4">
      {SIZES.map((s) => (
        <XStack key={s} gap="$4" flexWrap="wrap" alignItems="center">
          {VARIANTS.map((v) => (
            <Button {...args} key={`${s}-${v}`} size={s} variant={v}>
              {v}
            </Button>
          ))}
        </XStack>
      ))}
    </YStack>
  ),
};
