import { HardwareDevice } from '.';

import { XStack } from '../../primitives';

import type { IHardwareDeviceType } from '.';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Model-keyed entry point to the code-drawn replicas. The two shells are
// verified in their own stories; this one covers the routing.
const meta = {
  title: 'Content/HardwareDevice',
  component: HardwareDevice,
  args: { deviceType: 'pro', animation: 'confirm', width: 240 },
  argTypes: {
    deviceType: {
      control: 'radio',
      options: [
        'classic',
        'classic1s',
        'classicpure',
        'pro',
        'mini',
        'touch',
        'unknown',
      ],
    },
    animation: {
      control: 'radio',
      options: ['confirm', 'enterPin', 'enterPassphrase'],
    },
  },
} satisfies Meta<typeof HardwareDevice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// How the app calls it: the scenario is fixed here, the model arrives with
// the connected device. The Classic family shares one replica, and a model
// without one (mini) renders nothing rather than a placeholder.
const ROUTED: IHardwareDeviceType[] = ['classic', 'classicpure', 'pro', 'mini'];

export const ByDeviceType: Story = {
  render: () => (
    <XStack gap="$4" alignItems="flex-start">
      {ROUTED.map((deviceType) => (
        <HardwareDevice
          key={deviceType}
          deviceType={deviceType}
          animation="confirm"
          width={108}
        />
      ))}
    </XStack>
  ),
};
