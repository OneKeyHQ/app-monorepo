import { HardwareDevice } from '.';

import { XStack, YStack } from '../../primitives';

import type { IHardwareDeviceType } from '.';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// The one entry point to the code-drawn replicas: pick a model, pick a
// scene. The shells are drawn from their Figma nodes and verified against
// them on an iOS simulator; this is where you look at any of them.
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
        'pro2',
        'mini',
        'touch',
        'unknown',
      ],
    },
    animation: {
      control: 'radio',
      options: ['connecting', 'enterPin', 'enterPassphrase', 'confirm'],
    },
    width: { control: { type: 'range', min: 80, max: 500, step: 1 } },
  },
} satisfies Meta<typeof HardwareDevice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// How the app calls it: the scenario is fixed here, the model arrives with
// the connected device. The Classic family shares one replica, and a model
// without one (unknown) renders nothing rather than a placeholder.
const ROUTED: IHardwareDeviceType[] = [
  'classic',
  'classicpure',
  'mini',
  'pro',
  'touch',
  'pro2',
  'unknown',
];

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
      <XStack gap="$4" alignItems="flex-start">
        <HardwareDevice deviceType="pro2" width={80} />
        <HardwareDevice deviceType="pro2" width={160} />
        <HardwareDevice deviceType="pro2" width={240} />
      </XStack>
      <XStack gap="$4" alignItems="flex-start">
        <HardwareDevice deviceType="mini" width={80} />
        <HardwareDevice deviceType="mini" width={160} />
        <HardwareDevice deviceType="mini" width={240} />
      </XStack>
      <XStack gap="$4" alignItems="flex-start">
        <HardwareDevice deviceType="touch" width={80} />
        <HardwareDevice deviceType="touch" width={160} />
        <HardwareDevice deviceType="touch" width={240} />
      </XStack>
    </YStack>
  ),
};
