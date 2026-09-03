import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { Slider } from '@onekeyhq/components/src/forms/Slider';
import type { ISliderProps } from '@onekeyhq/components/src/forms/Slider';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Slider is used controlled everywhere in the app (fee rate, slippage), so
// stories go through this stateful wrapper, which also shows the live value.
function ControlledSlider({
  value: initialValue = 50,
  onChange,
  ...props
}: ISliderProps) {
  const [value, setValue] = useState(initialValue);
  const handleChange = useCallback(
    (v: number) => {
      setValue(v);
      onChange?.(v);
    },
    [onChange],
  );
  return (
    <YStack gap="$3" minWidth={240}>
      <Slider {...props} value={value} onChange={handleChange} />
      <SizableText size="$bodyMd" color="$textSubdued">
        value: {value}
      </SizableText>
    </YStack>
  );
}

const meta = {
  title: 'Forms/Slider',
  component: ControlledSlider,
  args: {
    min: 0,
    max: 100,
    step: 1,
    value: 50,
    disabled: false,
    onChange: fn(),
  },
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof ControlledSlider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Segmented: Story = {
  args: { segments: 4, step: 25 },
};

export const Disabled: Story = {
  args: { disabled: true },
};
