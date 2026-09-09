import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { DatePicker } from '@onekeyhq/components/src/composite/DatePicker';
import type {
  IDateRange,
  IDateRangePreset,
} from '@onekeyhq/components/src/composite/DatePicker';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Fixed dates keep the opened calendar deterministic for screenshots.
const INITIAL_DATE = new Date(2026, 6, 12);
const INITIAL_RANGE: IDateRange = {
  start: new Date(2026, 6, 1),
  end: new Date(2026, 6, 15),
};

const RANGE_PRESETS: IDateRangePreset[] = [
  {
    label: 'First week',
    getRange: () => ({
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 7),
    }),
  },
  {
    label: 'Full month',
    getRange: () => ({
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 31),
    }),
  },
];

function SingleDemo({ onChange }: { onChange?: (date: Date | null) => void }) {
  const [value, setValue] = useState<Date | null>(INITIAL_DATE);
  const handleChange = useCallback(
    (date: Date | null) => {
      setValue(date);
      onChange?.(date);
    },
    [onChange],
  );
  return <DatePicker value={value} onChange={handleChange} />;
}

function RangeDemo({ onChange }: { onChange?: (range: IDateRange) => void }) {
  const [value, setValue] = useState<IDateRange>(INITIAL_RANGE);
  const handleChange = useCallback(
    (range: IDateRange) => {
      setValue(range);
      onChange?.(range);
    },
    [onChange],
  );
  return (
    <DatePicker.Range
      value={value}
      presets={RANGE_PRESETS}
      onChange={handleChange}
    />
  );
}

function MonthDemo({ onChange }: { onChange?: (date: Date | null) => void }) {
  const [value, setValue] = useState<Date | null>(INITIAL_DATE);
  const handleChange = useCallback(
    (date: Date | null) => {
      setValue(date);
      onChange?.(date);
    },
    [onChange],
  );
  return <DatePicker.Month value={value} onChange={handleChange} />;
}

function YearDemo({ onChange }: { onChange?: (date: Date | null) => void }) {
  const [value, setValue] = useState<Date | null>(INITIAL_DATE);
  const handleChange = useCallback(
    (date: Date | null) => {
      setValue(date);
      onChange?.(date);
    },
    [onChange],
  );
  return <DatePicker.Year value={value} onChange={handleChange} />;
}

// Controlled popover pickers over a pure-JS calendar hook library (see the
// DatePickerProvider import in the component). The overlay is the same
// Popover/portal contract the Dialog stories verify; intl supplies the trigger
// placeholder and month/weekday names. The Range picker shows its presets
// sidebar on gtMd only.
const meta = {
  title: 'Composite/DatePicker',
  component: DatePicker,
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
} satisfies Meta<typeof DatePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => <SingleDemo onChange={args.onChange} />,
};

export const Range: Story = {
  render: () => <RangeDemo />,
};

export const Month: Story = {
  render: () => <MonthDemo />,
};

export const Year: Story = {
  render: () => <YearDemo />,
};
