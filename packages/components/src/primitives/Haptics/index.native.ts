import { impactAsync, notificationAsync, selectionAsync } from 'expo-haptics';

import type { IHaptics } from './type';
import type {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from 'expo-haptics';

export const Haptics: IHaptics = {
  impact(style: ImpactFeedbackStyle) {
    void impactAsync(style);
  },

  selection() {
    void selectionAsync();
  },

  notification(type: NotificationFeedbackType) {
    void notificationAsync(type);
  },
};

export * from './type';
