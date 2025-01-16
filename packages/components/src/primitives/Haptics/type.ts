import type {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from 'expo-haptics';

export type IHaptics = {
  impact: (style: ImpactFeedbackStyle) => void;
  selection: () => void;
  notification: (type: NotificationFeedbackType) => void;
  success: () => void;
  warning: () => void;
  error: () => void;
};

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
