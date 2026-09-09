import { useCallback } from 'react';

import { fn } from 'storybook/test';

import { Dialog } from '@onekeyhq/components/src/composite/Dialog';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { Input } from '@onekeyhq/components/src/forms/Input';
import { Button } from '@onekeyhq/components/src/primitives/Button';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const TONES = ['default', 'destructive', 'warning', 'success', 'info'] as const;

type IDialogTriggerProps = IDialogShowProps & { label: string };

// Dialog is an imperative API (Dialog.show), so stories render a trigger
// button and forward the story args to the call. The dialog mounts into the
// preview decorator's FULL_WINDOW_OVERLAY_PORTAL container — the same
// contract the app provides via FullWindowOverlayContainer.
function DialogTrigger({ label, ...dialogProps }: IDialogTriggerProps) {
  const handlePress = useCallback(() => {
    Dialog.show(dialogProps);
  }, [dialogProps]);
  return (
    <Button alignSelf="flex-start" onPress={handlePress}>
      {label}
    </Button>
  );
}

function ConfirmTrigger({ label, ...dialogProps }: IDialogTriggerProps) {
  const handlePress = useCallback(() => {
    Dialog.confirm(dialogProps);
  }, [dialogProps]);
  return (
    <Button alignSelf="flex-start" onPress={handlePress}>
      {label}
    </Button>
  );
}

const meta = {
  title: 'Composite/Dialog',
  component: DialogTrigger,
  args: {
    label: 'Open dialog',
    title: 'Enable notifications',
    description:
      'Get notified about account activity and important security updates.',
    icon: 'InfoCircleOutline',
    tone: 'default',
    showFooter: true,
    onConfirm: fn(),
    onCancel: fn(),
  },
  argTypes: {
    tone: { control: 'select', options: TONES },
    icon: {
      control: 'select',
      options: [
        'InfoCircleOutline',
        'ErrorOutline',
        'ShieldCheckDoneOutline',
        'QuestionmarkOutline',
      ],
    },
    label: { control: 'text' },
    title: { control: 'text' },
    description: { control: 'text' },
  },
} satisfies Meta<typeof DialogTrigger>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Destructive: Story = {
  args: {
    label: 'Remove wallet',
    title: 'Remove this wallet?',
    description:
      'Removing the wallet clears its local data. You can restore it later with the recovery phrase.',
    icon: 'ErrorOutline',
    tone: 'destructive',
    onConfirmText: 'Remove',
  },
};

export const WithCustomContent: Story = {
  args: {
    label: 'Rename account',
    title: 'Rename',
    icon: undefined,
    description: undefined,
    renderContent: <Input placeholder="Account name" autoFocus />,
    onConfirmText: 'Save',
  },
};

export const ConfirmOnly: Story = {
  render: (args) => <ConfirmTrigger {...args} />,
  args: {
    label: 'Confirm-only dialog',
    title: 'Backup complete',
    description: 'Your recovery phrase has been verified.',
    icon: 'ShieldCheckDoneOutline',
    tone: 'success',
  },
};
