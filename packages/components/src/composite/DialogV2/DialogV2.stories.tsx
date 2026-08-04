import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { DialogV2 } from '@onekeyhq/components/src/composite/DialogV2';
import { Input } from '@onekeyhq/components/src/forms/Input';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// The upstream skin is transcribed as-is, so these stories are for judging how
// that default actually behaves with real product content — not for matching the
// current app dialog.
//
// On the iOS shell the same stories drive the native engine instead: the
// Expo UI bottom sheet (SDK 56), where presentation is owned by the system.

const LONG_TEXT = [
  'This wallet will be removed from this device only. The recovery phrase is not stored on our servers and cannot be recovered by support.',
  'Anyone holding the recovery phrase keeps full control of the funds. Removing the wallet here does not move, freeze or invalidate any asset on chain.',
  'Pending transactions already broadcast will continue to settle. Their status will no longer be visible in this app once the wallet is gone.',
  'Address book entries, custom networks and token visibility settings that belong to this wallet are removed with it.',
  'Hardware wallets can be paired again at any time. Software wallets can only be restored from the recovery phrase.',
  'Confirm below once the recovery phrase has been verified as written down and stored somewhere safe.',
].join(' ');

function useDialogState() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  return { open, setOpen, handleOpen };
}

function Demo(props: ComponentProps<typeof DialogV2>) {
  const { open, setOpen, handleOpen } = useDialogState();
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open dialog</Button>
      <DialogV2 {...props} open={open} onOpenChange={setOpen} />
    </YStack>
  );
}

const meta = {
  title: 'Composite/DialogV2',
  component: DialogV2,
  args: {
    // Visibility is owned by the demo wrapper below, not by controls.
    open: false,
    onOpenChange: fn(),
    onConfirm: fn(),
    onCancel: fn(),
    title: 'Remove this wallet?',
    description:
      'It will be removed from this device. You can restore it later from the recovery phrase.',
    confirmText: 'Remove',
    cancelText: 'Cancel',
    dismissible: true,
    tone: 'default',
  },
  argTypes: {
    open: { table: { disable: true } },
    onOpenChange: { table: { disable: true } },
    tone: { control: 'inline-radio', options: ['default', 'destructive'] },
    dismissible: { control: 'boolean' },
  },
  render: Demo,
} satisfies Meta<typeof DialogV2>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The common case: a titled question with two actions. */
export const Confirm: Story = {};

/** Tone only tints the primary action; nothing else changes. */
export const Destructive: Story = {
  args: {
    tone: 'destructive',
  },
};

/**
 * Blocking. The escape key, the backdrop press and the close button are all off,
 * so the footer is the only way out — the shape a signing or force-update prompt
 * needs.
 */
export const Blocking: Story = {
  args: {
    title: 'Update required',
    description:
      'This version can no longer reach the network. Install the update to continue.',
    dismissible: false,
    confirmText: 'Update now',
    cancelText: undefined,
  },
};

function WithInputDemo(props: ComponentProps<typeof DialogV2>) {
  const { open, setOpen, handleOpen } = useDialogState();
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open dialog</Button>
      <DialogV2 {...props} open={open} onOpenChange={setOpen}>
        <Input placeholder="Wallet name" />
      </DialogV2>
    </YStack>
  );
}

/** Mixed content: an app form control sitting inside the upstream frame. */
export const WithInput: Story = {
  args: {
    title: 'Rename wallet',
    description: 'Only you can see this name.',
    confirmText: 'Save',
  },
  render: WithInputDemo,
};

function LongContentDemo(props: ComponentProps<typeof DialogV2>) {
  const { open, setOpen, handleOpen } = useDialogState();
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open dialog</Button>
      <DialogV2 {...props} open={open} onOpenChange={setOpen}>
        {LONG_TEXT}
      </DialogV2>
    </YStack>
  );
}

/**
 * Content taller than the viewport. The upstream popup sets no max height and no
 * overflow, so this is what the stock component does — worth seeing before
 * deciding whether to add scrolling.
 */
export const LongContent: Story = {
  args: {
    title: 'Before you remove it',
    description: undefined,
    tone: 'destructive',
  },
  render: LongContentDemo,
};

function StackedDemo(props: ComponentProps<typeof DialogV2>) {
  const { open, setOpen, handleOpen } = useDialogState();
  const nested = useDialogState();
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open dialog</Button>
      <DialogV2 {...props} open={open} onOpenChange={setOpen}>
        <Button onPress={nested.handleOpen}>Show recovery phrase</Button>
        <DialogV2
          open={nested.open}
          onOpenChange={nested.setOpen}
          title="Recovery phrase"
          description="Write these words down in order and keep them offline."
          confirmText="Done"
        />
      </DialogV2>
    </YStack>
  );
}

/**
 * A dialog opened from inside another. The nested one suppresses its own backdrop
 * so the parent stays visible behind it, and escape closes only the top one.
 */
export const Stacked: Story = {
  args: {
    title: 'Wallet settings',
    description: 'Manage what this device keeps for this wallet.',
    confirmText: undefined,
    cancelText: 'Close',
  },
  render: StackedDemo,
};
