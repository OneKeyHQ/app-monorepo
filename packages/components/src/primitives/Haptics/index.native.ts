import {
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
} from 'expo-haptics';

import type { IHaptics } from './type';
import type { ImpactFeedbackStyle } from 'expo-haptics';

let enabled = true;

export const Haptics: IHaptics = {
  setEnabled(value: boolean) {
    enabled = value;
  },

  impact(style: ImpactFeedbackStyle) {
    if (!enabled) {
      return;
    }
    void impactAsync(style);
  },

  selection() {
    if (!enabled) {
      return;
    }
    void selectionAsync();
  },

  notification(type: NotificationFeedbackType) {
    if (!enabled) {
      return;
    }
    void notificationAsync(type);
  },
  success() {
    if (!enabled) {
      return;
    }
    void notificationAsync(NotificationFeedbackType.Success);
  },

  warning() {
    if (!enabled) {
      return;
    }
    void notificationAsync(NotificationFeedbackType.Warning);
  },

  error() {
    if (!enabled) {
      return;
    }
    void notificationAsync(NotificationFeedbackType.Error);
  },
};

export * from './type';
