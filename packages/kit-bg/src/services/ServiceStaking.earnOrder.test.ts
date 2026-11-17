import axios from 'axios';

import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import ServiceStaking from './ServiceStaking';

const mockAddOrder = jest.fn<
  Promise<boolean | undefined>,
  [unknown, { preserveExistingTx: boolean }?]
>();
jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    earnOrders: {
      addOrder: (order: unknown, options?: { preserveExistingTx: boolean }) =>
        options ? mockAddOrder(order, options) : mockAddOrder(order),
    },
  },
}));

describe('Earn order registration', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  const order = {
    orderId: 'order-1',
    networkId: 'evm--1',
    txId: 'tx-1',
    status: EDecodedTxStatus.Pending,
  };

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });
  beforeEach(() => {
    mockAddOrder.mockReset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([true, undefined])(
    'synchronizes when registration is current or storage is unavailable: %s',
    async (result) => {
      mockAddOrder.mockResolvedValue(result);
      const service = new ServiceStaking({ backgroundApi: {} });
      const sync = jest
        .spyOn(service, 'updateEarnOrderStatusToServer')
        .mockResolvedValue(undefined);
      await expect(service.addEarnOrder(order)).resolves.toEqual({
        localStatus: result === undefined ? 'unavailable' : 'saved',
        remoteStatus: 'synced',
      });
      expect(sync).toHaveBeenCalledWith({ order });
    },
  );

  it('does not synchronize an order transaction already replaced locally', async () => {
    mockAddOrder.mockResolvedValue(false);
    const service = new ServiceStaking({ backgroundApi: {} });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    await expect(service.addEarnOrder(order)).resolves.toEqual({
      localStatus: 'superseded',
      remoteStatus: 'skipped',
    });
    expect(sync).not.toHaveBeenCalled();
  });

  it('does not send a late fact that conflicts with an existing order transaction', async () => {
    mockAddOrder.mockResolvedValue(false);
    const service = new ServiceStaking({ backgroundApi: {} });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    await expect(
      service.addEarnOrder(order, {
        remoteSync: 'once',
        preserveExistingTx: true,
      }),
    ).resolves.toEqual({ localStatus: 'existing', remoteStatus: 'skipped' });
    expect(mockAddOrder).toHaveBeenCalledWith(order, {
      preserveExistingTx: true,
    });
    expect(sync).not.toHaveBeenCalled();
  });

  it('does not synchronize after a persistence write fails', async () => {
    mockAddOrder.mockRejectedValue(new Error('storage failed'));
    const service = new ServiceStaking({ backgroundApi: {} });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    await expect(service.addEarnOrder(order)).rejects.toThrow('storage failed');
    expect(sync).not.toHaveBeenCalled();
  });

  it('reports server synchronization failure without changing legacy throwing behavior', async () => {
    mockAddOrder.mockResolvedValue(true);
    const service = new ServiceStaking({ backgroundApi: {} });
    jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockRejectedValue(new Error('server unavailable'));
    await expect(service.addEarnOrder(order)).resolves.toEqual({
      localStatus: 'saved',
      remoteStatus: 'failed',
    });
  });

  it.each(['failed', 'unavailable'] as const)(
    'reports local %s before making a task order request',
    async (status) => {
      if (status === 'failed')
        mockAddOrder.mockRejectedValue(new Error('storage failed'));
      else mockAddOrder.mockResolvedValue(undefined);
      const service = new ServiceStaking({ backgroundApi: {} });
      const sync = jest
        .spyOn(service, 'updateEarnOrderStatusToServer')
        .mockResolvedValue(undefined);
      await expect(
        service.addEarnOrder(order, { remoteSync: 'once' }),
      ).resolves.toEqual({
        localStatus: status,
        remoteStatus: 'notAttempted',
      });
      expect(sync).not.toHaveBeenCalled();
    },
  );

  it('makes only one server request when a task order request fails', async () => {
    mockAddOrder.mockResolvedValue(true);
    const client = axios.create();
    const post = jest
      .spyOn(client, 'post')
      .mockRejectedValue(new Error('response lost'));
    const service = new ServiceStaking({ backgroundApi: {} });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    await expect(
      service.addEarnOrder(order, { remoteSync: 'once' }),
    ).resolves.toEqual({
      localStatus: 'saved',
      remoteStatus: 'failed',
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid remote retry bound before making a request', async () => {
    const service = new ServiceStaking({ backgroundApi: {} });
    const client = jest.spyOn(service, 'getClient');
    await expect(
      service.updateEarnOrderStatusToServer({
        order: { ...order, previousTxIds: [], createdAt: 0, updatedAt: 0 },
        maxAttempts: 100,
      }),
    ).rejects.toThrow('Invalid Earn order retry policy');
    expect(client).not.toHaveBeenCalled();
  });
});
