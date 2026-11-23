import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { ILiveActivitySubscriptionRequest } from '@onekeyhq/shared/types/liveActivity';

import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';

import {
  createServerLiveActivitySubscriptionTransport,
  liveActivityRemoteTracking,
} from './subscriptionTransport';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@onekeyhq/shared/src/platformEnv').default,
    isNativeIOS: true,
    isDev: true,
  },
}));

jest.mock('../../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: { get: jest.fn() },
}));

const subscription: ILiveActivitySubscriptionRequest = {
  schemaVersion: 1,
  activityId: 'Test-Activity-123',
  order: {
    schemaVersion: 1,
    orderKey: 'swap:Test-Order-123',
    serviceOrderId: 'Test-Order-123',
    depositTxId: 'test-deposit',
    networkId: 'btc--0',
    provider: 'test-provider',
    fromToken: { symbol: 'BTC', networkName: 'Bitcoin', iconUrl: '' },
    toToken: { symbol: 'USDC', networkName: 'Ethereum', iconUrl: '' },
    startedAtMs: 1_800_000_000_000,
    estimatedEndAtMs: 1_800_000_600_000,
    expiresAtMs: 1_800_028_800_000,
    isMock: false,
  },
};

describe('Notification Live Activity transport', () => {
  const post = jest.fn();
  const deleteRequest = jest.fn();
  const transport = createServerLiveActivitySubscriptionTransport({
    post,
    delete: deleteRequest,
  });

  beforeEach(() => {
    post.mockReset();
    deleteRequest.mockReset();
  });

  it('subscribes with only the five Notification fields and reads its acknowledgement', async () => {
    const data = {
      status: 'registered',
      subscriptionId: 'test-subscription',
      revision: 0,
    };
    post.mockResolvedValueOnce({ data: { code: 0, data } });

    await expect(transport.subscribe(subscription)).resolves.toEqual(data);
    expect(post).toHaveBeenCalledWith(
      '/notification/v1/live-activities/subscriptions',
      {
        schemaVersion: 1,
        activityId: 'Test-Activity-123',
        bizType: 'swapOrder',
        bizId: 'Test-Order-123',
        expiresAtMs: 1_800_028_800_000,
      },
    );
  });

  it('never falls back to a local key or deposit ID when the service order ID is absent', async () => {
    await expect(
      transport.subscribe({
        ...subscription,
        order: { ...subscription.order, serviceOrderId: undefined },
      }),
    ).rejects.toThrow('Invalid Live Activity subscription');
    expect(post).not.toHaveBeenCalled();
  });

  it('allows the explicit synthetic push test and keeps ordinary mocks local', async () => {
    const order = { ...subscription.order, isMock: true };
    await expect(
      transport.subscribe({ ...subscription, order }),
    ).rejects.toThrow('Invalid Live Activity subscription');
    expect(post).not.toHaveBeenCalled();

    const data = {
      status: 'registered',
      subscriptionId: 'test-subscription',
      revision: 0,
    };
    post.mockResolvedValueOnce({ data: { code: 0, data } });
    await expect(
      transport.subscribe({
        ...subscription,
        order: { ...order, isPushTest: true },
      }),
    ).resolves.toEqual(data);
  });

  it('rejects a malformed acknowledgement after HTTP success', async () => {
    post.mockResolvedValueOnce({
      data: { code: 0, data: { status: 'registered', revision: 0 } },
    });
    await expect(transport.subscribe(subscription)).rejects.toThrow(
      'Invalid Live Activity subscription response',
    );
  });

  it('preserves the numeric business error when an endpoint returns it as HTTP 200', async () => {
    post.mockResolvedValueOnce({ data: { code: 80_012 } });
    await expect(transport.subscribe(subscription)).rejects.toMatchObject({
      code: 80_012,
      autoToast: false,
    });
  });

  it('treats an already removed subscription as a successful DELETE', async () => {
    deleteRequest.mockResolvedValueOnce({
      data: { code: 0, data: { removed: false } },
    });
    await expect(
      transport.unsubscribe({
        activityId: subscription.activityId,
        orderKey: subscription.order.orderKey,
        reason: 'dismissed',
      }),
    ).resolves.toBeUndefined();
    expect(deleteRequest).toHaveBeenCalledWith(
      '/notification/v1/live-activities/subscriptions/Test-Activity-123',
    );
  });

  it('rejects invalid activity IDs before constructing a DELETE URL', async () => {
    await expect(
      transport.unsubscribe({
        activityId: 'invalid/activity',
        orderKey: subscription.order.orderKey,
        reason: 'dismissed',
      }),
    ).rejects.toThrow('Invalid Live Activity ID');
    expect(deleteRequest).not.toHaveBeenCalled();
  });
});

describe('test environment Live Activity gate', () => {
  it.each([EServiceEndpointEnum.Notification, EServiceEndpointEnum.Swap])(
    'rejects a production override for %s while API Switch is set to test',
    async (serviceModule) => {
      jest.mocked(devSettingsPersistAtom.get).mockResolvedValueOnce({
        enabled: true,
        settings: {
          enableTestEndpoint: true,
          customApiEndpoints: [
            {
              id: 'custom-endpoint',
              name: 'Custom endpoint',
              enabled: true,
              api: endpointsMap.prod[serviceModule],
              serviceModule,
            },
          ],
        },
      });

      await expect(liveActivityRemoteTracking.isReady()).resolves.toBe(false);
    },
  );

  it('allows the standard test endpoints', async () => {
    jest.mocked(devSettingsPersistAtom.get).mockResolvedValueOnce({
      enabled: true,
      settings: { enableTestEndpoint: true },
    });
    await expect(liveActivityRemoteTracking.isReady()).resolves.toBe(true);
  });

  it('stays disabled when the environment cannot be read', async () => {
    jest.mocked(devSettingsPersistAtom.get).mockRejectedValueOnce(new Error());
    await expect(liveActivityRemoteTracking.isReady()).resolves.toBe(false);
  });
});
