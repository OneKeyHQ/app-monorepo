import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';

import ServiceNotification from './ServiceNotification';

jest.mock('@react-navigation/native', () => ({
  CommonActions: { reset: jest.fn() },
  StackActions: { push: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { page: { notificationItemClicked: jest.fn() } },
  },
}));

describe('ServiceNotification legacy navigation intent', () => {
  const originalIsNative = platformEnv.isNative;
  const originalIsNativeBackgroundThread = platformEnv.isNativeBackgroundThread;

  afterEach(() => {
    platformEnv.isNative = originalIsNative;
    platformEnv.isNativeBackgroundThread = originalIsNativeBackgroundThread;
  });

  it('atomically consumes only the latest BG intent when the UI has not registered', async () => {
    platformEnv.isNative = true;
    platformEnv.isNativeBackgroundThread = true;
    const service = new ServiceNotification({ backgroundApi: {} });

    await notificationsUtils.navigateToNotificationDetail({
      notificationId: 'first',
      isFromNotificationClick: true,
      isRead: true,
      message: {
        extras: {
          params: {
            transactionHash: 'first-transaction',
            accountId: 'first-account',
            networkId: 'first-network',
          },
        },
      } as never,
      mode: undefined,
    });
    await notificationsUtils.navigateToNotificationDetail({
      notificationId: 'second',
      isFromNotificationClick: true,
      isRead: true,
      message: undefined,
      mode: undefined,
    });

    await expect(service.consumePendingLegacyNavigation()).resolves.toEqual({
      payload: {
        screen: ERootRoutes.Modal,
        params: {
          screen: EModalRoutes.NotificationsModal,
          params: {
            screen: EModalNotificationsRoutes.NotificationList,
            params: {},
          },
        },
      },
      navigationAction: 'push',
    });
    await expect(
      service.consumePendingLegacyNavigation(),
    ).resolves.toBeUndefined();
  });
});
