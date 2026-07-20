import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const SIZE_RAMP = [
  '$heading3xl',
  '$headingXl',
  '$headingMd',
  '$bodyLg',
  '$bodyMd',
  '$bodySm',
] as const;

// App-wide text primitive: defaults to $bodyMd with tabular numerals and
// locked font scaling.
const meta = {
  title: 'Primitives/SizeableText',
  component: SizableText,
  args: {
    children: 'Own your keys, own your crypto.',
    size: '$bodyLg',
  },
} satisfies Meta<typeof SizableText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const SizeRamp: Story = {
  render: () => (
    <YStack gap="$2">
      {SIZE_RAMP.map((size) => (
        <SizableText key={size} size={size}>
          {size}
        </SizableText>
      ))}
    </YStack>
  ),
};

export const Colors: Story = {
  render: () => (
    <YStack gap="$1">
      <SizableText>Default</SizableText>
      <SizableText color="$textSubdued">Subdued</SizableText>
      <SizableText color="$textDisabled">Disabled</SizableText>
      <SizableText color="$textSuccess">Success</SizableText>
      <SizableText color="$textCritical">Critical</SizableText>
      <SizableText color="$textInfo">Info</SizableText>
    </YStack>
  ),
};
