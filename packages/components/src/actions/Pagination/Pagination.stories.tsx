import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { Pagination } from '@onekeyhq/components/src/actions/Pagination';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Pagination is controlled: the demo owns `current` and reports every change.
// The range collapses around the current page with DOTS ellipses; the chevron
// controls disable themselves at the ends.
function PaginationDemo({
  initial = 1,
  onChange,
  ...rest
}: {
  initial?: number;
  total: number;
  siblingCount?: number;
  showControls?: boolean;
  onChange?: (page: number) => void;
}) {
  const [current, setCurrent] = useState(initial);
  const handleChange = useCallback(
    (page: number) => {
      setCurrent(page);
      onChange?.(page);
    },
    [onChange],
  );
  return <Pagination {...rest} current={current} onChange={handleChange} />;
}

const meta = {
  title: 'Actions/Pagination',
  component: PaginationDemo,
  args: {
    total: 10,
    onChange: fn(),
  },
  argTypes: {
    total: { control: { type: 'number', min: 1, max: 100 } },
    siblingCount: { control: { type: 'number', min: 0, max: 3 } },
  },
} satisfies Meta<typeof PaginationDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// Starting mid-list shows the DOTS collapse on both sides.
export const ManyPages: Story = {
  args: {
    total: 42,
    initial: 21,
  },
};

export const WithoutControls: Story = {
  args: {
    total: 5,
    showControls: false,
  },
};
