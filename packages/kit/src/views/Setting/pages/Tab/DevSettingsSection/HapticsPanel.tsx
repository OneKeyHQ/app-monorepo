import {
  Button,
  Haptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  YStack,
} from '@onekeyhq/components';

export function HapticsPanel() {
  return (
    <YStack gap="$2">
      <Button onPress={() => Haptics.impact(ImpactFeedbackStyle.Light)}>
        Light Impact
      </Button>
      <Button onPress={() => Haptics.impact(ImpactFeedbackStyle.Medium)}>
        Medium Impact
      </Button>
      <Button onPress={() => Haptics.impact(ImpactFeedbackStyle.Heavy)}>
        Heavy Impact
      </Button>
      <Button onPress={() => Haptics.selection()}>Selection Feedback</Button>
      <Button
        onPress={() => Haptics.notification(NotificationFeedbackType.Success)}
        variant="primary"
      >
        Success Notification
      </Button>
      <Button
        onPress={() => Haptics.notification(NotificationFeedbackType.Warning)}
        variant="destructive"
      >
        Warning Notification
      </Button>
      <Button
        onPress={() => Haptics.notification(NotificationFeedbackType.Error)}
        variant="destructive"
      >
        Error Notification
      </Button>
    </YStack>
  );
}
