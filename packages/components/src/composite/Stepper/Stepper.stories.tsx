import type { ComponentProps } from 'react';

import { Stepper } from '@onekeyhq/components/src/composite/Stepper';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// stepIndex is the only state: items before it render as done, the item at it
// as pending (spinner) — or failed when hasError — and items after it as
// inactive. Every item except the last draws the trailing progress bar.
const meta = {
  title: 'Composite/Stepper',
  component: Stepper,
  args: {
    stepIndex: 1,
    hasError: false,
  },
  argTypes: {
    stepIndex: { control: { type: 'number', min: 0, max: 3 } },
    hasError: { control: 'boolean' },
  },
} satisfies Meta<typeof Stepper>;

export default meta;

type Story = StoryObj<typeof meta>;

const renderBackupSteps = (args: ComponentProps<typeof Stepper>) => (
  <YStack maxWidth={360}>
    <Stepper {...args}>
      <Stepper.Item
        title="Create wallet"
        description="Generate a new recovery phrase on this device."
      />
      <Stepper.Item
        title="Back up"
        description="Write the 12 words down in order."
        badgeText="~2 min"
      />
      <Stepper.Item
        title="Verify"
        description="Re-enter two random words to confirm the backup."
      />
    </Stepper>
  </YStack>
);

export const Playground: Story = {
  render: renderBackupSteps,
};

export const Failed: Story = {
  args: {
    hasError: true,
  },
  render: renderBackupSteps,
};

export const Completed: Story = {
  args: {
    stepIndex: 3,
  },
  render: renderBackupSteps,
};
