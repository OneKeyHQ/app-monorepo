import NotificationProvider from './NotificationProvider.desktop';

import type { INotificationProviderBaseParams } from './NotificationProviderBase';

let mockFocused = true;
const mockNotification = jest.fn();
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => mockFocused,
}));
jest.mock('./NotificationProviderBase', () => ({
  __esModule: true,
  default: class {
    initWebSocketProvider() {}
    fixShowParams() {}
  },
}));

describe('desktop support notification presentation', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Notification');

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: mockNotification,
    });
  });

  afterAll(() => {
    if (original) {
      Object.defineProperty(globalThis, 'Notification', original);
    } else {
      Reflect.deleteProperty(globalThis, 'Notification');
    }
  });

  it.each([
    [true, 'openSupportConversation', false],
    [false, 'openSupportConversation', true],
    [true, 'openHardwareSalesOrder', true],
  ])(
    'checks live focus %p for %s before creating a system notification',
    async (focused, action, show) => {
      mockFocused = focused;
      const provider = new NotificationProvider({
        options: { instanceId: 'test-instance' },
        backgroundApi: {} as INotificationProviderBaseParams['backgroundApi'],
      });
      await provider.showNotification({
        title: 'Test notification',
        description: 'Test content',
        notificationId: 'test-msg',
        remotePushMessageInfo: {
          title: 'Test notification',
          content: 'Test content',
          extras: {
            mode: 6,
            payload: JSON.stringify({ action }),
          },
        },
      } as Parameters<NotificationProvider['showNotification']>[0]);
      expect(mockNotification).toHaveBeenCalledTimes(show ? 1 : 0);
    },
  );
});
