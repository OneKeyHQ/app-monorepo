import { Badge } from '@onekeyhq/components/src/content/Badge';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const BADGE_TYPES = [
  'success',
  'info',
  'warning',
  'critical',
  'default',
] as const;
const BADGE_SIZES = ['lg', 'sm'] as const;

const meta = {
  title: 'Content/Badge',
  component: Badge,
  args: {
    badgeType: 'default',
    badgeSize: 'sm',
    children: 'Badge',
  },
  argTypes: {
    badgeType: { control: 'select', options: BADGE_TYPES },
    badgeSize: { control: 'select', options: BADGE_SIZES },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllTypes: Story = {
  render: (args) => (
    <YStack gap="$4">
      {BADGE_SIZES.map((size) => (
        <YStack key={size} gap="$2">
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {size}
          </SizableText>
          <XStack gap="$3" flexWrap="wrap" alignItems="center">
            {BADGE_TYPES.map((type) => (
              <Badge
                {...args}
                key={`${size}-${type}`}
                badgeType={type}
                badgeSize={size}
              >
                {type}
              </Badge>
            ))}
          </XStack>
        </YStack>
      ))}
    </YStack>
  ),
};
