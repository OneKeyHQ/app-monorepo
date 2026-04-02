import {
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
} from 'expo-haptics';

import type { IHaptics } from './type';
import type { ImpactFeedbackStyle } from 'expo-haptics';

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
  success() {
    void notificationAsync(NotificationFeedbackType.Success);
  },

  warning() {
    void notificationAsync(NotificationFeedbackType.Warning);
  },

  error() {
    void notificationAsync(NotificationFeedbackType.Error);
  },
};

export * from './type';
