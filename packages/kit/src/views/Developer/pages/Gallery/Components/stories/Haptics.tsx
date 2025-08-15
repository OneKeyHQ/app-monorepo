import {
  Button,
  Haptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  Stack,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const HapticsGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="Haptics"
    description="Haptic feedback components"
    suggestions={['Use haptics to provide physical feedback']}
    boundaryConditions={['Only works on physical devices']}
    elements={[
      {
        title: 'Impact Feedback',
        element: (
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
          </YStack>
        ),
      },
      {
        title: 'Selection Feedback',
        element: (
          <Stack gap="$2">
            <Button onPress={() => Haptics.selection()}>
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
                Haptics.notification(NotificationFeedbackType.Success)
              }
              variant="primary"
            >
              Success Notification
            </Button>
            <Button
              onPress={() =>
                Haptics.notification(NotificationFeedbackType.Warning)
              }
              variant="destructive"
            >
              Warning Notification
            </Button>
            <Button
              onPress={() =>
                Haptics.notification(NotificationFeedbackType.Error)
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
