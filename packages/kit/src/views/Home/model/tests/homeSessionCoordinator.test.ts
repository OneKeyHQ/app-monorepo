import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';

import { HomeSessionCoordinator } from '../lifecycle/homeSessionCoordinator';
import { SplitRuntimeHomeAdapter } from '../runtime/splitRuntimeHomeAdapter';

const owner = {
  walletId: 'wallet-1',
  accountId: 'account-1',
  network: { kind: 'allNetworks' as const },
};

describe('Home session coordinator', () => {
  it('recovers a latched-ready session after transient handshake failures', async () => {
    const getHandshake = jest
      .fn()
      .mockRejectedValueOnce(new Error('background warming'))
      .mockRejectedValueOnce(new Error('transport reconnecting'))
      .mockResolvedValue({
        protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
        producerInstanceId: 'producer-1',
      });
    const wait = jest.fn(async () => undefined);
    const coordinator = new HomeSessionCoordinator({
      adapter: new SplitRuntimeHomeAdapter({ getHandshake }),
      createSessionId: () => 'session-1',
      retryDelaysMs: [100, 500],
      wait,
    });

    coordinator.setOwner(owner);
    await coordinator.connectCurrent();

    expect(getHandshake).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'active',
      producerInstanceId: 'producer-1',
    });
  });

  it('enters degraded only after the bounded retry budget is exhausted', async () => {
    const getHandshake = jest.fn(async () =>
      Promise.reject(new Error('background unavailable')),
    );
    const coordinator = new HomeSessionCoordinator({
      adapter: new SplitRuntimeHomeAdapter({ getHandshake }),
      createSessionId: () => 'session-1',
      retryDelaysMs: [100],
      wait: async () => undefined,
    });

    coordinator.setOwner(owner);
    await coordinator.connectCurrent();

    expect(getHandshake).toHaveBeenCalledTimes(2);
    expect(coordinator.getSnapshot().status).toBe('degraded');
  });

  it('does not let a superseded failed handshake overwrite a newer success', async () => {
    let rejectFirst!: (reason?: unknown) => void;
    const first = new Promise<never>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const getHandshake = jest
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue({
        protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
        producerInstanceId: 'producer-2',
      });
    const adapter = new SplitRuntimeHomeAdapter({ getHandshake });
    const coordinator = new HomeSessionCoordinator({
      adapter,
      createSessionId: () => 'session-1',
      retryDelaysMs: [],
    });

    coordinator.setOwner(owner);
    const initialConnect = coordinator.connectCurrent();
    await coordinator.refreshHandshake();
    rejectFirst(new Error('superseded failure'));
    await initialConnect;

    expect(coordinator.getSnapshot()).toMatchObject({
      status: 'active',
      producerInstanceId: 'producer-2',
    });
  });
});
