import { setNotificationHandler } from 'expo-notifications';

import NotificationProvider from './NotificationProvider.native';

import type { INotificationProviderBaseParams } from './NotificationProviderBase';
import type { Notification } from 'expo-notifications';

jest.mock('expo-notifications', () => ({
  AndroidNotificationPriority: { DEFAULT: 'default' },
  addNotificationResponseReceivedListener: jest.fn(),
  setNotificationHandler: jest.fn(),
}));
jest.mock('expo-modules-core', () => ({
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/expo-notifications', () => ({
  setBadgeCountAsync: jest.fn(),
}));
jest.mock('./NotificationProviderBase', () => ({
  __esModule: true,
  default: class {
    options: INotificationProviderBaseParams['options'];
    constructor({ options }: INotificationProviderBaseParams) {
      this.options = options;
    }
    initWebSocketProvider() {}
  },
}));
jest.mock('../PushProvider/PushProviderJPush', () => ({
  PushProviderJPush: jest.fn(),
}));

describe('native foreground notification handler', () => {
  it.each([
    ['openSupportConversation', false],
    ['openHardwareSalesOrder', true],
  ])(
    'sets foreground presentation for %s without disabling badges',
    async (action, show) => {
      jest.clearAllMocks();
      const provider = new NotificationProvider({
        options: {
          disabledJPush: true,
          disabledWebSocket: true,
          instanceId: 'test-instance',
        },
        backgroundApi: {} as INotificationProviderBaseParams['backgroundApi'],
      });
      const handler = jest.mocked(setNotificationHandler).mock.calls[0][0];
      const incoming: Notification = {
        date: 0,
        request: {
          identifier: 'test-notification',
          trigger: null,
          content: {
            title: 'Test notification',
            subtitle: null,
            body: 'Test content',
            categoryIdentifier: null,
            sound: null,
            threadIdentifier: null,
            data: { extras: { mode: 6, payload: JSON.stringify({ action }) } },
          },
        },
      };
      const behavior = await handler?.handleNotification(incoming);
      expect(behavior).toEqual({
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: true,
        priority: 'default',
      });
      expect(provider).toBeDefined();
    },
  );
});
