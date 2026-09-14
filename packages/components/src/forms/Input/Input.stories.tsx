import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { Input } from '@onekeyhq/components/src/forms/Input';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Extracted to a named component so the `useState` hook lives in a real React
// component (rules-of-hooks) rather than an anonymous story `render` closure.
function ControlledInput(args: ComponentProps<typeof Input>) {
  const [value, setValue] = useState('onekey.so');
  const handleChangeText = useCallback((text: string) => setValue(text), []);
  return <Input {...args} value={value} onChangeText={handleChangeText} />;
}

// Input exercises the intl chain (useClipboard -> useIntl) provided by the
// preview's ConfigProvider decorator — it's the story that proves i18n context
// is wired, not just Tamagui theming.
const meta = {
  title: 'Forms/Input',
  component: Input,
  args: {
    size: 'medium',
    placeholder: 'Enter a value',
    error: false,
    readonly: false,
    disabled: false,
    allowClear: false,
  },
  argTypes: {
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    leftIconName: {
      control: 'select',
      options: [undefined, 'SearchOutline', 'PeopleOutline'],
    },
    error: { control: 'boolean' },
    readonly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    allowClear: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { defaultValue: '' },
};

export const Controlled: Story = {
  args: { allowClear: true },
  render: (args) => <ControlledInput {...args} />,
};

export const Sizes: Story = {
  render: (args) => (
    <YStack gap="$4" width={320}>
      <Input {...args} size="small" placeholder="small" />
      <Input {...args} size="medium" placeholder="medium" />
      <Input {...args} size="large" placeholder="large" />
    </YStack>
  ),
};

export const WithLeftIcon: Story = {
  args: { leftIconName: 'SearchOutline', placeholder: 'Search' },
};

export const WithAddOns: Story = {
  args: {
    addOns: [{ iconName: 'ArrowRightOutline', onPress: fn() }],
  },
};

export const Error: Story = {
  args: { error: true, defaultValue: 'invalid value' },
};

export const Readonly: Story = {
  args: { readonly: true, defaultValue: 'read only' },
};
