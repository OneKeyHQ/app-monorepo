import {
  Stack,
  XStack,
  YStack,
  ZStack,
} from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const BOXES = [
  { key: 'one', bg: '$bgInfoStrong' },
  { key: 'two', bg: '$bgSuccessStrong' },
  { key: 'three', bg: '$bgCautionStrong' },
] as const;

const ROW_BOXES = BOXES.map(({ key, bg }) => (
  <Stack key={key} w={48} h={48} bg={bg} borderRadius="$2" />
));

// ZStack children are absolutely positioned on top of each other;
// offset them to make the layering visible.
const LAYERED_BOXES = BOXES.map(({ key, bg }, index) => (
  <Stack
    key={key}
    w={56}
    h={56}
    bg={bg}
    borderRadius="$2"
    top={index * 16}
    left={index * 16}
  />
));

// Tamagui layout primitives — Stack is the base node, XStack/YStack
// preset the flex direction, ZStack overlays children.
const meta = {
  title: 'Primitives/Stack',
  component: XStack,
  args: {
    gap: '$3',
    p: '$3',
    borderWidth: 1,
    borderColor: '$borderSubdued',
    borderRadius: '$3',
    children: ROW_BOXES,
  },
} satisfies Meta<typeof XStack>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Column: Story = {
  render: (args) => <YStack {...args} />,
};

export const Layered: Story = {
  render: () => (
    <ZStack w={88} h={88}>
      {LAYERED_BOXES}
    </ZStack>
  ),
};
