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
import type { IPrimeDeviceLogoutInfo } from '@onekeyhq/shared/types/socket';
import { EAppSocketEventNames } from '@onekeyhq/shared/types/socket';

import { PushProviderWebSocket } from './PushProviderWebSocket';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { NotificationEventEmitter } from '../NotificationEventEmitter';

type IAckNotificationMessage =
  IBackgroundApi['serviceNotification']['ackNotificationMessage'];
type IReconcileRemoteOneKeyIdLogout =
  IBackgroundApi['serviceIdentityExit']['reconcileRemoteOneKeyIdLogout'];

function createFixture() {
  const ackNotificationMessage = jest
    .fn<
      ReturnType<IAckNotificationMessage>,
      Parameters<IAckNotificationMessage>
    >()
    .mockResolvedValue(undefined);
  const reconcileRemoteOneKeyIdLogout = jest.fn<
    ReturnType<IReconcileRemoteOneKeyIdLogout>,
    Parameters<IReconcileRemoteOneKeyIdLogout>
  >();
  const backgroundApi = {
    serviceNotification: {
      ackNotificationMessage,
    },
    serviceIdentityExit: {
      reconcileRemoteOneKeyIdLogout,
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
    provider,
    reconcileRemoteOneKeyIdLogout,
  };
}

async function getPrimeDeviceLogoutHandler(): Promise<
  (payload: IPrimeDeviceLogoutInfo) => Promise<void>
> {
  await Promise.resolve();
  const handler = mockSocketHandlers.get(
    EAppSocketEventNames.primeDeviceLogout,
  );
  if (!handler) {
    throw new OneKeyLocalError(
      'Prime device logout WebSocket handler was not registered.',
    );
  }
  return async (payload) => {
    await handler(payload);
  };
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

  test('does not emit PrimeDeviceLogout when identity reconciliation rejects', async () => {
    const fixture = createFixture();
    const reconciliationError = new OneKeyLocalError(
      'Remote identity reconciliation failed',
    );
    fixture.reconcileRemoteOneKeyIdLogout.mockRejectedValue(
      reconciliationError,
    );
    const handler = await getPrimeDeviceLogoutHandler();

    await handler(logoutPayload);

    expect(fixture.reconcileRemoteOneKeyIdLogout).toHaveBeenCalledTimes(1);
    expect(fixture.ackNotificationMessage).toHaveBeenCalledTimes(1);
    expect(fixture.ackNotificationMessage).toHaveBeenCalledWith({
      msgId: logoutPayload.msgId,
      action: ENotificationPushMessageAckAction.arrived,
    });
    expect(mockAppEventEmit).not.toHaveBeenCalledWith(
      EAppEventBusNames.PrimeDeviceLogout,
      undefined,
    );
  });

  test('does not emit PrimeDeviceLogout when identity reconciliation is blocked', async () => {
    const fixture = createFixture();
    fixture.reconcileRemoteOneKeyIdLogout.mockResolvedValue({
      status: 'blocked',
      code: 'STATE_CHANGED',
      message: 'Identity state changed.',
    });
    const handler = await getPrimeDeviceLogoutHandler();

    await handler(logoutPayload);

    expect(fixture.reconcileRemoteOneKeyIdLogout).toHaveBeenCalledTimes(1);
    expect(fixture.ackNotificationMessage).toHaveBeenCalledTimes(1);
    expect(fixture.ackNotificationMessage).toHaveBeenCalledWith({
      msgId: logoutPayload.msgId,
      action: ENotificationPushMessageAckAction.arrived,
    });
    expect(mockAppEventEmit).not.toHaveBeenCalledWith(
      EAppEventBusNames.PrimeDeviceLogout,
      undefined,
    );
  });

  test('emits PrimeDeviceLogout after identity reconciliation completes', async () => {
    const fixture = createFixture();
    fixture.reconcileRemoteOneKeyIdLogout.mockResolvedValue({
      status: 'completed',
      oneKeyIdLoggedOut: true,
    });
    const handler = await getPrimeDeviceLogoutHandler();

    await handler(logoutPayload);

    expect(fixture.reconcileRemoteOneKeyIdLogout).toHaveBeenCalledTimes(1);
    expect(fixture.ackNotificationMessage).toHaveBeenCalledTimes(1);
    expect(fixture.ackNotificationMessage).toHaveBeenCalledWith({
      msgId: logoutPayload.msgId,
      action: ENotificationPushMessageAckAction.arrived,
    });
    expect(mockAppEventEmit).toHaveBeenCalledTimes(1);
    expect(mockAppEventEmit).toHaveBeenCalledWith(
      EAppEventBusNames.PrimeDeviceLogout,
      undefined,
    );
    expect(
      fixture.reconcileRemoteOneKeyIdLogout.mock.invocationCallOrder[0],
    ).toBeLessThan(mockAppEventEmit.mock.invocationCallOrder[0]);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      'WebSocket received primeDeviceLogout message',
      { msgId: logoutPayload.msgId },
    );
    expect(JSON.stringify(mockConsoleLog.mock.calls)).not.toContain(
      logoutPayload.emails[0],
    );
  });
});
