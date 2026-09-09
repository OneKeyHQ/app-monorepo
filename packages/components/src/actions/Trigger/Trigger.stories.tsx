import { fn } from 'storybook/test';

import { Trigger } from '@onekeyhq/components/src/actions/Trigger';
import { Button } from '@onekeyhq/components/src/primitives/Button';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const CHILD_BUTTON = <Button>Open menu</Button>;

const CHILD_WITH_OWN_PRESS = <Button onPress={fn()}>Both handlers fire</Button>;

// Wraps exactly one pressable element and composes its own onPress
// with the child's handler (Popover/Select anchors mount through it).
const meta = {
  title: 'Actions/Trigger',
  component: Trigger,
  args: {
    onPress: fn(),
    children: CHILD_BUTTON,
  },
} satisfies Meta<typeof Trigger>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

// The child keeps its own onPress; Trigger fires both.
export const ComposedPress: Story = {
  args: {
    children: CHILD_WITH_OWN_PRESS,
  },
};
