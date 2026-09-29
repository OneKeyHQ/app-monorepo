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
  const service = new ServiceStaking({ backgroundApi: {} });
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
