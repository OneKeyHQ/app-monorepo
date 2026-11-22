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

  it('lets history recover a persisted order once after a lost local write response', async () => {
    const entity = new SimpleDbEntityEarnOrders();
    Reflect.set(entity, 'appStorage', createMemoryStorage(null));
    const write = entity.setRawData.bind(entity);
    jest.spyOn(entity, 'setRawData').mockImplementationOnce(async (data) => {
      await write(data);
      throw new OneKeyLocalError('local write response lost');
    });
    mockAddOrder.mockImplementation((value, options) =>
      entity.addOrder(value as typeof order, options),
    );
    const service = new ServiceStaking({
      backgroundApi: { simpleDb: { earnOrders: entity } },
    });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'getEarnOrderDetail').mockResolvedValue({
      orderId: order.orderId,
      networkId: order.networkId,
      txId: order.txId,
      status: 'success',
      action: 'unstake',
      provider: 'pendle',
    });
    const initial = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      recordAttemptId: 'attempt-1',
      guardHistory: 'ethena-unstake' as const,
    };
    expect(await service.addEarnOrder(order, initial)).toEqual({
      localStatus: 'failed',
      remoteStatus: 'notAttempted',
    });
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(
      await service.addEarnOrder(
        { ...order, status: EDecodedTxStatus.Confirmed },
        { ...initial, retryLocalFailure: true },
      ),
    ).toEqual({ localStatus: 'existing', remoteStatus: 'skipped' });
    expect(sync).toHaveBeenCalledTimes(1);
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(
      await service.updateOrderStatusByTxId({
        currentTxId: order.txId,
        expectedOrderId: order.orderId,
        expectedNetworkId: order.networkId,
        expectedRecordAttemptId: initial.recordAttemptId,
        status: EDecodedTxStatus.Confirmed,
      }),
    ).toBe(true);
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('does not send twice when history recovery and the original UI retry overlap', async () => {
    const entity = new SimpleDbEntityEarnOrders();
    Reflect.set(entity, 'appStorage', createMemoryStorage(null));
    const write = entity.setRawData.bind(entity);
    jest.spyOn(entity, 'setRawData').mockImplementationOnce(async (data) => {
      await write(data);
      throw new OneKeyLocalError('local write response lost');
    });
    mockAddOrder.mockImplementation((value, options) =>
      entity.addOrder(value as typeof order, options),
    );
    const service = new ServiceStaking({
      backgroundApi: { simpleDb: { earnOrders: entity } },
    });
    let release: (() => void) | undefined;
    let notifySync: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => {
      notifySync = resolve;
    });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockImplementation(
        async () =>
          new Promise<undefined>((resolve) => {
            release = () => resolve(undefined);
            notifySync?.();
          }),
      );
    jest.spyOn(service, 'getEarnOrderDetail').mockResolvedValue({
      orderId: order.orderId,
      networkId: order.networkId,
      txId: order.txId,
      status: 'success',
      action: 'unstake',
      provider: 'pendle',
    });
    const options = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      recordAttemptId: 'attempt-1',
      guardHistory: 'ethena-unstake' as const,
    };
    await service.addEarnOrder(order, options);
    const polling = service.updateEarnOrder({
      txs: [
        {
          accountId: 'account',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    await entered;
    expect(sync).toHaveBeenCalledTimes(1);
    expect(
      await service.addEarnOrder(
        { ...order, status: EDecodedTxStatus.Confirmed },
        { ...options, retryLocalFailure: true },
      ),
    ).toEqual({ localStatus: 'existing', remoteStatus: 'skipped' });
    release?.();
    await polling;
    expect(sync).toHaveBeenCalledTimes(1);
    expect((await entity.getOrderByTxId(order.txId))?.status).toBe(
      EDecodedTxStatus.Confirmed,
    );
  });

  it('recovers an Ethena order that was not saved when history confirms its original transaction', async () => {
    const entity = new SimpleDbEntityEarnOrders();
    Reflect.set(entity, 'appStorage', createMemoryStorage(null));
    mockAddOrder
      .mockRejectedValueOnce(new OneKeyLocalError('storage write failed'))
      .mockImplementation((value, options) =>
        entity.addOrder(value as typeof order, options),
      );
    const service = new ServiceStaking({
      backgroundApi: { simpleDb: { earnOrders: entity } },
    });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    const detail = jest
      .spyOn(service, 'getEarnOrderDetail')
      .mockResolvedValueOnce({
        orderId: order.orderId,
        networkId: order.networkId,
        status: 'created',
        action: 'unstake',
        provider: 'pendle',
      })
      .mockResolvedValueOnce({
        orderId: order.orderId,
        networkId: order.networkId,
        txId: order.txId,
        status: 'success',
        action: 'unstake',
        provider: 'pendle',
      });
    const options = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      recordAttemptId: 'attempt-1',
      guardHistory: 'ethena-unstake' as const,
    };
    expect(await service.addEarnOrder(order, options)).toEqual({
      localStatus: 'failed',
      remoteStatus: 'notAttempted',
    });
    expect(await entity.getOrderByTxId(order.txId)).toBeUndefined();
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(detail).toHaveBeenCalledTimes(2);
    expect(sync).toHaveBeenCalledTimes(1);
    expect((await entity.getOrderByTxId(order.txId))?.status).toBe(
      EDecodedTxStatus.Confirmed,
    );
  });

  it('does not reconstruct a missing Ethena order for a different server transaction', async () => {
    const entity = new SimpleDbEntityEarnOrders();
    Reflect.set(entity, 'appStorage', createMemoryStorage(null));
    mockAddOrder.mockRejectedValueOnce(
      new OneKeyLocalError('storage write failed'),
    );
    const service = new ServiceStaking({
      backgroundApi: { simpleDb: { earnOrders: entity } },
    });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'getEarnOrderDetail').mockResolvedValue({
      orderId: order.orderId,
      networkId: order.networkId,
      txId: 'different',
      status: 'pending',
      action: 'unstake',
      provider: 'pendle',
    });
    await service.addEarnOrder(order, {
      remoteSync: 'once',
      preserveExistingTx: true,
      recordAttemptId: 'attempt-1',
      guardHistory: 'ethena-unstake',
    });
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(sync).not.toHaveBeenCalled();
    expect(await entity.getOrderByTxId(order.txId)).toBeUndefined();
  });

  it('does not choose between multiple missing Ethena attempts for the same transaction', async () => {
    const entity = new SimpleDbEntityEarnOrders();
    Reflect.set(entity, 'appStorage', createMemoryStorage(null));
    mockAddOrder.mockRejectedValue(
      new OneKeyLocalError('storage write failed'),
    );
    const service = new ServiceStaking({
      backgroundApi: { simpleDb: { earnOrders: entity } },
    });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    const detail = jest.spyOn(service, 'getEarnOrderDetail');
    const options = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      guardHistory: 'ethena-unstake' as const,
    };
    await service.addEarnOrder(order, {
      ...options,
      recordAttemptId: 'attempt-1',
    });
    await service.addEarnOrder(
      { ...order, orderId: 'another-order' },
      { ...options, recordAttemptId: 'attempt-2' },
    );
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(detail).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    expect(await entity.getOrderByTxId(order.txId)).toBeUndefined();
  });

  it('restores a missing local order without reposting an already bound server transaction', async () => {
    const entity = new SimpleDbEntityEarnOrders();
    Reflect.set(entity, 'appStorage', createMemoryStorage(null));
    mockAddOrder
      .mockRejectedValueOnce(new OneKeyLocalError('storage write failed'))
      .mockImplementation((value, options) =>
        entity.addOrder(value as typeof order, options),
      );
    const service = new ServiceStaking({
      backgroundApi: { simpleDb: { earnOrders: entity } },
    });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'getEarnOrderDetail').mockResolvedValue({
      orderId: order.orderId,
      networkId: order.networkId,
      txId: order.txId,
      status: 'success',
      action: 'unstake',
      provider: 'pendle',
    });
    await service.addEarnOrder(order, {
      remoteSync: 'once',
      preserveExistingTx: true,
      recordAttemptId: 'attempt-1',
      guardHistory: 'ethena-unstake',
    });
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(sync).not.toHaveBeenCalled();
    expect((await entity.getOrderByTxId(order.txId))?.status).toBe(
      EDecodedTxStatus.Confirmed,
    );
  });

  it('retries a local-only repair after another storage failure without reposting a bound order', async () => {
    const entity = new SimpleDbEntityEarnOrders();
    Reflect.set(entity, 'appStorage', createMemoryStorage(null));
    mockAddOrder
      .mockRejectedValueOnce(new OneKeyLocalError('initial write failed'))
      .mockRejectedValueOnce(new OneKeyLocalError('repair write failed'))
      .mockImplementation((value, options) =>
        entity.addOrder(value as typeof order, options),
      );
    const service = new ServiceStaking({
      backgroundApi: { simpleDb: { earnOrders: entity } },
    });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'getEarnOrderDetail').mockResolvedValue({
      orderId: order.orderId,
      networkId: order.networkId,
      txId: order.txId,
      status: 'success',
      action: 'unstake',
      provider: 'pendle',
    });
    await service.addEarnOrder(order, {
      remoteSync: 'once',
      preserveExistingTx: true,
      recordAttemptId: 'attempt-1',
      guardHistory: 'ethena-unstake',
    });
    const tx = {
      accountId: 'account',
      networkId: order.networkId,
      txId: order.txId,
      status: EDecodedTxStatus.Confirmed,
    };
    await service.updateEarnOrder({ txs: [tx] });
    expect(await entity.getOrderByTxId(order.txId)).toBeUndefined();
    await service.updateEarnOrder({ txs: [tx] });
    expect((await entity.getOrderByTxId(order.txId))?.status).toBe(
      EDecodedTxStatus.Confirmed,
    );
    expect(sync).not.toHaveBeenCalled();
  });

  it('does not let history repost an attempt with an uncertain remote result', async () => {
    const entity = new SimpleDbEntityEarnOrders();
    Reflect.set(entity, 'appStorage', createMemoryStorage(null));
    mockAddOrder.mockImplementation((value, options) =>
      entity.addOrder(value as typeof order, options),
    );
    const service = new ServiceStaking({
      backgroundApi: { simpleDb: { earnOrders: entity } },
    });
    const sync = jest
      .spyOn(service, 'updateEarnOrderStatusToServer')
      .mockResolvedValue({ retryable: true });
    jest
      .spyOn(service, 'getEarnOrderDetail')
      .mockRejectedValue(new Error('unavailable'));
    const initial = {
      remoteSync: 'once' as const,
      preserveExistingTx: true as const,
      recordAttemptId: 'attempt-1',
      guardHistory: 'ethena-unstake' as const,
    };
    expect(await service.addEarnOrder(order, initial)).toEqual({
      localStatus: 'saved',
      remoteStatus: 'pending',
    });
    await service.updateEarnOrder({
      txs: [
        {
          accountId: 'account',
          networkId: order.networkId,
          txId: order.txId,
          status: EDecodedTxStatus.Confirmed,
        },
      ],
    });
    expect(sync).toHaveBeenCalledTimes(1);
    expect((await entity.getOrderByTxId(order.txId))?.status).toBe(
      EDecodedTxStatus.Pending,
    );
  });

  it.each(['matching', 'different'])(
    'reconciles an uncertain Ethena order only with %s server identity',
    async (variant) => {
      const entity = new SimpleDbEntityEarnOrders();
      Reflect.set(entity, 'appStorage', createMemoryStorage(null));
      mockAddOrder.mockImplementation((value, options) =>
        entity.addOrder(value as typeof order, options),
      );
      const service = new ServiceStaking({
        backgroundApi: { simpleDb: { earnOrders: entity } },
      });
      const sync = jest
        .spyOn(service, 'updateEarnOrderStatusToServer')
        .mockResolvedValue({ retryable: true });
      jest.spyOn(service, 'getEarnOrderDetail').mockResolvedValue({
        orderId: order.orderId,
        networkId: order.networkId,
        txId: variant === 'matching' ? order.txId : 'different-tx',
        status: 'success',
        action: 'unstake',
        provider: 'pendle',
      });
      await service.addEarnOrder(order, {
        remoteSync: 'once',
        preserveExistingTx: true,
        recordAttemptId: 'attempt-1',
        guardHistory: 'ethena-unstake',
      });
      await service.updateEarnOrder({
        txs: [
          {
            accountId: 'account',
            networkId: order.networkId,
            txId: order.txId,
            status: EDecodedTxStatus.Confirmed,
          },
        ],
      });
      expect(sync).toHaveBeenCalledTimes(1);
      expect((await entity.getOrderByTxId(order.txId))?.status).toBe(
        variant === 'matching'
          ? EDecodedTxStatus.Confirmed
          : EDecodedTxStatus.Pending,
      );
    },
  );

  it.each([false, true])(
    'keeps history updates for unguarded or synchronized pending orders (guard=%s)',
    async (guard) => {
      const entity = new SimpleDbEntityEarnOrders();
      Reflect.set(entity, 'appStorage', createMemoryStorage(null));
      mockAddOrder.mockImplementation((value, options) =>
        entity.addOrder(value as typeof order, options),
      );
      const service = new ServiceStaking({
        backgroundApi: { simpleDb: { earnOrders: entity } },
      });
      const sync = jest
        .spyOn(service, 'updateEarnOrderStatusToServer')
        .mockResolvedValue(guard ? undefined : { retryable: true });
      await service.addEarnOrder(order, {
        remoteSync: 'once',
        preserveExistingTx: true,
        recordAttemptId: 'attempt-1',
        ...(guard ? { guardHistory: 'ethena-unstake' as const } : {}),
      });
      await service.updateEarnOrder({
        txs: [
          {
            accountId: 'account',
            networkId: order.networkId,
            txId: order.txId,
            status: EDecodedTxStatus.Confirmed,
          },
        ],
      });
      expect(sync).toHaveBeenCalledTimes(2);
    },
  );

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
