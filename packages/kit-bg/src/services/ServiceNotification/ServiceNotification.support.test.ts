import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import {
  isSupportReplyPushMessage,
  parseNotificationPayload,
} from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  ENotificationCommand,
  ENotificationPushMessageMode,
  type INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';

import {
  notificationsAtom,
  notificationsDevSettingsPersistAtom,
} from '../../states/jotai/atoms';

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

  it('accepts a numeric conversation id and queues it as a string', async () => {
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
    ).toBe(true);
    expect(fallback).not.toHaveBeenCalled();
    await expect(service.takePendingSupportConversation()).resolves.toEqual({
      conversationId: '123',
    });
  });

  it('accepts a conversation id placed next to the action', async () => {
    const fallback = jest.fn();
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.command,
        JSON.stringify({
          action: 'openSupportConversation',
          conversationId: '499',
        }),
        fallback,
      ),
    ).toBe(true);
    expect(fallback).not.toHaveBeenCalled();
    await expect(service.takePendingSupportConversation()).resolves.toEqual({
      conversationId: '499',
    });
  });

  it('lets extras.params.conversationId override the payload id', async () => {
    const fallback = jest.fn();
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.command,
        JSON.stringify({
          action: 'openSupportConversation',
          data: { conversationId: 'payload-id' },
        }),
        fallback,
        { params: { conversationId: 'params-id' } },
      ),
    ).toBe(true);
    expect(fallback).not.toHaveBeenCalled();
    await expect(service.takePendingSupportConversation()).resolves.toEqual({
      conversationId: 'params-id',
    });
  });

  it('keeps the payload id when extras.params has no conversation id', async () => {
    const fallback = jest.fn();
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.command,
        JSON.stringify({
          action: 'openSupportConversation',
          data: { conversationId: 'payload-id' },
        }),
        fallback,
        { params: { conversationId: undefined, msgId: 'msg-1' } },
      ),
    ).toBe(true);
    expect(fallback).not.toHaveBeenCalled();
    await expect(service.takePendingSupportConversation()).resolves.toEqual({
      conversationId: 'payload-id',
    });
  });

  it.each([null, ''])(
    'falls back to the payload id when extras.params.conversationId is %p',
    async (paramsConversationId) => {
      const fallback = jest.fn();
      expect(
        parseNotificationPayload(
          ENotificationPushMessageMode.command,
          JSON.stringify({
            action: 'openSupportConversation',
            data: { conversationId: 'payload-id' },
          }),
          fallback,
          { params: { conversationId: paramsConversationId } },
        ),
      ).toBe(true);
      expect(fallback).not.toHaveBeenCalled();
      await expect(service.takePendingSupportConversation()).resolves.toEqual({
        conversationId: 'payload-id',
      });
    },
  );

  it('rejects an unusable conversation id before queuing', () => {
    const fallback = jest.fn();
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.command,
        JSON.stringify({
          action: 'openSupportConversation',
          data: { conversationId: { id: 123 } },
        }),
        fallback,
      ),
    ).toBe(false);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  // Shape of the support reply push in the OK-67112 logs.
  function createSupportReplyPush(
    extras: Partial<NonNullable<INotificationPushMessageInfo['extras']>> = {},
  ): INotificationPushMessageInfo {
    return {
      title: 'Support replied',
      content: 'You have a new support reply.',
      pushSource: 'jpush',
      extras: {
        msgId: 'support:1:2',
        mode: '6',
        payload: JSON.stringify({
          action: ENotificationCommand.openSupportConversation,
          data: {},
        }),
        params: { msgId: 'support:1:2' },
        ...extras,
      } as INotificationPushMessageInfo['extras'],
    };
  }

  it('recognizes support reply pushes by their command payload', () => {
    expect(isSupportReplyPushMessage(createSupportReplyPush())).toBe(true);
    expect(
      isSupportReplyPushMessage(
        createSupportReplyPush({ mode: ENotificationPushMessageMode.command }),
      ),
    ).toBe(true);
    expect(
      isSupportReplyPushMessage(
        createSupportReplyPush({ mode: ENotificationPushMessageMode.page }),
      ),
    ).toBe(false);
    expect(
      isSupportReplyPushMessage(
        createSupportReplyPush({
          payload: JSON.stringify({ action: 'openHardwareSalesOrder' }),
        }),
      ),
    ).toBe(false);
    expect(
      isSupportReplyPushMessage(createSupportReplyPush({ payload: '{' })),
    ).toBe(false);
    expect(isSupportReplyPushMessage(undefined)).toBe(false);
  });

  it('asks the foreground to resync Intercom unread state on a support reply', async () => {
    // Persisted atoms never hydrate in this suite.
    jest
      .spyOn(notificationsDevSettingsPersistAtom, 'get')
      .mockResolvedValue({ showMessagePushSource: false });
    jest.spyOn(notificationsAtom, 'set').mockResolvedValue(undefined);
    jest.spyOn(service, 'ackNotificationMessage').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'increaseBadgeCountWhenNotificationReceived')
      .mockResolvedValue(undefined);
    const emit = jest.spyOn(appEventBus, 'emit');

    await service.onNotificationReceived(createSupportReplyPush());
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.SupportReplyReceived,
      undefined,
    );

    emit.mockClear();
    await service.onNotificationReceived(
      createSupportReplyPush({
        payload: JSON.stringify({ action: 'openHardwareSalesOrder' }),
      }),
    );
    expect(emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.SupportReplyReceived,
      undefined,
    );
  });
});
