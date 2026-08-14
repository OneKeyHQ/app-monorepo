import { StyleSheet } from 'react-native';

import { ScrollView } from '@onekeyhq/components/src/layouts/ScrollView';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import {
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const ROWS = Array.from({ length: 20 }, (_, index) => `Row ${index + 1}`);

const CHAINS = [
  'Bitcoin',
  'Ethereum',
  'Solana',
  'Dogecoin',
  'Toncoin',
  'Cardano',
  'Polygon',
  'Avalanche',
];

const VERTICAL_CONTENT = (
  <YStack gap="$2" p="$4">
    {ROWS.map((label) => (
      <Stack key={label} p="$3" bg="$bgSubdued" borderRadius="$2">
        <SizableText>{label}</SizableText>
      </Stack>
    ))}
  </YStack>
);

const HORIZONTAL_CONTENT = (
  <XStack gap="$2" p="$3">
    {CHAINS.map((label) => (
      <XStack
        key={label}
        px="$3"
        py="$1.5"
        bg="$bgSubdued"
        borderRadius="$full"
        alignSelf="center"
      >
        <SizableText size="$bodyMdMedium">{label}</SizableText>
      </XStack>
    ))}
  </XStack>
);

// Size the scroll area through a plain Stack wrapper — the ScrollView's
// own h/w only constrain it on web in this shell, and every list story
// bounds itself the same way.
function ScrollViewDemo({
  horizontal,
  height,
}: {
  horizontal?: boolean;
  height: number;
}) {
  return (
    <YStack
      h={height}
      w={320}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <ScrollView horizontal={horizontal}>
        {horizontal ? HORIZONTAL_CONTENT : VERTICAL_CONTENT}
      </ScrollView>
    </YStack>
  );
}

const meta = {
  title: 'Layouts/ScrollView',
  component: ScrollViewDemo,
  args: {
    height: 280,
  },
} satisfies Meta<typeof ScrollViewDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Horizontal: Story = {
  args: {
    horizontal: true,
    height: 64,
  },
};
