import { BlurView } from '@onekeyhq/components/src/content/BlurView';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import {
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Center the label through contentStyle — outer ai/jc land on the wrong
// node on native (the ScanQrCode/Gallery usages size it with w/h the same
// way).
const BLUR_CONTENT_STYLE = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

// expo-blur (with a CSS-filter web shim); tint follows the active theme.
// The demo floats the blur panel over colored blocks so the effect is
// visible on both platforms.
function BlurViewDemo({ intensity = 50 }: { intensity?: number }) {
  return (
    <YStack
      w={260}
      h={160}
      borderRadius="$3"
      overflow="hidden"
      position="relative"
    >
      <XStack flex={1}>
        <Stack flex={1} bg="#F97066" />
        <Stack flex={1} bg="#FDB022" />
        <Stack flex={1} bg="#32D583" />
      </XStack>
      <BlurView
        position="absolute"
        bottom={0}
        left={0}
        w="100%"
        h={72}
        intensity={intensity}
        contentStyle={BLUR_CONTENT_STYLE}
      >
        <SizableText size="$bodyMdMedium">Balance hidden</SizableText>
      </BlurView>
    </YStack>
  );
}

const meta = {
  title: 'Content/BlurView',
  component: BlurViewDemo,
  args: {
    intensity: 50,
  },
} satisfies Meta<typeof BlurViewDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const HighIntensity: Story = {
  args: {
    intensity: 95,
  },
};
