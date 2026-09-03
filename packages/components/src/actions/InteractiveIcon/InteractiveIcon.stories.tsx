import { fn } from 'storybook/test';

import { InteractiveIcon } from '@onekeyhq/components/src/actions/InteractiveIcon';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Bare tappable icon: subdued color that brightens on hover (tamagui group,
// web-only) with an enlarged native hit slop.
const meta = {
  title: 'Actions/InteractiveIcon',
  component: InteractiveIcon,
  args: {
    icon: 'Copy3Outline',
    onPress: fn(),
    testID: 'interactive-icon-story',
  },
} satisfies Meta<typeof InteractiveIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <XStack gap="$4" ai="center">
      <InteractiveIcon {...args} size="$4" />
      <InteractiveIcon {...args} size="$5" />
      <InteractiveIcon {...args} size="$6" />
    </XStack>
  ),
};
