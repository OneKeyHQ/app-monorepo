import { ClassicDevice } from '.';

import { XStack } from '../../primitives';

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
    // The union type (scene names | animation contract) defeats docgen's
    // control inference, so declare the scene radio explicitly; the contract
    // object is a code-level API, not a controls-panel one.
    animation: {
      control: 'radio',
      options: ['confirm', 'enterPin', 'enterPassphrase'],
    },
    screenContent: { control: false },
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

// One component, one `animation` prop: confirm (3s loop), enterPin /
// enterPassphrase (5.6s shared entry schedule). Switching remounts and
// restarts the loop.
export const Animations: Story = {
  args: { animation: 'confirm' },
};
