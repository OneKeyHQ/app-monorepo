import type { ComponentProps, ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { DialogV2 } from '@onekeyhq/components/src/composite/DialogV2';
import { Input } from '@onekeyhq/components/src/forms/Input';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// DialogV2 is a bare presentation shell — backdrop, face and motion on web,
// the system sheet on native; it ships no header, footer or actions, only
// the content-inset contract (24pt sides, safe-area bottom). Each story
// composes the entire content, so together they double as the reference
// for what a caller now owns.

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
  const handleClose = useCallback(() => setOpen(false), []);
  return { open, setOpen, handleOpen, handleClose };
}

/**
 * The composition the shell used to build in: heading, subdued description,
 * and a trailing action row. Now caller-side on purpose, so the stories
 * assemble it from these two pieces. No padding here — the shell's own
 * content inset (24pt sides, safe-area bottom) is the only spacing.
 */
function Body({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <SizableText size="$headingLg">{title}</SizableText>
        {description ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {description}
          </SizableText>
        ) : null}
      </YStack>
      {children}
    </YStack>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <XStack gap="$2.5" jc="flex-end">
      {children}
    </XStack>
  );
}

function ComposedDemo(props: ComponentProps<typeof DialogV2>) {
  const { open, setOpen, handleOpen, handleClose } = useDialogState();
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open dialog</Button>
      <DialogV2 {...props} open={open} onOpenChange={setOpen}>
        <Body
          title="Remove this wallet?"
          description="It will be removed from this device. You can restore it later from the recovery phrase."
        >
          <Footer>
            <Button onPress={handleClose}>Cancel</Button>
            <Button variant="destructive" onPress={handleClose}>
              Remove
            </Button>
          </Footer>
        </Body>
      </DialogV2>
    </YStack>
  );
}

const meta = {
  title: 'Composite/DialogV2',
  component: DialogV2,
  args: {
    // Visibility is owned by the demo wrappers below, not by controls.
    open: false,
    onOpenChange: fn(),
    dismissible: true,
  },
  argTypes: {
    open: { table: { disable: true } },
    onOpenChange: { table: { disable: true } },
    dismissible: { control: 'boolean' },
  },
  render: ComposedDemo,
} satisfies Meta<typeof DialogV2>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The common case, fully caller-composed: heading, description, two actions. */
export const Composed: Story = {};

function BlockingDemo(props: ComponentProps<typeof DialogV2>) {
  const { open, setOpen, handleOpen, handleClose } = useDialogState();
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open dialog</Button>
      <DialogV2 {...props} open={open} onOpenChange={setOpen}>
        <Body
          title="Update required"
          description="This version can no longer reach the network. Install the update to continue."
        >
          <Footer>
            <Button variant="primary" onPress={handleClose}>
              Update now
            </Button>
          </Footer>
        </Body>
      </DialogV2>
    </YStack>
  );
}

/**
 * Blocking. The escape key, the backdrop press and interactive dismissal are
 * all off, so the composed action is the only way out — the shape a signing
 * or force-update prompt needs.
 */
export const Blocking: Story = {
  args: {
    dismissible: false,
  },
  render: BlockingDemo,
};

function WithInputDemo(props: ComponentProps<typeof DialogV2>) {
  const { open, setOpen, handleOpen, handleClose } = useDialogState();
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open dialog</Button>
      <DialogV2 {...props} open={open} onOpenChange={setOpen}>
        <Body title="Rename wallet" description="Only you can see this name.">
          <Input placeholder="Wallet name" />
          <Footer>
            <Button variant="primary" onPress={handleClose}>
              Save
            </Button>
          </Footer>
        </Body>
      </DialogV2>
    </YStack>
  );
}

/** Mixed content: an app form control between the composed header and footer. */
export const WithInput: Story = {
  render: WithInputDemo,
};

function LongContentDemo(props: ComponentProps<typeof DialogV2>) {
  const { open, setOpen, handleOpen } = useDialogState();
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open dialog</Button>
      <DialogV2 {...props} open={open} onOpenChange={setOpen}>
        <Body title="Before you remove it">
          <SizableText size="$bodyMd">{LONG_TEXT}</SizableText>
        </Body>
      </DialogV2>
    </YStack>
  );
}

/**
 * Content taller than the viewport. The shell sets no max height and no
 * overflow — height follows content on both engines — so this is where that
 * policy runs out; worth seeing before deciding whether content should scroll.
 */
export const LongContent: Story = {
  render: LongContentDemo,
};

function StackedDemo(props: ComponentProps<typeof DialogV2>) {
  const { open, setOpen, handleOpen, handleClose } = useDialogState();
  const nested = useDialogState();
  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open dialog</Button>
      <DialogV2 {...props} open={open} onOpenChange={setOpen}>
        <Body
          title="Wallet settings"
          description="Manage what this device keeps for this wallet."
        >
          <Button onPress={nested.handleOpen}>Show recovery phrase</Button>
          <Footer>
            <Button onPress={handleClose}>Close</Button>
          </Footer>
        </Body>
        <DialogV2 open={nested.open} onOpenChange={nested.setOpen}>
          <Body
            title="Recovery phrase"
            description="Write these words down in order and keep them offline."
          >
            <Footer>
              <Button variant="primary" onPress={nested.handleClose}>
                Done
              </Button>
            </Footer>
          </Body>
        </DialogV2>
      </DialogV2>
    </YStack>
  );
}

/**
 * A dialog opened from inside another. The nested one suppresses its own backdrop
 * so the parent stays visible behind it, and escape closes only the top one.
 */
export const Stacked: Story = {
  render: StackedDemo,
};
