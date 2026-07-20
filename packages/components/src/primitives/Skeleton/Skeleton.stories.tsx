import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { Skeleton } from '@onekeyhq/components/src/primitives/Skeleton';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const meta = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
  args: {
    w: 120,
    h: 16,
    radius: 4,
  },
  argTypes: {
    w: { control: 'number' },
    h: { control: 'number' },
    radius: { control: 'number' },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const TextVariants: Story = {
  render: () => (
    <YStack gap="$1">
      <Skeleton.Heading2Xl />
      <Skeleton.HeadingLg />
      <Skeleton.HeadingSm />
      <Skeleton.BodyLg />
      <Skeleton.BodyMd />
      <Skeleton.BodySm />
    </YStack>
  ),
};

// Skeleton.Group drives every Skeleton below it via context: `show` swaps the
// placeholder bars for the real children — the app's list-row loading pattern.
// Toggle the `show` control to see the swap.
export const Group: Story = {
  args: { show: true },
  argTypes: {
    show: { control: 'boolean' },
  },
  render: (args) => (
    <Skeleton.Group show={args.show ?? true}>
      <XStack gap="$3" alignItems="center">
        <Skeleton w="$10" h="$10" radius="round">
          <XStack
            w="$10"
            h="$10"
            borderRadius="$full"
            bg="$bgSuccessSubdued"
            alignItems="center"
            justifyContent="center"
          >
            <SizableText size="$headingSm">₿</SizableText>
          </XStack>
        </Skeleton>
        <YStack>
          <Skeleton w={96} h={16}>
            <SizableText size="$bodyLgMedium">Bitcoin</SizableText>
          </Skeleton>
          <Skeleton w={64} h={12}>
            <SizableText size="$bodyMd" color="$textSubdued">
              0.0042 BTC
            </SizableText>
          </Skeleton>
        </YStack>
      </XStack>
    </Skeleton.Group>
  ),
};
