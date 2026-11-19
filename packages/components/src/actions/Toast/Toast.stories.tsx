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
// trigger button and forward the story args to the call. The preview
// decorator mounts the toast host, which hands the cards to the platform
// renderer — the same contract the app provides in FullWindowOverlayContainer.
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

const LONG_MESSAGE =
  'The network is congested, so this transfer can take longer than usual. Keep the app open until the confirmation arrives; you can follow the progress in the activity list at any time.';

function ActionsTrigger({ label, method, ...toastProps }: IToastTriggerProps) {
  const handlePress = useCallback(() => {
    Toast[method]({
      ...toastProps,
      actions: {
        testID: 'toast-story-action',
        variant: 'primary',
        label: 'Go to settings',
      },
    });
  }, [method, toastProps]);
  return (
    <Button alignSelf="flex-start" onPress={handlePress}>
      {label}
    </Button>
  );
}

function TertiaryActionTrigger({
  label,
  method,
  ...toastProps
}: IToastTriggerProps) {
  const handlePress = useCallback(() => {
    Toast[method]({
      ...toastProps,
      actionsAlign: 'left',
      actions: {
        testID: 'toast-story-action',
        variant: 'tertiary',
        label: 'View',
      },
    });
  }, [method, toastProps]);
  return (
    <Button alignSelf="flex-start" onPress={handlePress}>
      {label}
    </Button>
  );
}

function StackTrigger({ label, ...toastProps }: IToastTriggerProps) {
  const handlePress = useCallback(() => {
    METHODS.slice(0, 4).forEach((m, index) => {
      Toast[m]({
        ...toastProps,
        title: `${toastProps.title} ${index + 1}`,
        message: index === 1 ? LONG_MESSAGE : toastProps.message,
      });
    });
  }, [toastProps]);
  return (
    <Button alignSelf="flex-start" onPress={handlePress}>
      {label}
    </Button>
  );
}

export const WithAction: Story = {
  render: (args) => <ActionsTrigger {...args} />,
  args: {
    label: 'Show toast with action',
    method: 'warning',
    title: 'Copy may fail',
    message: 'Allow clipboard access in system settings.',
  },
};

export const WithTertiaryAction: Story = {
  render: (args) => <TertiaryActionTrigger {...args} />,
  args: {
    label: 'Show toast with left action',
    method: 'success',
    title: 'Image saved',
    message: undefined,
  },
};

export const LongText: Story = {
  args: {
    label: 'Show long toast',
    method: 'error',
    title:
      'The transaction could not be broadcast because the selected node rejected it',
    message: `${LONG_MESSAGE}\nSecond paragraph after a line break.`,
  },
};

export const TitleOnly: Story = {
  args: {
    label: 'Show title only',
    method: 'success',
    title: 'Copied',
    message: undefined,
  },
};

export const Stacked: Story = {
  render: (args) => <StackTrigger {...args} />,
  args: {
    label: 'Show four toasts',
    title: 'Queued',
  },
};
