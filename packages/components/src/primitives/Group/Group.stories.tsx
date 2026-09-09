import { StyleSheet } from 'react-native';

import { Divider } from '@onekeyhq/components/src/content/Divider';
import { XGroup, YGroup } from '@onekeyhq/components/src/primitives/Group';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const ROWS = [
  'Standard wallet',
  'Hidden wallet',
  'Watch-only account',
] as const;

const ROW_SEPARATOR = <Divider />;

const COLUMN_SEPARATOR = <Divider vertical />;

// Group joins children into one rounded container: only the outer corners
// keep the radius, and `separator` renders between items.
const meta = {
  title: 'Primitives/Group',
  component: YGroup,
} satisfies Meta<typeof YGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <YGroup
      w={260}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      separator={ROW_SEPARATOR}
      overflow="hidden"
    >
      {ROWS.map((row) => (
        <YGroup.Item key={row}>
          <XStack p="$3" bg="$bgSubdued">
            <SizableText size="$bodyMd">{row}</SizableText>
          </XStack>
        </YGroup.Item>
      ))}
    </YGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <XGroup
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      separator={COLUMN_SEPARATOR}
      overflow="hidden"
    >
      {ROWS.map((row) => (
        <XGroup.Item key={row}>
          <XStack px="$3" py="$2" bg="$bgSubdued">
            <SizableText size="$bodySm">{row}</SizableText>
          </XStack>
        </XGroup.Item>
      ))}
    </XGroup>
  ),
};
