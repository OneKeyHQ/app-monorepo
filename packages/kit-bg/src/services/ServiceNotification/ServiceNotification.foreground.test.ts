import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ENotificationPushMessageMode,
  ENotificationPushTopicTypes,
  type INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';

import {
  notificationsAtom,
  notificationsDevSettingsPersistAtom,
} from '../../states/jotai/atoms';

import ServiceNotification from './ServiceNotification';

let mockFocused = true;
const mockShow = jest.fn(async () => ({ notificationId: 'test-msg' }));
const mockAck = jest.fn(async () => {});
const mockBadge = jest.fn(async () => {});
const mockWrite = jest.fn(async () => {});
const mockEmit = jest.fn();
jest.mock('@react-navigation/native', () => ({
  CommonActions: { reset: jest.fn() },
  StackActions: { push: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => mockFocused,
}));

function notification(
  action = 'openSupportConversation',
): INotificationPushMessageInfo {
  return {
    pushSource: 'websocket',
    title: 'Test notification',
    content: 'Test content',
    extras: {
      msgId: 'test-msg',
      mode: ENotificationPushMessageMode.command,
      payload: JSON.stringify({ action }),
      topic: ENotificationPushTopicTypes.accountActivity,
      params: {
        msgId: 'test-msg',
        accountAddress: '',
        accountId: '',
        networkId: '',
        transactionHash: '',
      },
    },
  };
}

describe('foreground support notification presentation', () => {
  const previousBackground = globalThis.$onekeyIsInBackground;
  const previousNative = platformEnv.isNative;
  const previousExtension = platformEnv.isExtension;
  let service: ServiceNotification;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.$onekeyIsInBackground = true;
    platformEnv.isNative = previousNative;
    jest.spyOn(notificationsDevSettingsPersistAtom, 'get').mockResolvedValue({
      showMessagePushSource: false,
    });
    jest.spyOn(notificationsAtom, 'set').mockImplementation(mockWrite);
    service = new ServiceNotification({ backgroundApi: {} });
    jest.spyOn(service, 'ackNotificationMessage').mockImplementation(mockAck);
    jest
      .spyOn(service, 'increaseBadgeCountWhenNotificationReceived')
      .mockImplementation(mockBadge);
    jest.spyOn(service, 'isNotificationShowed').mockResolvedValue(false);
    jest.spyOn(service, 'showNotification').mockImplementation(mockShow);
    jest.spyOn(appEventBus, 'emit').mockImplementation(mockEmit);
    mockFocused = true;
  });

  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousBackground;
    platformEnv.isNative = previousNative;
    platformEnv.isExtension = previousExtension;
    jest.restoreAllMocks();
  });

  it('silences foreground support without dropping acknowledgements, refreshes or badges', async () => {
    platformEnv.isNative = true;
    await service.setSupportNotificationForeground({ isForeground: true });
    const message = notification();
    await service.onNotificationReceived(message);
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockAck).toHaveBeenCalled();
    expect(mockBadge).toHaveBeenCalledWith(message);
    expect(mockWrite).toHaveBeenCalled();
    expect(service.showedNotificationIds).toContain('test-msg');
  });

  it('keeps background support notifications without an additional in-app toast', async () => {
    platformEnv.isNative = true;
    await service.setSupportNotificationForeground({ isForeground: false });
    await service.onNotificationReceived(notification());
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('uses live desktop visibility instead of the native runtime relay', async () => {
    platformEnv.isNative = false;
    await service.setSupportNotificationForeground({ isForeground: false });
    await service.onNotificationReceived(notification());
    expect(mockShow).not.toHaveBeenCalled();
    mockFocused = false;
    await service.onNotificationReceived(notification());
    expect(mockShow).toHaveBeenCalledTimes(1);
  });

  it('preserves non-support system notifications while the app is foregrounded', async () => {
    platformEnv.isNative = true;
    await service.setSupportNotificationForeground({ isForeground: true });
    await service.onNotificationReceived(
      notification('openHardwareSalesOrder'),
    );
    expect(mockShow).toHaveBeenCalledTimes(1);
  });

  it('defaults to delivering when a native foreground relay has not arrived', async () => {
    platformEnv.isNative = true;
    await service.onNotificationReceived(notification());
    expect(mockShow).toHaveBeenCalledTimes(1);
  });

  it('does not treat the extension background runtime as a visible wallet UI', async () => {
    platformEnv.isNative = false;
    platformEnv.isExtension = true;
    await service.onNotificationReceived(notification());
    expect(mockShow).toHaveBeenCalledTimes(1);
  });
});
