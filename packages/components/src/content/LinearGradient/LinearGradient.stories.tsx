import { LinearGradient } from '@onekeyhq/components/src/content/LinearGradient';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const OCEAN_COLORS = ['#2ED3B7', '#4E7CFF'];

const SUNSET_COLORS = ['#FDB022', '#F97066'];

// expo-linear-gradient underneath (web support built in); children render
// inside the gradient surface.
const meta = {
  title: 'Content/LinearGradient',
  component: LinearGradient,
  args: {
    colors: OCEAN_COLORS,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    w: 240,
    h: 120,
    borderRadius: '$3',
  },
} satisfies Meta<typeof LinearGradient>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Horizontal: Story = {
  args: {
    colors: SUNSET_COLORS,
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
  },
};

export const WithContent: Story = {
  render: (args) => (
    <LinearGradient {...args} ai="center" jc="center">
      <SizableText size="$headingMd" color="#FFFFFF">
        Boost enabled
      </SizableText>
    </LinearGradient>
  ),
};
