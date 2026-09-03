import { Heading } from '@onekeyhq/components/src/primitives/Heading';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const LEVEL_RAMP = [
  '$heading4xl',
  '$heading2xl',
  '$headingXl',
  '$headingLg',
  '$headingMd',
  '$headingSm',
] as const;

const meta = {
  title: 'Primitives/Heading',
  component: Heading,
  args: {
    children: 'Secure your assets',
    size: '$headingXl',
  },
} satisfies Meta<typeof Heading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Levels: Story = {
  render: () => (
    <YStack gap="$2">
      {LEVEL_RAMP.map((size) => (
        <Heading key={size} size={size}>
          {size}
        </Heading>
      ))}
    </YStack>
  ),
};
