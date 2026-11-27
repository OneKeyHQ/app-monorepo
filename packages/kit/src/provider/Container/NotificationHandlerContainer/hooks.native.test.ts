/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useInitialNotification } from './hooks.native';

const mockNavigateToNotificationDetail = jest.fn<void, unknown[]>();
const mockWhenAppUnlocked = jest
  .fn<Promise<void>, []>()
  .mockResolvedValue(undefined);
const mockLocalNotification = {
  title: 'Wallet',
  content: 'Check recent activity',
  notificationId: 'wallet-notification',
};
const mockColdStartByNotification = {
  launchNotification: null,
  localLaunchNotification: { ...mockLocalNotification },
};

jest.mock('../ColdStartByNotification', () => ({
  get ColdStartByNotification() {
    return mockColdStartByNotification;
  },
}));
jest.mock('../../../utils/passwordUtils', () => ({
  whenAppUnlocked: () => mockWhenAppUnlocked(),
}));
jest.mock('../../../hooks/useVersionCompatible', () => ({
  useVersionCompatible: () => ({ isVersionCompatible: () => true }),
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { isMaskingDataSync: () => false },
}));
jest.mock('@onekeyhq/shared/src/utils/notificationsUtils', () => ({
  __esModule: true,
  default: {
    navigateToNotificationDetail: (...args: unknown[]) =>
      mockNavigateToNotificationDetail(...args),
  },
}));
jest.mock('@onekeyhq/shared/src/modules/LaunchOptionsManager', () => ({
  __esModule: true,
  default: {
    getLaunchOptions: jest
      .fn()
      .mockResolvedValue({ launchType: 'localNotification' }),
  },
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: { handleColdStartByNotification: jest.fn() },
  },
}));

it('dispatches the local scene notification through the existing click handler once', async () => {
  jest.useFakeTimers();
  try {
    const { unmount } = renderHook(() => useInitialNotification());
    await act(async () => jest.advanceTimersByTimeAsync(350));
    expect(mockWhenAppUnlocked).toHaveBeenCalledTimes(1);
    expect(mockNavigateToNotificationDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        message: mockLocalNotification,
        notificationId: mockLocalNotification.notificationId,
        isFromNotificationClick: true,
      }),
    );
    unmount();
    renderHook(() => useInitialNotification());
    await act(async () => jest.advanceTimersByTimeAsync(350));
    expect(mockNavigateToNotificationDetail).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
