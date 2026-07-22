import { useCallback } from 'react';

import { fn } from 'storybook/test';

import { Toast } from '@onekeyhq/components/src/actions/Toast';
import type { IToastProps } from '@onekeyhq/components/src/actions/Toast';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const METHODS = ['success', 'error', 'warning', 'message', 'loading'] as const;

type IToastMethod = (typeof METHODS)[number];

type IToastTriggerProps = IToastProps & {
  label: string;
  method: IToastMethod;
};

// Toast is an imperative API (Toast.success/error/…), so stories render a
// trigger button and forward the story args to the call. The toasts mount
// via the preview decorator's Toaster (sonner on web, backpackapp on
// native) — the same contract the app provides in FullWindowOverlayContainer.
function ToastTrigger({ label, method, ...toastProps }: IToastTriggerProps) {
  const handlePress = useCallback(() => {
    Toast[method](toastProps);
  }, [method, toastProps]);
  return (
    <Button alignSelf="flex-start" onPress={handlePress}>
      {label}
    </Button>
  );
}

// Toast.notification takes the same base props but renders the bell-style
// promo layout, so it gets its own trigger instead of joining METHODS.
function NotificationTrigger({
  label,
  method: _method,
  ...toastProps
}: IToastTriggerProps) {
  const handlePress = useCallback(() => {
    Toast.notification(toastProps);
  }, [toastProps]);
  return (
    <Button alignSelf="flex-start" onPress={handlePress}>
      {label}
    </Button>
  );
}

const meta = {
  title: 'Actions/Toast',
  component: ToastTrigger,
  args: {
    label: 'Show toast',
    method: 'success',
    title: 'Transaction sent',
    message: 'Usually confirms within a minute.',
    duration: 5000,
    onClose: fn(),
  },
  argTypes: {
    method: { control: 'select', options: METHODS },
    label: { control: 'text' },
    title: { control: 'text' },
    message: { control: 'text' },
    duration: { control: 'number' },
  },
} satisfies Meta<typeof ToastTrigger>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Presets: Story = {
  render: (args) => (
    <XStack gap="$3" flexWrap="wrap">
      {METHODS.map((m) => (
        <ToastTrigger {...args} key={m} method={m} label={m} />
      ))}
    </XStack>
  ),
};

export const Notification: Story = {
  render: (args) => <NotificationTrigger {...args} />,
  args: {
    label: 'Show notification',
    title: 'Price alert',
    message: 'BTC crossed $120,000 in the last hour.',
  },
};
