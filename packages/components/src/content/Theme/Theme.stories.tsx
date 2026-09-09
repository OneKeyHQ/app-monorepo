import { Theme } from '@onekeyhq/components/src/content/Theme';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Everything inside the scope resolves tokens against the named theme,
// regardless of the app-level theme (the Modal navigator and Prime
// dashboard force scopes the same way).
function ThemedCard({ label }: { label: string }) {
  return (
    <YStack
      bg="$bgApp"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      p="$4"
      gap="$1"
      w={160}
    >
      <SizableText size="$bodyLgMedium">{label}</SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        Tokens resolve in this scope
      </SizableText>
    </YStack>
  );
}

const meta = {
  title: 'Content/Theme',
  component: Theme,
} satisfies Meta<typeof Theme>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <XStack gap="$4" flexWrap="wrap">
      <Theme name="light">
        <ThemedCard label="Light scope" />
      </Theme>
      <Theme name="dark">
        <ThemedCard label="Dark scope" />
      </Theme>
    </XStack>
  ),
};
