import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  ENotificationCommand,
  ENotificationPushMessageMode,
} from '@onekeyhq/shared/types/notification';

import ServiceNotification from './ServiceNotification';

jest.mock('@react-navigation/native', () => ({
  CommonActions: { reset: jest.fn() },
  StackActions: { push: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/extUtils', () => ({
  __esModule: true,
  default: { openExpandTab: jest.fn(async () => undefined) },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

describe('support notification delivery across startup', () => {
  const previousIsInBackground = globalThis.$onekeyIsInBackground;
  const previousProxy = appGlobals.$backgroundApiProxy;
  const previousIsExtensionBackground = platformEnv.isExtensionBackground;
  let service: ServiceNotification;
  const mockIsLocked = jest.fn(async () => false);

  beforeEach(() => {
    globalThis.$onekeyIsInBackground = true;
    service = new ServiceNotification({
      backgroundApi: { serviceApp: { isAppLocked: mockIsLocked } },
    });
    appGlobals.$backgroundApiProxy = {
      serviceNotification: service,
    } as typeof appGlobals.$backgroundApiProxy;
    jest.clearAllMocks();
  });

  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousIsInBackground;
    appGlobals.$backgroundApiProxy = previousProxy;
    platformEnv.isExtensionBackground = previousIsExtensionBackground;
    jest.restoreAllMocks();
  });

  it.each([
    ['conversation-123', 'conversation-123'],
    [undefined, undefined],
    [' ', undefined],
  ])(
    'queues conversation id %p until a foreground claims it exactly once',
    async (conversationId, expectedId) => {
      const request = jest.spyOn(service, 'requestOpenSupportConversation');
      const fallback = jest.fn();

      expect(
        parseNotificationPayload(
          ENotificationPushMessageMode.command,
          JSON.stringify({
            action: 'openSupportConversation',
            data: { conversationId },
          }),
          fallback,
        ),
      ).toBe(true);
      await request.mock.results[0].value;
      expect(fallback).not.toHaveBeenCalled();

      const claims = await Promise.all([
        service.takePendingSupportConversation(),
        service.takePendingSupportConversation(),
      ]);
      expect(claims).toEqual([{ conversationId: expectedId }, undefined]);
    },
  );

  it('opens the extension UI before announcing the command and preserves the pending id', async () => {
    platformEnv.isExtensionBackground = true;
    const emit = jest.spyOn(appEventBus, 'emit');

    await service.requestOpenSupportConversation({
      conversationId: 'conversation-123',
    });

    expect(extUtils.openExpandTab).toHaveBeenCalledWith({});
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.ExecuteNotificationCommand,
      {
        action: ENotificationCommand.openSupportConversation,
      },
    );
    expect(
      jest.mocked(extUtils.openExpandTab).mock.invocationCallOrder[0],
    ).toBeLessThan(emit.mock.invocationCallOrder[0]);
    await expect(service.takePendingSupportConversation()).resolves.toEqual({
      conversationId: 'conversation-123',
    });
  });

  it('targets the originating unlocked UI without creating another wallet tab', async () => {
    platformEnv.isExtensionBackground = true;
    mockIsLocked.mockResolvedValueOnce(false);
    const emit = jest.spyOn(appEventBus, 'emit');
    await service.requestOpenSupportConversation({
      conversationId: 'c',
      sourceNodeId: 'popup',
    });
    expect(extUtils.openExpandTab).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.ExecuteNotificationCommand,
      {
        action: ENotificationCommand.openSupportConversation,
        data: { targetNodeId: 'popup' },
      },
    );
    // If the popup closes before claiming, the next expand tab can recover it.
    await expect(service.takePendingSupportConversation()).resolves.toEqual({
      conversationId: 'c',
    });
    await expect(
      service.takePendingSupportConversation(),
    ).resolves.toBeUndefined();
  });

  it('moves a locked UI request to the expand tab for unlock', async () => {
    platformEnv.isExtensionBackground = true;
    mockIsLocked.mockResolvedValueOnce(true);
    const emit = jest.spyOn(appEventBus, 'emit');
    await service.requestOpenSupportConversation({
      conversationId: 'c',
      sourceNodeId: 'popup',
    });
    expect(extUtils.openExpandTab).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.ExecuteNotificationCommand,
      {
        action: ENotificationCommand.openSupportConversation,
      },
    );
    await expect(service.takePendingSupportConversation()).resolves.toEqual({
      conversationId: 'c',
    });
  });

  it('rejects a non-string conversation id before queuing', () => {
    const fallback = jest.fn();
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.command,
        JSON.stringify({
          action: 'openSupportConversation',
          data: { conversationId: 123 },
        }),
        fallback,
      ),
    ).toBe(false);
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
