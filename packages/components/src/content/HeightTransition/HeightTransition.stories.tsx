import { useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';

import { HeightTransition } from '@onekeyhq/components/src/content/HeightTransition';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Reanimated-driven height auto-measure: the container animates to the
// child's measured height and to zero when the child unmounts (the Swap
// provider-route rows use this).
function HeightTransitionDemo() {
  const [expanded, setExpanded] = useState(true);
  const handleToggle = useCallback(() => setExpanded((value) => !value), []);

  return (
    <YStack gap="$3" w={280}>
      <Button onPress={handleToggle}>Toggle details</Button>
      <YStack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        p="$3"
      >
        <SizableText size="$bodyMdMedium">Order summary</SizableText>
        <HeightTransition>
          {expanded ? (
            <YStack pt="$2" gap="$1">
              <SizableText size="$bodySm" color="$textSubdued">
                Network fee 0.0002 BTC
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                Provider fee 0.25%
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                Total 0.1502 BTC
              </SizableText>
            </YStack>
          ) : null}
        </HeightTransition>
      </YStack>
    </YStack>
  );
}

const meta = {
  title: 'Content/HeightTransition',
  component: HeightTransitionDemo,
} satisfies Meta<typeof HeightTransitionDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
