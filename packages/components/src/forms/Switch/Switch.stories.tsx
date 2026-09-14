import { fn } from 'storybook/test';

import { Switch } from '@onekeyhq/components/src/forms/Switch';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const SIZES = ['extraSmall', 'small', 'large'] as const;

const meta = {
  title: 'Forms/Switch',
  component: Switch,
  args: {
    size: 'large',
    disabled: false,
    // Uncontrolled so toggling works straight from the canvas without a
    // wrapper component.
    isUncontrolled: true,
    defaultChecked: true,
    onChange: fn(),
  },
  argTypes: {
    size: { control: 'select', options: SIZES },
    disabled: { control: 'boolean' },
    defaultChecked: { control: 'boolean' },
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <XStack gap="$4" alignItems="center">
      {SIZES.map((s) => (
        <Switch {...args} key={s} size={s} />
      ))}
    </XStack>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <XStack gap="$4" alignItems="center">
      <Switch {...args} disabled defaultChecked={false} />
      <Switch {...args} disabled defaultChecked />
    </XStack>
  ),
};
