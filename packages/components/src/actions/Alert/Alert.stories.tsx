import { fn } from 'storybook/test';

import { Alert } from '@onekeyhq/components/src/actions/Alert';
import type { IAlertType } from '@onekeyhq/components/src/actions/Alert';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// 'caution' is omitted from the showcase row: it renders the default surface
// with a critical icon, so it reads as a duplicate. It stays selectable in
// the Playground control.
const SHOWCASE_TYPES: IAlertType[] = [
  'default',
  'info',
  'success',
  'warning',
  'critical',
  'danger',
];

const ALL_TYPES: IAlertType[] = [...SHOWCASE_TYPES, 'caution'];

const meta = {
  title: 'Actions/Alert',
  component: Alert,
  args: {
    type: 'info',
    title: 'New version available',
    description: 'Update now to get the latest security patches.',
    icon: 'InfoCircleOutline',
    closable: false,
    onClose: fn(),
  },
  argTypes: {
    type: { control: 'select', options: ALL_TYPES },
    icon: {
      control: 'select',
      options: ['InfoCircleOutline', 'ErrorOutline', 'ShieldCheckDoneOutline'],
    },
    title: { control: 'text' },
    description: { control: 'text' },
  },
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllTypes: Story = {
  render: (args) => (
    <YStack gap="$3">
      {SHOWCASE_TYPES.map((t) => (
        <Alert {...args} key={t} type={t} title={t} />
      ))}
    </YStack>
  ),
};

export const WithActions: Story = {
  args: {
    type: 'warning',
    title: 'Backup not verified',
    description: 'Verify your recovery phrase to secure this wallet.',
    icon: 'ShieldCheckDoneOutline',
    action: {
      primary: 'Verify',
      onPrimaryPress: fn(),
      secondary: 'Later',
      onSecondaryPress: fn(),
    },
  },
};

export const Closable: Story = {
  args: { closable: true },
};
