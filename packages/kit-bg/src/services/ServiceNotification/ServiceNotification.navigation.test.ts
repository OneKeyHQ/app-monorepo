import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

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
    notification: {
      common: { notificationClicked: jest.fn() },
      support: { supportReplyClicked: jest.fn() },
    },
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

  it('blocks push notification navigation when a force update is active', async () => {
    platformEnv.isNative = true;
    platformEnv.isNativeBackgroundThread = true;
    const showAndFocusApp = jest.fn().mockResolvedValue(undefined);
    const removeNotification = jest.fn().mockResolvedValue(undefined);
    const ackNotificationMessage = jest.fn().mockResolvedValue(undefined);
    const navigateSpy = jest
      .spyOn(notificationsUtils, 'navigateToNotificationDetail')
      .mockResolvedValue(undefined);
    const waitSpy = jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    const service = new ServiceNotification({
      backgroundApi: {
        serviceAppUpdate: {
          getUpdateInfo: jest.fn().mockResolvedValue({
            latestVersion: '9999.1.4',
            status: EAppUpdateStatus.notify,
            updateStrategy: EUpdateStrategy.force,
            updateAt: Date.now(),
          }),
        },
      },
    });
    jest
      .spyOn(service, 'getNotificationProvider')
      .mockResolvedValue({ showAndFocusApp } as never);
    jest
      .spyOn(service, 'removeNotification')
      .mockImplementation(removeNotification);
    jest
      .spyOn(service, 'ackNotificationMessage')
      .mockImplementation(ackNotificationMessage);

    try {
      await service.onNotificationClicked({
        notificationId: 'notif-force-update',
        params: {
          title: 'Sent',
          description: 'POL sent',
          remotePushMessageInfo: {
            extras: {
              params: {
                transactionHash: '0xabc',
                accountId: 'acc-1',
                networkId: 'evm--137',
              },
            },
          } as never,
        },
      });

      expect(showAndFocusApp).toHaveBeenCalledTimes(1);
      expect(navigateSpy).not.toHaveBeenCalled();
      expect(removeNotification).toHaveBeenCalledWith({
        notificationId: 'notif-force-update',
        desktopNotification: undefined,
      });
    } finally {
      navigateSpy.mockRestore();
      waitSpy.mockRestore();
    }
  });

  it('allows push notification navigation when update strategy is manual', async () => {
    platformEnv.isNative = true;
    platformEnv.isNativeBackgroundThread = true;
    const showAndFocusApp = jest.fn().mockResolvedValue(undefined);
    const removeNotification = jest.fn().mockResolvedValue(undefined);
    const ackNotificationMessage = jest.fn().mockResolvedValue(undefined);
    const navigateSpy = jest
      .spyOn(notificationsUtils, 'navigateToNotificationDetail')
      .mockResolvedValue(undefined);
    const waitSpy = jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    const service = new ServiceNotification({
      backgroundApi: {
        serviceAppUpdate: {
          getUpdateInfo: jest.fn().mockResolvedValue({
            latestVersion: '9999.1.4',
            status: EAppUpdateStatus.notify,
            updateStrategy: EUpdateStrategy.manual,
            updateAt: Date.now(),
          }),
        },
      },
    });
    jest
      .spyOn(service, 'getNotificationProvider')
      .mockResolvedValue({ showAndFocusApp } as never);
    jest
      .spyOn(service, 'removeNotification')
      .mockImplementation(removeNotification);
    jest
      .spyOn(service, 'ackNotificationMessage')
      .mockImplementation(ackNotificationMessage);

    try {
      await service.onNotificationClicked({
        notificationId: 'notif-manual-update',
        params: {
          title: 'Sent',
          description: 'POL sent',
        },
      });

      expect(showAndFocusApp).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(removeNotification).toHaveBeenCalledWith({
        notificationId: 'notif-manual-update',
        desktopNotification: undefined,
      });
    } finally {
      navigateSpy.mockRestore();
      waitSpy.mockRestore();
    }
  });
});
