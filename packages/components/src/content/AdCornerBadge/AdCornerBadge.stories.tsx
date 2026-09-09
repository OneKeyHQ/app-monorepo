import { AdCornerBadge } from '@onekeyhq/components/src/content/AdCornerBadge';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// The badge is an absolutely-positioned, non-interactive overlay — it needs
// a positioned parent, like the dApp banner cards in Discovery.
function AdCornerBadgeDemo({
  badgeSize = 'sm',
  placement = 'top-right',
}: {
  badgeSize?: 'sm' | 'lg';
  placement?: 'top-left' | 'top-right' | 'bottom-right';
}) {
  return (
    <YStack
      w={240}
      h={140}
      bg="$bgSubdued"
      borderRadius="$3"
      overflow="hidden"
      ai="center"
      jc="center"
      position="relative"
    >
      <SizableText size="$bodySm" color="$textSubdued">
        Promoted dApp card
      </SizableText>
      <AdCornerBadge badgeSize={badgeSize} placement={placement} />
    </YStack>
  );
}

const meta = {
  title: 'Content/AdCornerBadge',
  component: AdCornerBadgeDemo,
} satisfies Meta<typeof AdCornerBadgeDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const BottomRightLarge: Story = {
  args: {
    badgeSize: 'lg',
    placement: 'bottom-right',
  },
};
