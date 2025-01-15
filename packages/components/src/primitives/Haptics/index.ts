import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
} from 'expo-haptics';

export function impactFeedback(style: ImpactFeedbackStyle) {
  void impactAsync(ImpactFeedbackStyle);
}

export function selectionFeedback() {
  void selectionAsync();
}

export enum ENotificationFeedback {
  Success = NotificationFeedbackType.Success,
  Warning = NotificationFeedbackType.Warning,
  Error = NotificationFeedbackType.Error,
}

export function notificationFeedback(type: NotificationFeedbackType) {
  void notificationAsync(type);
}

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
