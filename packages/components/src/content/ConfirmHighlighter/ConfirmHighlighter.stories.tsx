import { ConfirmHighlighter } from '@onekeyhq/components/src/content/ConfirmHighlighter';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const CONFIRM_CARD = (
  <YStack p="$4" gap="$1" borderRadius="$3" bg="$bgSubdued">
    <SizableText size="$bodyMdMedium">Verify on your device</SizableText>
    <SizableText size="$bodySm" color="$textSubdued">
      Compare the address in the app with the hardware wallet screen.
    </SizableText>
  </YStack>
);

// Pulsing brand ring drawn around the wrapped content (Receive uses it
// to spotlight the address card); the animated overlay only mounts
// while `highlight` is on.
const meta = {
  title: 'Content/ConfirmHighlighter',
  component: ConfirmHighlighter,
  args: {
    highlight: true,
    borderRadius: '$3',
    maxWidth: 320,
    children: CONFIRM_CARD,
  },
} satisfies Meta<typeof ConfirmHighlighter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Idle: Story = {
  args: {
    highlight: false,
  },
};
