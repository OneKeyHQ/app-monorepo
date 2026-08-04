import { HardwareDevice } from '.';

import { XStack, YStack } from '../../primitives';

import type { IHardwareDeviceType } from '.';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// The one entry point to the code-drawn replicas: pick a model, pick a
// scene. Both shells are drawn from their Figma nodes and verified against
// them on an iOS simulator; this is where you look at either.
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
    width: { control: { type: 'range', min: 80, max: 500, step: 1 } },
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

// Shrinking is the free direction: the transform minifies, so the drawing
// only gets denser. Enlarging is where the Classic softens on iOS and
// Android, since its noise and blurs become magnified bitmaps; the Pro has
// neither and only its wordmark rasterizes.
export const Sizes: Story = {
  render: () => (
    <YStack gap="$4">
      <XStack gap="$4" alignItems="flex-start">
        <HardwareDevice deviceType="classic" width={80} />
        <HardwareDevice deviceType="classic" width={160} />
        <HardwareDevice deviceType="classic" width={240} />
      </XStack>
      <XStack gap="$4" alignItems="flex-start">
        <HardwareDevice deviceType="pro" width={80} />
        <HardwareDevice deviceType="pro" width={160} />
        <HardwareDevice deviceType="pro" width={240} />
      </XStack>
    </YStack>
  ),
};
