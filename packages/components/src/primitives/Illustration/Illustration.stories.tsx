import { Illustration } from '@onekeyhq/components/src/primitives/Illustration';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Names are icon keys with the `Illus` suffix stripped; dark themes swap to
// the matching `*DarkIllus` variant automatically.
const meta = {
  title: 'Primitives/Illustration',
  component: Illustration,
  args: {
    name: 'WalletBackup',
    size: 144,
  },
} satisfies Meta<typeof Illustration>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Gallery: Story = {
  render: () => (
    <XStack gap="$4" ai="center" flexWrap="wrap">
      <Illustration name="WalletBackup" size={120} />
      <Illustration name="SearchDocument" size={120} />
      <Illustration name="BlockCoins" size={120} />
      <Illustration name="Orders" size={120} />
    </XStack>
  ),
};
