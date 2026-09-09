import type {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from 'expo-haptics';

export type IHaptics = {
  setEnabled: (enabled: boolean) => void;
  impact: (style: ImpactFeedbackStyle) => void;
  selection: () => void;
  notification: (type: NotificationFeedbackType) => void;
  success: () => void;
  warning: () => void;
  error: () => void;
};

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
