import { Progress } from '@onekeyhq/components/src/content/Progress';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// On web the indicator mounts lazily (two 300ms steps) so the bar animates in
// from 0 — give screenshots a beat before judging the fill.
const meta = {
  title: 'Content/Progress',
  component: Progress,
  args: {
    value: 40,
    size: 'small',
    animated: true,
  },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    size: { control: 'select', options: ['small', 'medium'] },
    animated: { control: 'boolean' },
  },
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <YStack gap="$5">
      <YStack gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          small (default)
        </SizableText>
        <Progress {...args} size="small" />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          medium
        </SizableText>
        <Progress {...args} size="medium" />
      </YStack>
    </YStack>
  ),
};

export const CustomColors: Story = {
  args: {
    value: 65,
    progressColor: '$bgCautionSubdued',
    indicatorColor: '$bgCaution',
  },
};
