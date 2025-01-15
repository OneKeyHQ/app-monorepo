import {
  Button,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  Stack,
  YStack,
  impactFeedback,
  notificationFeedback,
  selectionFeedback,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const HapticsGallery = () => (
  <Layout
    description="Haptic feedback components"
    suggestions={['Use haptics to provide physical feedback']}
    boundaryConditions={['Only works on physical devices']}
    elements={[
      {
        title: 'Impact Feedback',
        element: (
          <YStack gap="$2">
            <Button onPress={() => impactFeedback(ImpactFeedbackStyle.Light)}>
              Light Impact
            </Button>
            <Button onPress={() => impactFeedback(ImpactFeedbackStyle.Medium)}>
              Medium Impact
            </Button>
            <Button onPress={() => impactFeedback(ImpactFeedbackStyle.Heavy)}>
              Heavy Impact
            </Button>
            <Button onPress={() => impactFeedback(ImpactFeedbackStyle.Rigid)}>
              Rigid Impact
            </Button>
            <Button onPress={() => impactFeedback(ImpactFeedbackStyle.Soft)}>
              Soft Impact
            </Button>
          </YStack>
        ),
      },
      {
        title: 'Selection Feedback',
        element: (
          <Stack gap="$2">
            <Button onPress={() => selectionFeedback()}>
              Selection Feedback
            </Button>
          </Stack>
        ),
      },
      {
        title: 'Notification Feedback',
        element: (
          <YStack gap="$2">
            <Button
              onPress={() =>
                notificationFeedback(NotificationFeedbackType.Success)
              }
              variant="primary"
            >
              Success Notification
            </Button>
            <Button
              onPress={() =>
                notificationFeedback(NotificationFeedbackType.Warning)
              }
              variant="destructive"
            >
              Warning Notification
            </Button>
            <Button
              onPress={() =>
                notificationFeedback(NotificationFeedbackType.Error)
              }
              variant="destructive"
            >
              Error Notification
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default HapticsGallery;
