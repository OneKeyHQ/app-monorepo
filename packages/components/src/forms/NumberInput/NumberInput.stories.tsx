import { useCallback, useState } from 'react';

import { NumberInput } from '@onekeyhq/components/src/forms/NumberInput';
import type { INumberInputProps } from '@onekeyhq/components/src/forms/NumberInput';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

function ControlledNumberInput(args: INumberInputProps) {
  const [value, setValue] = useState('14');
  const handleStep = useCallback(
    (direction: -1 | 1) =>
      setValue((current) => String((Number(current) || 0) + direction)),
    [],
  );
  return (
    <NumberInput
      {...args}
      value={value}
      onChangeText={setValue}
      onStep={handleStep}
    />
  );
}

const meta = {
  title: 'Forms/NumberInput',
  component: NumberInput,
  args: {
    accessibilityLabel: 'Period',
    size: 'medium',
    showControls: false,
    disabled: false,
    readonly: false,
    error: false,
  },
  argTypes: {
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    showControls: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    error: { control: 'boolean' },
  },
  render: (args) => <ControlledNumberInput {...args} />,
} satisfies Meta<typeof NumberInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithControls: Story = { args: { showControls: true } };

export const Small: Story = { args: { showControls: true, size: 'small' } };

export const Large: Story = { args: { showControls: true, size: 'large' } };

export const Disabled: Story = { args: { showControls: true, disabled: true } };
