import { Button } from '@onekeyhq/components/src/primitives/Button';
import {
  Haptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from '@onekeyhq/components/src/primitives/Haptics';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Imperative feedback API: vibration only fires on physical devices —
// simulators and the web build are silent no-ops.
const impactLight = () => Haptics.impact(ImpactFeedbackStyle.Light);
const impactMedium = () => Haptics.impact(ImpactFeedbackStyle.Medium);
const impactHeavy = () => Haptics.impact(ImpactFeedbackStyle.Heavy);
const fireSelection = () => Haptics.selection();
const notifySuccess = () =>
  Haptics.notification(NotificationFeedbackType.Success);
const notifyWarning = () =>
  Haptics.notification(NotificationFeedbackType.Warning);
const notifyError = () => Haptics.notification(NotificationFeedbackType.Error);

function HapticsDemo() {
  return (
    <YStack gap="$4" maxWidth={400}>
      <SizableText size="$bodySm" color="$textSubdued">
        Feedback fires on physical devices only.
      </SizableText>
      <YStack gap="$2">
        <SizableText size="$headingXs" color="$textSubdued">
          Impact
        </SizableText>
        <XStack gap="$2" flexWrap="wrap">
          <Button size="small" onPress={impactLight}>
            Light
          </Button>
          <Button size="small" onPress={impactMedium}>
            Medium
          </Button>
          <Button size="small" onPress={impactHeavy}>
            Heavy
          </Button>
        </XStack>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$headingXs" color="$textSubdued">
          Selection
        </SizableText>
        <XStack gap="$2">
          <Button size="small" onPress={fireSelection}>
            Selection tick
          </Button>
        </XStack>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$headingXs" color="$textSubdued">
          Notification
        </SizableText>
        <XStack gap="$2" flexWrap="wrap">
          <Button size="small" onPress={notifySuccess}>
            Success
          </Button>
          <Button size="small" onPress={notifyWarning}>
            Warning
          </Button>
          <Button size="small" onPress={notifyError}>
            Error
          </Button>
        </XStack>
      </YStack>
    </YStack>
  );
}

const meta = {
  title: 'Primitives/Haptics',
  component: HapticsDemo,
} satisfies Meta<typeof HapticsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
