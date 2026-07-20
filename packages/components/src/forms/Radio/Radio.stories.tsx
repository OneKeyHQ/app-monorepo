import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { Radio } from '@onekeyhq/components/src/forms/Radio';
import type { IRadioProps } from '@onekeyhq/components/src/forms/Radio';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const FEE_OPTIONS: IRadioProps['options'] = [
  { label: 'Slow', description: '~10 min · lowest fee', value: 'slow' },
  { label: 'Normal', description: '~3 min · recommended', value: 'normal' },
  { label: 'Fast', description: '~30 sec · highest fee', value: 'fast' },
  {
    label: 'Custom',
    description: 'Set your own fee rate',
    value: 'custom',
    disabled: true,
  },
];

const PLAIN_OPTIONS: IRadioProps['options'] = [
  { label: 'Mainnet', value: 'mainnet' },
  { label: 'Testnet', value: 'testnet' },
];

// Radio's selected-state visuals compare option values against the controlled
// `value` prop (defaultValue alone never draws the filled ring), so every
// story goes through this stateful wrapper.
function ControlledRadio({
  value: initialValue,
  onChange,
  ...props
}: IRadioProps) {
  const [value, setValue] = useState(initialValue);
  const handleChange = useCallback(
    (v: string) => {
      setValue(v);
      onChange?.(v);
    },
    [onChange],
  );
  return <Radio {...props} value={value} onChange={handleChange} />;
}

const meta = {
  title: 'Forms/Radio',
  component: ControlledRadio,
  args: {
    options: FEE_OPTIONS,
    value: 'normal',
    orientation: 'vertical',
    disabled: false,
    onChange: fn(),
  },
  argTypes: {
    orientation: { control: 'select', options: ['vertical', 'horizontal'] },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof ControlledRadio>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Horizontal: Story = {
  args: {
    options: PLAIN_OPTIONS,
    value: 'mainnet',
    orientation: 'horizontal',
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};
