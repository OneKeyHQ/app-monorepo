import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { SegmentSlider } from '@onekeyhq/components/src/composite/SegmentSlider';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Controlled slider with segment marks (the Perps leverage control). The top
// padding leaves room for the value bubble shown while dragging. Rendering
// lives in @onekeyfe/react-native-segment-slider on every platform.
function SegmentSliderDemo({
  initialValue = 40,
  segments = 4,
  min = 0,
  max = 100,
  snapTapToSegment = false,
  centerOrigin = false,
  disabled = false,
  onChange,
}: {
  initialValue?: number;
  segments?: number;
  min?: number;
  max?: number;
  snapTapToSegment?: boolean;
  centerOrigin?: boolean;
  disabled?: boolean;
  onChange?: (value: number) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const handleChange = useCallback(
    (next: number) => {
      setValue(next);
      onChange?.(next);
    },
    [onChange],
  );
  return (
    <YStack gap="$3" pt="$6">
      <SegmentSlider
        value={value}
        onChange={handleChange}
        segments={segments}
        min={min}
        max={max}
        snapTapToSegment={snapTapToSegment}
        centerOrigin={centerOrigin}
        disabled={disabled}
      />
      <SizableText size="$bodySm" color="$textSubdued">
        Value: {value}
      </SizableText>
    </YStack>
  );
}

const meta = {
  title: 'Composite/SegmentSlider',
  component: SegmentSliderDemo,
  args: {
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <YStack maxWidth={360}>
        <Story />
      </YStack>
    ),
  ],
} satisfies Meta<typeof SegmentSliderDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// A quick tap lands on the nearest segment mark; a drag stays free.
export const SnapTapToSegment: Story = {
  args: {
    snapTapToSegment: true,
  },
};

// Fill grows from the center: negative values fill left, positive fill right.
export const CenterOrigin: Story = {
  args: {
    centerOrigin: true,
    min: -100,
    max: 100,
    initialValue: 50,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    initialValue: 60,
  },
};
