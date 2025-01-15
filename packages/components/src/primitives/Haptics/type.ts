import type {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from 'expo-haptics';

export type IHaptics = {
  impact: (style: ImpactFeedbackStyle) => void;
  selection: () => void;
  notification: (type: NotificationFeedbackType) => void;
};

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
