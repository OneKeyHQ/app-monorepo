import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IEarnServerOrderDetail } from '@onekeyhq/shared/types/staking';

import ServiceStaking from './ServiceStaking';

// Server-executed orders (OK-61790, Unitas Booster): the stake / unstake
// response has no transaction to sign, so the client polls the order until
// the server reports a final status.

function createOrder(
  status: IEarnServerOrderDetail['status'],
): IEarnServerOrderDetail {
  return {
    orderId: 'order-1',
    provider: 'unitas',
    networkId: 'evm--56',
    action: 'stake',
    status,
    txId: status === 'success' ? '0xabc' : undefined,
  };
}

function createHarness(responses: Array<IEarnServerOrderDetail | Error>) {
  const service = new ServiceStaking({
    backgroundApi: {
      serviceAccount: {
        getAccount: jest
          .fn()
          .mockResolvedValue({ indexedAccountId: 'hd-1--0' }),
      },
    },
  });
  const getEarnOrderDetail = jest.spyOn(service, 'getEarnOrderDetail');
  responses.forEach((response) => {
    if (response instanceof Error) {
      getEarnOrderDetail.mockRejectedValueOnce(response);
    } else {
      getEarnOrderDetail.mockResolvedValueOnce(response);
    }
  });
  return { service, getEarnOrderDetail };
}

// @backgroundMethod guards against UI-thread calls; the service is exercised
// directly here.
beforeAll(() => {
  (globalThis as { $onekeyIsInBackground?: boolean }).$onekeyIsInBackground =
    true;
});

afterAll(() => {
  delete (globalThis as { $onekeyIsInBackground?: boolean })
    .$onekeyIsInBackground;
});

const params = {
  networkId: 'evm--56',
  accountId: 'hd-1--evm--56',
  orderId: 'order-1',
  intervalMs: 1,
  timeoutMs: 200,
};

describe('ServiceStaking.waitForServerExecutedOrder', () => {
  it('keeps polling through created / pending until the order succeeds', async () => {
    const { service, getEarnOrderDetail } = createHarness([
      createOrder('created'),
      createOrder('pending'),
      createOrder('success'),
    ]);

    const result = await service.waitForServerExecutedOrder(params);

    expect(result.status).toBe('success');
    expect(result.order?.txId).toBe('0xabc');
    expect(getEarnOrderDetail).toHaveBeenCalledTimes(3);
    expect(getEarnOrderDetail).toHaveBeenCalledWith({
      networkId: params.networkId,
      accountId: params.accountId,
      orderId: params.orderId,
    });
  });

  it('reports a failed order as failed', async () => {
    const { service } = createHarness([createOrder('failed')]);

    const result = await service.waitForServerExecutedOrder(params);

    expect(result.status).toBe('failed');
    expect(result.order?.status).toBe('failed');
  });

  it('can return as soon as the server provides a transaction hash', async () => {
    const submitted = { ...createOrder('pending'), txId: '0xabc' };
    const { service, getEarnOrderDetail } = createHarness([
      createOrder('created'),
      submitted,
    ]);

    await expect(
      service.waitForServerExecutedOrder({
        ...params,
        returnOnBroadcast: true,
      }),
    ).resolves.toEqual({ status: 'submitted', order: submitted });
    expect(getEarnOrderDetail).toHaveBeenCalledTimes(2);
  });

  it('ignores transient request errors', async () => {
    const { service, getEarnOrderDetail } = createHarness([
      new Error('network down'),
      createOrder('success'),
    ]);

    const result = await service.waitForServerExecutedOrder(params);

    expect(result.status).toBe('success');
    expect(getEarnOrderDetail).toHaveBeenCalledTimes(2);
  });

  it('returns timeout with the last seen order when nothing settles', async () => {
    const { service, getEarnOrderDetail } = createHarness([]);
    getEarnOrderDetail.mockResolvedValue(createOrder('pending'));

    const result = await service.waitForServerExecutedOrder({
      ...params,
      timeoutMs: 20,
    });

    expect(result.status).toBe('timeout');
    expect(result.order?.status).toBe('pending');
  });
});

describe('server order completion notifications', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['success', 'failed'] as const)(
    'notifies the original scope on %s after the caller dismisses',
    async (status) => {
      const emit = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
      const { service, getEarnOrderDetail } = createHarness([]);
      let settle!: (order: IEarnServerOrderDetail) => void;
      getEarnOrderDetail.mockReturnValue(
        new Promise((resolve) => {
          settle = resolve;
        }),
      );
      const waiting = service.waitForServerExecutedOrder({
        ...params,
        refreshScope: { provider: 'Unitas', vault: 'vault-1' },
      });
      await expect(
        Promise.race([waiting, Promise.resolve('dismissed')]),
      ).resolves.toBe('dismissed');
      expect(emit).not.toHaveBeenCalled();
      settle(createOrder(status));
      await waiting;
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith(
        EAppEventBusNames.EarnServerOrderSettled,
        {
          accountId: params.accountId,
          indexedAccountId: 'hd-1--0',
          networkId: params.networkId,
          provider: 'unitas',
          vault: 'vault-1',
          orderId: params.orderId,
          status,
        },
      );
    },
  );

  it('does not report timeout as settlement', async () => {
    const emit = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
    const { service, getEarnOrderDetail } = createHarness([]);
    getEarnOrderDetail.mockResolvedValue(createOrder('pending'));
    const result = await service.waitForServerExecutedOrder({
      ...params,
      timeoutMs: 0,
      refreshScope: { provider: 'unitas' },
    });
    expect(result.status).toBe('timeout');
    expect(emit).not.toHaveBeenCalled();
  });
});
