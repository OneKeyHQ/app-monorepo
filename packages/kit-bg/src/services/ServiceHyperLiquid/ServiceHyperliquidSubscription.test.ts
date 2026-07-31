import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('@nktkas/hyperliquid', () => ({
  SubscriptionClient: jest.fn(),
  WebSocketTransport: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  return {
    ...actual,
    backgroundClass:
      () =>
      <T extends new (...args: never[]) => unknown>(ClassType: T) =>
        ClassType,
    backgroundMethod:
      () =>
      (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
        descriptor,
  };
});

function createService() {
  return new ServiceHyperliquidSubscription({
    backgroundApi: {} as IBackgroundApi,
  });
}

describe('ServiceHyperliquidSubscription Fast L2 lifecycle', () => {
  it('invalidates delayed recovery when the socket closes', () => {
    const service = createService();
    const internals = service as unknown as {
      _fastL2RecoveryGeneration: number;
    };
    internals._fastL2RecoveryGeneration = 4;

    service.socketCloseHandler({
      target: { readyState: 3 },
    } as unknown as WebSocketEventMap['close']);

    expect(internals._fastL2RecoveryGeneration).toBe(5);
  });

  it('invalidates delayed recovery when the client closes explicitly', async () => {
    const service = createService();
    const internals = service as unknown as {
      _closeClient: () => Promise<void>;
      _fastL2RecoveryGeneration: number;
    };
    internals._fastL2RecoveryGeneration = 4;

    await internals._closeClient();

    expect(internals._fastL2RecoveryGeneration).toBe(5);
  });
});

describe('ServiceHyperliquidSubscription liveness recovery', () => {
  it('rejects a proof older than the latest disable', async () => {
    const service = createService();
    const update = jest
      .spyOn(service, 'updateSubscriptions')
      .mockResolvedValue(undefined);
    await service.disableSubscriptionsHandler();
    const proofCount = await service.getSubscriptionsHandlerDisabledCount();
    await service.disableSubscriptionsHandler();

    await expect(
      service.recoverSubscriptionsAfterLivenessProof({
        disabledCount: proofCount,
      }),
    ).resolves.toBe(false);
    expect(service.subscriptionsHandlerDisabled).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('enables and reconciles when the proof matches the latest generation', async () => {
    const service = createService();
    const update = jest
      .spyOn(service, 'updateSubscriptions')
      .mockResolvedValue(undefined);
    await service.disableSubscriptionsHandler();
    const proofCount = await service.getSubscriptionsHandlerDisabledCount();

    await expect(
      service.recoverSubscriptionsAfterLivenessProof({
        disabledCount: proofCount,
      }),
    ).resolves.toBe(true);
    expect(service.subscriptionsHandlerDisabled).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
