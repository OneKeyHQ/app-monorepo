/* eslint-disable import/first */

const mockSocketHandlers = new Map<string, (payload: unknown) => unknown>();
const mockSocketOn = jest.fn(
  (event: string, handler: (payload: unknown) => unknown) => {
    mockSocketHandlers.set(event, handler);
  },
);
const mockSocket = {
  connected: true,
  id: 'socket-1',
  on: mockSocketOn,
  emit: jest.fn(),
  timeout: jest.fn(),
};
const mockIo = jest.fn(() => mockSocket);
const mockGetEndpointInfo = jest.fn<
  Promise<{ endpoint: string; name: EServiceEndpointEnum }>,
  [{ name: EServiceEndpointEnum }]
>();
const mockAppEventEmit = jest.fn();
const mockConsoleLog = jest.fn();
const mockOneKeyIdLogoutLog = jest.fn();
const mockNotificationStatusSet = jest.fn();

jest.mock('socket.io-client', () => ({
  io: () => mockIo(),
}));

jest.mock('../../../endpoints', () => ({
  getEndpointInfo: (params: { name: EServiceEndpointEnum }) =>
    mockGetEndpointInfo(params),
}));

jest.mock('../../../states/jotai/atoms/notifications', () => ({
  notificationStatusAtom: {
    set: (...args: unknown[]) => {
      mockNotificationStatusSet(...args);
    },
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    PrimeDeviceLogout: 'PrimeDeviceLogout',
  },
  appEventBus: {
    emit: (...args: unknown[]) => {
      mockAppEventEmit(...args);
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    notification: {
      websocket: {
        consoleLog: (...args: unknown[]) => {
          mockConsoleLog(...args);
        },
      },
    },
    prime: {
      subscription: {
        onekeyIdLogout: (...args: unknown[]) => {
          mockOneKeyIdLogoutLog(...args);
        },
      },
    },
  },
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { ENotificationPushMessageAckAction } from '@onekeyhq/shared/types/notification';
import type { IIdentityExitPlanId } from '@onekeyhq/shared/types/prime/identityExitTypes';
import type { IPrimeDeviceLogoutInfo } from '@onekeyhq/shared/types/socket';
import { EAppSocketEventNames } from '@onekeyhq/shared/types/socket';

import { PushProviderWebSocket } from './PushProviderWebSocket';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { NotificationEventEmitter } from '../NotificationEventEmitter';

type IAckNotificationMessage =
  IBackgroundApi['serviceNotification']['ackNotificationMessage'];
type IStageRemoteOneKeyIdLogoutNotification =
  IBackgroundApi['serviceIdentityExit']['stageRemoteOneKeyIdLogoutNotification'];
type IExecuteIdentityExit =
  IBackgroundApi['serviceIdentityExit']['executeIdentityExit'];
type IMarkRemoteOneKeyIdLogoutNotificationDelivered =
  IBackgroundApi['serviceIdentityExit']['markRemoteOneKeyIdLogoutNotificationDelivered'];
type IGetPendingRemoteOneKeyIdLogoutNotifications =
  IBackgroundApi['serviceIdentityExit']['getPendingRemoteOneKeyIdLogoutNotifications'];

function createFixture() {
  const ackNotificationMessage = jest
    .fn<
      ReturnType<IAckNotificationMessage>,
      Parameters<IAckNotificationMessage>
    >()
    .mockResolvedValue(undefined);
  const stageRemoteOneKeyIdLogoutNotification = jest
    .fn<
      ReturnType<IStageRemoteOneKeyIdLogoutNotification>,
      Parameters<IStageRemoteOneKeyIdLogoutNotification>
    >()
    .mockResolvedValue({
      operationId: 'remoteDeviceLogout:logout-message-1',
      planId:
        'system:remoteDeviceLogout:logout-message-1' as IIdentityExitPlanId,
      acknowledged: false,
      presentationHandled: false,
    });
  const executeIdentityExit = jest.fn<
    ReturnType<IExecuteIdentityExit>,
    Parameters<IExecuteIdentityExit>
  >();
  const markRemoteOneKeyIdLogoutNotificationDelivered = jest
    .fn<
      ReturnType<IMarkRemoteOneKeyIdLogoutNotificationDelivered>,
      Parameters<IMarkRemoteOneKeyIdLogoutNotificationDelivered>
    >()
    .mockResolvedValue({ updated: true });
  const getPendingRemoteOneKeyIdLogoutNotifications = jest
    .fn<
      ReturnType<IGetPendingRemoteOneKeyIdLogoutNotifications>,
      Parameters<IGetPendingRemoteOneKeyIdLogoutNotifications>
    >()
    .mockResolvedValue([]);
  const backgroundApi = {
    serviceNotification: {
      ackNotificationMessage,
    },
    serviceIdentityExit: {
      executeIdentityExit,
      getPendingRemoteOneKeyIdLogoutNotifications,
      markRemoteOneKeyIdLogoutNotificationDelivered,
      stageRemoteOneKeyIdLogoutNotification,
    },
  } as unknown as IBackgroundApi;
  const eventEmitter = {
    emit: jest.fn(),
  } as unknown as NotificationEventEmitter;

  const provider = new PushProviderWebSocket({
    backgroundApi,
    eventEmitter,
    instanceId: 'instance-1',
  });

  return {
    ackNotificationMessage,
    executeIdentityExit,
    getPendingRemoteOneKeyIdLogoutNotifications,
    markRemoteOneKeyIdLogoutNotificationDelivered,
    provider,
    stageRemoteOneKeyIdLogoutNotification,
  };
}

async function getSocketHandler<TPayload>(
  event: string,
): Promise<(payload: TPayload) => Promise<void>> {
  await Promise.resolve();
  const handler = mockSocketHandlers.get(event);
  if (!handler) {
    throw new OneKeyLocalError(
      `WebSocket handler was not registered: ${event}`,
    );
  }
  return async (payload) => {
    await handler(payload);
  };
}

async function getPrimeDeviceLogoutHandler(): Promise<
  (payload: IPrimeDeviceLogoutInfo) => Promise<void>
> {
  return getSocketHandler<IPrimeDeviceLogoutInfo>(
    EAppSocketEventNames.primeDeviceLogout,
  );
}

const logoutPayload: IPrimeDeviceLogoutInfo = {
  msgId: 'logout-message-1',
  id: 'device-1',
  emails: ['user@example.com'],
};

describe('PushProviderWebSocket prime device logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketHandlers.clear();
    mockGetEndpointInfo.mockResolvedValue({
      endpoint: 'wss://notification.example.com',
      name: EServiceEndpointEnum.NotificationWebSocket,
    });
  });

  test('does not ACK when durable remote logout staging rejects', async () => {
    const fixture = createFixture();
    fixture.stageRemoteOneKeyIdLogoutNotification.mockRejectedValue(
      new OneKeyLocalError('Remote logout journal could not be persisted'),
    );
    const handler = await getPrimeDeviceLogoutHandler();

    await handler(logoutPayload);

    expect(fixture.stageRemoteOneKeyIdLogoutNotification).toHaveBeenCalledWith({
      messageId: logoutPayload.msgId,
    });
    expect(fixture.ackNotificationMessage).not.toHaveBeenCalled();
    expect(fixture.executeIdentityExit).not.toHaveBeenCalled();
    expect(mockAppEventEmit).not.toHaveBeenCalled();
  });

  test('ACKs only after durable staging and retains retry when execution rejects', async () => {
    const fixture = createFixture();
    const reconciliationError = new OneKeyLocalError(
      'Remote identity reconciliation failed',
    );
    fixture.executeIdentityExit.mockRejectedValue(reconciliationError);
    const handler = await getPrimeDeviceLogoutHandler();

    await handler(logoutPayload);

    expect(fixture.stageRemoteOneKeyIdLogoutNotification).toHaveBeenCalledTimes(
      1,
    );
    expect(fixture.ackNotificationMessage).toHaveBeenCalledTimes(1);
    expect(fixture.ackNotificationMessage).toHaveBeenCalledWith({
      msgId: logoutPayload.msgId,
      action: ENotificationPushMessageAckAction.arrived,
    });
    expect(fixture.executeIdentityExit).toHaveBeenCalledTimes(1);
    expect(
      fixture.stageRemoteOneKeyIdLogoutNotification.mock.invocationCallOrder[0],
    ).toBeLessThan(fixture.ackNotificationMessage.mock.invocationCallOrder[0]);
    expect(
      fixture.ackNotificationMessage.mock.invocationCallOrder[0],
    ).toBeLessThan(fixture.executeIdentityExit.mock.invocationCallOrder[0]);
    expect(
      fixture.markRemoteOneKeyIdLogoutNotificationDelivered,
    ).toHaveBeenCalledWith({
      operationId: 'remoteDeviceLogout:logout-message-1',
      messageId: logoutPayload.msgId,
      delivery: 'acknowledged',
    });
    expect(
      fixture.markRemoteOneKeyIdLogoutNotificationDelivered,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({ delivery: 'presentationHandled' }),
    );
    expect(mockAppEventEmit).not.toHaveBeenCalled();
  });

  test('continues local reconciliation when the server ACK fails', async () => {
    const fixture = createFixture();
    fixture.ackNotificationMessage.mockRejectedValue(
      new OneKeyLocalError('Notification ACK timed out'),
    );
    fixture.executeIdentityExit.mockResolvedValue({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    const handler = await getPrimeDeviceLogoutHandler();

    await handler(logoutPayload);

    expect(fixture.executeIdentityExit).toHaveBeenCalledTimes(1);
    expect(
      fixture.markRemoteOneKeyIdLogoutNotificationDelivered,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({ delivery: 'acknowledged' }),
    );
    expect(mockAppEventEmit).toHaveBeenCalledWith(
      EAppEventBusNames.PrimeDeviceLogout,
      {
        operationId: 'remoteDeviceLogout:logout-message-1',
        messageId: logoutPayload.msgId,
      },
    );
  });

  test('continues local reconciliation when durable ACK metadata needs retry', async () => {
    const fixture = createFixture();
    fixture.markRemoteOneKeyIdLogoutNotificationDelivered.mockRejectedValueOnce(
      new OneKeyLocalError('ACK metadata persistence failed'),
    );
    fixture.executeIdentityExit.mockResolvedValue({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    const handler = await getPrimeDeviceLogoutHandler();

    await handler(logoutPayload);

    expect(fixture.executeIdentityExit).toHaveBeenCalledTimes(1);
    expect(mockAppEventEmit).toHaveBeenCalledWith(
      EAppEventBusNames.PrimeDeviceLogout,
      {
        operationId: 'remoteDeviceLogout:logout-message-1',
        messageId: logoutPayload.msgId,
      },
    );
  });

  test('settles presentation without a dialog when no OneKey ID was logged out', async () => {
    const fixture = createFixture();
    fixture.executeIdentityExit.mockResolvedValue({
      status: 'completed',
      oneKeyIdLoggedOut: false,
    });
    const handler = await getPrimeDeviceLogoutHandler();

    await handler(logoutPayload);

    expect(mockAppEventEmit).not.toHaveBeenCalled();
    expect(
      fixture.markRemoteOneKeyIdLogoutNotificationDelivered,
    ).toHaveBeenCalledWith({
      operationId: 'remoteDeviceLogout:logout-message-1',
      messageId: logoutPayload.msgId,
      delivery: 'presentationHandled',
    });
  });

  test('emits PrimeDeviceLogout only after staged reconciliation completes', async () => {
    const fixture = createFixture();
    fixture.executeIdentityExit.mockResolvedValue({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    const handler = await getPrimeDeviceLogoutHandler();

    await handler(logoutPayload);

    expect(fixture.executeIdentityExit).toHaveBeenCalledTimes(1);
    expect(fixture.ackNotificationMessage).toHaveBeenCalledTimes(1);
    expect(fixture.ackNotificationMessage).toHaveBeenCalledWith({
      msgId: logoutPayload.msgId,
      action: ENotificationPushMessageAckAction.arrived,
    });
    expect(mockAppEventEmit).toHaveBeenCalledTimes(1);
    expect(mockAppEventEmit).toHaveBeenCalledWith(
      EAppEventBusNames.PrimeDeviceLogout,
      {
        operationId: 'remoteDeviceLogout:logout-message-1',
        messageId: logoutPayload.msgId,
      },
    );
    expect(
      fixture.executeIdentityExit.mock.invocationCallOrder[0],
    ).toBeLessThan(mockAppEventEmit.mock.invocationCallOrder[0]);
    expect(
      fixture.markRemoteOneKeyIdLogoutNotificationDelivered,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({ delivery: 'presentationHandled' }),
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      'WebSocket reconciled primeDeviceLogout message',
      { msgId: logoutPayload.msgId },
    );
    expect(JSON.stringify(mockConsoleLog.mock.calls)).not.toContain(
      logoutPayload.emails[0],
    );
  });

  test('retries a durable remote logout when the socket connects again', async () => {
    const fixture = createFixture();
    fixture.getPendingRemoteOneKeyIdLogoutNotifications.mockResolvedValue([
      {
        operationId: 'remoteDeviceLogout:pending-message',
        planId:
          'system:remoteDeviceLogout:pending-message' as IIdentityExitPlanId,
        messageId: 'pending-message',
        needsAcknowledgement: true,
        needsPresentation: true,
      },
    ]);
    fixture.executeIdentityExit.mockResolvedValue({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    const connectHandler = await getSocketHandler<void>('connect');

    await connectHandler();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(fixture.ackNotificationMessage).toHaveBeenCalledWith({
      msgId: 'pending-message',
      action: ENotificationPushMessageAckAction.arrived,
    });
    expect(fixture.executeIdentityExit).toHaveBeenCalledWith({
      planId: 'system:remoteDeviceLogout:pending-message',
    });
    expect(mockAppEventEmit).toHaveBeenCalledWith(
      EAppEventBusNames.PrimeDeviceLogout,
      {
        operationId: 'remoteDeviceLogout:pending-message',
        messageId: 'pending-message',
      },
    );
  });
});
