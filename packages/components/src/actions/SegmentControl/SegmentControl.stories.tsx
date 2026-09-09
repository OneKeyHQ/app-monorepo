import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { SegmentControl } from '@onekeyhq/components/src/actions/SegmentControl';
import type { ISegmentControlProps } from '@onekeyhq/components/src/actions/SegmentControl';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const PERIOD_OPTIONS: ISegmentControlProps['options'] = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' },
];

// SegmentControl is controlled-only (value + onChange), so every story goes
// through this stateful wrapper.
function ControlledSegmentControl({
  value: initialValue,
  onChange,
  ...props
}: ISegmentControlProps) {
  const [value, setValue] = useState(initialValue);
  const handleChange = useCallback(
    (v: string | number) => {
      setValue(v);
      onChange?.(v);
    },
    [onChange],
  );
  return <SegmentControl {...props} value={value} onChange={handleChange} />;
}

const meta = {
  title: 'Actions/SegmentControl',
  component: ControlledSegmentControl,
  args: {
    options: PERIOD_OPTIONS,
    value: '1d',
    fullWidth: false,
    onChange: fn(),
  },
  argTypes: {
    fullWidth: { control: 'boolean' },
  },
} satisfies Meta<typeof ControlledSegmentControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const FullWidth: Story = {
  args: { fullWidth: true },
};

// KNOWN GAP (verified 2026-07-12): option-level `disabled` is visual-only —
// it dims the segment and drops keyboard focus, but onPress still fires and
// selection moves. No production call site passes it today, so this story
// documents the trap rather than a supported state.
export const WithDisabledOption: Story = {
  args: {
    options: [
      { label: 'Market', value: 'market' },
      { label: 'Limit', value: 'limit' },
      { label: 'TWAP', value: 'twap', disabled: true },
    ],
    value: 'market',
  },
};
