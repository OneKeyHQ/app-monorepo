import axios from 'axios';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityEarnOrders } from '../dbs/simple/entity/SimpleDbEntityEarnOrders';

import ServiceStaking from './ServiceStaking';

const mockAddOrder = jest.fn<
  Promise<boolean | undefined>,
  [
    unknown,
    {
      preserveExistingTx: boolean;
      recordAttemptId?: string;
      retryLocalFailure?: boolean;
    }?,
  ]
>();
jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    earnOrders: {
      addOrder: (
        order: unknown,
        options?: {
          preserveExistingTx: boolean;
          recordAttemptId?: string;
          retryLocalFailure?: boolean;
        },
      ) => (options ? mockAddOrder(order, options) : mockAddOrder(order)),
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

  it('retries only the same attempt after a definite local failure', async () => {
    mockAddOrder
      .mockRejectedValueOnce(new Error('local storage failed'))
      .mockResolvedValueOnce(true);
    const service = new ServiceStaking({ backgroundApi: {} });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    const initial = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      recordAttemptId: 'attempt-1',
    };
    await expect(service.addEarnOrder(order, initial)).resolves.toEqual({
      localStatus: 'failed',
      remoteStatus: 'notAttempted',
    });
    expect(sync).not.toHaveBeenCalled();
    await expect(
      service.addEarnOrder(
        { ...order, txId: 'other-tx' },
        { ...initial, retryLocalFailure: true },
      ),
    ).resolves.toEqual({ localStatus: 'existing', remoteStatus: 'skipped' });
    await expect(
      service.addEarnOrder(order, { ...initial, retryLocalFailure: true }),
    ).resolves.toEqual({ localStatus: 'saved', remoteStatus: 'synced' });
    await expect(
      service.addEarnOrder(order, { ...initial, retryLocalFailure: true }),
    ).resolves.toEqual({ localStatus: 'existing', remoteStatus: 'skipped' });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('recovers a local write that succeeded before reporting an error', async () => {
    const entity = new SimpleDbEntityEarnOrders();
    Reflect.set(entity, 'appStorage', createMemoryStorage(null));
    const write = entity.setRawData.bind(entity);
    jest.spyOn(entity, 'setRawData').mockImplementationOnce(async (data) => {
      await write(data);
      throw new OneKeyLocalError('local write response lost');
    });
    mockAddOrder.mockImplementation((_order, options) =>
      entity.addOrder(order, options),
    );
    const service = new ServiceStaking({ backgroundApi: {} });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    const initial = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      recordAttemptId: 'attempt-1',
    };
    await expect(service.addEarnOrder(order, initial)).resolves.toEqual({
      localStatus: 'failed',
      remoteStatus: 'notAttempted',
    });
    expect(sync).not.toHaveBeenCalled();
    await expect(
      service.addEarnOrder(order, { ...initial, retryLocalFailure: true }),
    ).resolves.toEqual({ localStatus: 'saved', remoteStatus: 'synced' });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('does not send twice when the same recording attempt is concurrent', async () => {
    let release: (value: boolean) => void = () => undefined;
    const local = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    mockAddOrder.mockReturnValueOnce(local);
    const service = new ServiceStaking({ backgroundApi: {} });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    const initial = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      recordAttemptId: 'attempt-1',
    };
    const first = service.addEarnOrder(order, initial);
    await expect(service.addEarnOrder(order, initial)).resolves.toEqual({
      localStatus: 'existing',
      remoteStatus: 'skipped',
    });
    release(true);
    await expect(first).resolves.toEqual({
      localStatus: 'saved',
      remoteStatus: 'synced',
    });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('does not retry after an uncertain remote result or a service restart', async () => {
    mockAddOrder.mockResolvedValue(true);
    const service = new ServiceStaking({ backgroundApi: {} });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockRejectedValue(new Error('response lost'));
    const initial = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      recordAttemptId: 'attempt-1',
    };
    await expect(service.addEarnOrder(order, initial)).resolves.toEqual({
      localStatus: 'saved',
      remoteStatus: 'failed',
    });
    await expect(
      service.addEarnOrder(order, { ...initial, retryLocalFailure: true }),
    ).resolves.toEqual({ localStatus: 'existing', remoteStatus: 'skipped' });
    const restarted = new ServiceStaking({ backgroundApi: {} });
    await expect(
      restarted.addEarnOrder(order, { ...initial, retryLocalFailure: true }),
    ).resolves.toEqual({ localStatus: 'existing', remoteStatus: 'skipped' });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('keeps a server retryable response pending without posting twice', async () => {
    mockAddOrder.mockResolvedValue(true);
    const client = axios.create({
      adapter: async (config) => ({
        config,
        data: { data: { retryable: true } },
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
    });
    const post = jest.spyOn(client, 'post');
    const service = new ServiceStaking({ backgroundApi: {} });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    const initial = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      recordAttemptId: 'attempt-1',
    };
    await expect(service.addEarnOrder(order, initial)).resolves.toEqual({
      localStatus: 'saved',
      remoteStatus: 'pending',
    });
    await expect(
      service.addEarnOrder(order, { ...initial, retryLocalFailure: true }),
    ).resolves.toEqual({ localStatus: 'existing', remoteStatus: 'skipped' });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('reports a retryable server response for a late order without an attempt id', async () => {
    mockAddOrder.mockResolvedValue(true);
    const client = axios.create({
      adapter: async (config) => ({
        config,
        data: { data: { retryable: true } },
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
    });
    const service = new ServiceStaking({ backgroundApi: {} });
    jest.spyOn(service, 'getClient').mockResolvedValue(client);
    await expect(
      service.addEarnOrder(order, {
        remoteSync: 'once',
        preserveExistingTx: true,
      }),
    ).resolves.toEqual({ localStatus: 'saved', remoteStatus: 'pending' });
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
