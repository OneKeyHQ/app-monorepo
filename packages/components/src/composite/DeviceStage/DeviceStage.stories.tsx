import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// One dialog per hardware burst, content swapped in place. Switch `step` while
// the stage is open to judge the in-place transition — the point of the module
// is that consecutive device requests never close and reopen the surface.
//
// The stage is a fixed dark theater (the Wallet treatment): an opaque
// near-black face whatever the shell theme. The shell theme only changes the
// app behind the sheet.

function Demo(props: ComponentProps<typeof DeviceStage>) {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Present stage</Button>
      <DeviceStage {...props} open={open} onOpenChange={setOpen} />
    </YStack>
  );
}

const meta = {
  title: 'Composite/DeviceStage',
  component: DeviceStage,
  args: {
    // Visibility is owned by the demo wrapper, not by controls.
    open: false,
    onOpenChange: fn(),
    deviceType: 'classic',
    step: 'confirm',
    confirmContext: 'Send 0.1 ETH to 0x1234…abcd',
    locked: false,
  },
  argTypes: {
    open: { table: { disable: true } },
    onOpenChange: { table: { disable: true } },
    deviceType: {
      control: 'inline-radio',
      options: ['classic', 'pro', 'slate'],
    },
    step: {
      control: 'inline-radio',
      options: ['connecting', 'enterPin', 'enterPassphrase', 'confirm'],
    },
    locked: { control: 'boolean' },
  },
  render: Demo,
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The whole flow under manual control; drive `step` from the panel. */
export const Playground: Story = {};

/**
 * The blocking shape for steps that must not be broken off: no grabber, and
 * the backdrop, escape key and close button are all dead. To get out, flip
 * `locked` off in the panel and dismiss (web), or reload (device).
 */
export const Locked: Story = {
  args: {
    step: 'confirm',
    locked: true,
  },
};
