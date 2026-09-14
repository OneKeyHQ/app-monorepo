import { fn } from 'storybook/test';

import { TextArea } from '@onekeyhq/components/src/forms/TextArea';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const SIZES = ['small', 'medium', 'large'] as const;

const meta = {
  title: 'Forms/TextArea',
  component: TextArea,
  args: {
    placeholder: 'Leave a note for the recipient (optional)',
    numberOfLines: 4,
    size: 'medium',
    disabled: false,
    editable: true,
    error: false,
    onChangeText: fn(),
  },
  argTypes: {
    size: { control: 'select', options: SIZES },
    placeholder: { control: 'text' },
    numberOfLines: { control: 'number' },
    disabled: { control: 'boolean' },
    editable: { control: 'boolean' },
    error: { control: 'boolean' },
  },
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithValue: Story = {
  args: {
    defaultValue:
      'Rent payment for July.\nPlease confirm once received — thanks!',
  },
};

export const Error: Story = {
  args: {
    error: true,
    defaultValue: 'This note exceeds the 200-character limit for OP_RETURN…',
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Managed by your organization' },
};
