import { GradientMask } from '@onekeyhq/components/src/primitives/GradientMask';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const CHIPS = [
  'Bitcoin',
  'Ethereum',
  'Solana',
  'Dogecoin',
  'Toncoin',
  'Cardano',
] as const;

// Absolutely-positioned scroll-edge fade; it blends into the theme bgApp by
// default, so the demo pins it over an overflowing chip row.
function GradientMaskDemo({
  position,
}: {
  position: 'left' | 'right' | 'both';
}) {
  return (
    <XStack w={280} overflow="hidden" position="relative" bg="$bgApp">
      <XStack gap="$2" py="$2">
        {CHIPS.map((chip) => (
          <XStack
            key={chip}
            px="$3"
            py="$1.5"
            bg="$bgSubdued"
            borderRadius="$full"
          >
            <SizableText size="$bodySm" numberOfLines={1}>
              {chip}
            </SizableText>
          </XStack>
        ))}
      </XStack>
      {position !== 'right' ? (
        <GradientMask position="left" width={48} />
      ) : null}
      {position !== 'left' ? (
        <GradientMask position="right" width={48} />
      ) : null}
    </XStack>
  );
}

const meta = {
  title: 'Primitives/GradientMask',
  component: GradientMaskDemo,
  args: {
    position: 'right',
  },
} satisfies Meta<typeof GradientMaskDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const BothEdges: Story = {
  args: {
    position: 'both',
  },
};
