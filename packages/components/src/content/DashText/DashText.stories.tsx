import { DashText } from '@onekeyhq/components/src/content/DashText';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Text with a dashed underline — the "this term has an explanation" idiom.
// With `tooltip` set it wraps in a Tooltip on gtMd and a Popover sheet on
// smaller/native screens (tap the text there).
const meta = {
  title: 'Content/DashText',
  component: DashText,
  args: {
    children: 'Est. network fee',
    size: '$bodyMd',
  },
  argTypes: {
    children: { control: 'text' },
    tooltip: { control: 'text' },
    dashLength: { control: 'number' },
    dashGap: { control: 'number' },
  },
} satisfies Meta<typeof DashText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// Hover (web) or tap (native sheet) to see the explanation.
export const WithTooltip: Story = {
  args: {
    children: 'Slippage',
    tooltip:
      'The maximum price movement you accept between quoting and execution.',
  },
};
