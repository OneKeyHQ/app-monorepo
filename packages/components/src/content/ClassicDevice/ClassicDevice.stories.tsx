import { ClassicDevice } from '.';

import { XStack } from '../../primitives';

import { ConfirmOnClassic } from './ConfirmOnClassic';
import { EnterPinOnClassic } from './EnterPinOnClassic';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// PoC story: 1:1 code recreation of the Classic hardware device
// (Figma node 20069:31306). Native shell is the verification target:
// multi inset boxShadow + rn-svg FeGaussianBlur have no in-repo precedent.
const meta = {
  title: 'Content/ClassicDevice',
  component: ClassicDevice,
  args: { width: 327 },
  argTypes: {
    width: { control: { type: 'range', min: 80, max: 500, step: 1 } },
  },
} satisfies Meta<typeof ClassicDevice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// Shrinking is the free direction: the transform minifies, so the SVG and the
// noise only get denser. Enlarging is where iOS/Android soften.
export const Sizes: Story = {
  render: () => (
    <XStack gap="$4" alignItems="flex-start">
      <ClassicDevice width={80} />
      <ClassicDevice width={160} />
      <ClassicDevice width={240} />
    </XStack>
  ),
};

// Confirm scene: skeleton screen, 3s loop of wake -> content fade-in ->
// physical OK press -> sleep.
export const Confirm: Story = {
  render: (args) => <ConfirmOnClassic width={args.width} />,
};

// Enter PIN scene: 5.6s loop of wake -> six OK presses filling diamonds ->
// check appears -> final confirming press -> sleep.
export const EnterPin: Story = {
  render: (args) => <EnterPinOnClassic width={args.width} />,
};
