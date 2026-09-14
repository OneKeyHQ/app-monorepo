import { impactAsync, notificationAsync, selectionAsync } from 'expo-haptics';

import {
  Haptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from './index.native';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Medium: 'medium',
  },
  NotificationFeedbackType: {
    Error: 'error',
    Success: 'success',
    Warning: 'warning',
  },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

const impactAsyncMock = jest.mocked(impactAsync);
const notificationAsyncMock = jest.mocked(notificationAsync);
const selectionAsyncMock = jest.mocked(selectionAsync);

describe('Haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Haptics.setEnabled(true);
  });

  it('forwards feedback to the native haptics module when enabled', () => {
    Haptics.impact(ImpactFeedbackStyle.Medium);
    Haptics.selection();
    Haptics.notification(NotificationFeedbackType.Warning);

    expect(impactAsyncMock).toHaveBeenCalledWith(ImpactFeedbackStyle.Medium);
    expect(selectionAsyncMock).toHaveBeenCalledTimes(1);
    expect(notificationAsyncMock).toHaveBeenCalledWith(
      NotificationFeedbackType.Warning,
    );
  });

  it('suppresses all custom feedback when disabled', () => {
    Haptics.setEnabled(false);

    Haptics.impact(ImpactFeedbackStyle.Medium);
    Haptics.selection();
    Haptics.notification(NotificationFeedbackType.Warning);
    Haptics.success();
    Haptics.warning();
    Haptics.error();

    expect(impactAsyncMock).not.toHaveBeenCalled();
    expect(selectionAsyncMock).not.toHaveBeenCalled();
    expect(notificationAsyncMock).not.toHaveBeenCalled();
  });
});
