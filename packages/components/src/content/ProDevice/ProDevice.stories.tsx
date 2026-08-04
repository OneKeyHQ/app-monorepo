import { ProDevice } from '.';

import { XStack } from '../../primitives';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// PoC story: 1:1 code recreation of the Pro hardware device (Figma node
// 20320:27410). Native verification target: inset boxShadow with spread
// distances (the body rim) has no in-repo precedent.
const meta = {
  title: 'Content/ProDevice',
  component: ProDevice,
  args: { width: 350 },
  argTypes: {
    width: { control: { type: 'range', min: 80, max: 500, step: 1 } },
    // Same union-type docgen defeat as the Classic: declare the radio.
    animation: {
      control: 'radio',
      options: ['confirm', 'enterPin', 'enterPassphrase'],
    },
    screenContent: { control: false },
  },
} satisfies Meta<typeof ProDevice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <XStack gap="$4" alignItems="flex-start">
      <ProDevice width={80} />
      <ProDevice width={175} />
      <ProDevice width={260} />
    </XStack>
  ),
};

// One component, one `animation` prop: confirm (3.2s loop, same wall clock
// as the Classic confirm), enterPin / enterPassphrase (4.8s shared entry
// schedule on the touch cadence). Switching remounts and restarts the loop.
export const Animations: Story = {
  args: { animation: 'confirm' },
};
