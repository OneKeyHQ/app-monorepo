import { fn } from 'storybook/test';

import { Checkbox } from '@onekeyhq/components/src/forms/Checkbox';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Checkbox.Group deliberately has no story: it has zero production call sites
// (only the frozen kit Gallery demo) and its ListView collapses inside
// unbounded containers on native — deletion candidate, not documentation
// material.
const meta = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  args: {
    label: 'Back up my wallet',
    description: '',
    disabled: false,
    // Uncontrolled so toggling works straight from the canvas without a
    // wrapper component.
    isUncontrolled: true,
    defaultChecked: false,
    onChange: fn(),
  },
  argTypes: {
    label: { control: 'text' },
    description: { control: 'text' },
    disabled: { control: 'boolean' },
    defaultChecked: { control: 'boolean' },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithDescription: Story = {
  args: {
    label: 'Back up my wallet',
    description:
      'I understand that if I lose my recovery phrase, I cannot access my funds.',
  },
};

export const AllStates: Story = {
  render: (args) => (
    <YStack>
      <Checkbox
        {...args}
        isUncontrolled={false}
        value={false}
        label="Unchecked"
      />
      <Checkbox {...args} isUncontrolled={false} value label="Checked" />
      <Checkbox
        {...args}
        isUncontrolled={false}
        value="indeterminate"
        label="Indeterminate"
      />
      <Checkbox
        {...args}
        isUncontrolled={false}
        value={false}
        disabled
        label="Disabled unchecked"
      />
      <Checkbox
        {...args}
        isUncontrolled={false}
        value
        disabled
        label="Disabled checked"
      />
    </YStack>
  ),
};
