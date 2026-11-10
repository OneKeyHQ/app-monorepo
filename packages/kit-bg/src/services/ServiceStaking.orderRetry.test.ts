import type { AxiosInstance } from 'axios';

import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors/errors/baseErrors';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityEarnOrders } from '../dbs/simple/entity/SimpleDbEntityEarnOrders';

import ServiceBootstrap from './ServiceBootstrap';
import ServiceStaking from './ServiceStaking';

import type { IAddEarnOrderParams } from '../dbs/simple/entity/SimpleDbEntityEarnOrders';

jest.mock('./ServiceUnifoldDeposit/resumeUnifoldDepositTracking', () => ({
  resumeUnifoldDepositTracking: jest.fn().mockResolvedValue(undefined),
}));

const order: IAddEarnOrderParams = {
  orderId: 'order-1',
  networkId: 'evm--1',
  txId: 'tx-1',
  status: EDecodedTxStatus.Pending,
};
const accepted = { data: {} };
const retryable = { data: { data: { retryable: true } } };

/** 用共享序列化存储创建真实服务和数据库实例，验证重启后仍可恢复队列。 */
function createRuntime(storage = new Map<string, string>()) {
  const earnOrders = new SimpleDbEntityEarnOrders();
  earnOrders.appStorage = {
    ...earnOrders.appStorage,
    getItem: jest.fn(async (key) => storage.get(key) ?? null),
    setItem: jest.fn(async (key, value) => {
      storage.set(
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      );
    }),
  };
  const service = new ServiceStaking({
    backgroundApi: { simpleDb: { earnOrders } },
  });
  const post = jest.fn().mockResolvedValue(accepted);
  jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({ post } as unknown as AxiosInstance);
  return { earnOrders, service, post, storage };
}

/** 暂缓请求响应，便于验证新状态保存后旧响应不会覆盖它。 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const terminalTx = (status: EDecodedTxStatus, txId = order.txId) => ({
  accountId: 'account-1',
  networkId: order.networkId,
  txId,
  status,
});

describe('durable Earn order server synchronization', () => {
  const previousBackground = globalThis.$onekeyIsInBackground;
  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackground;
  });
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([accepted, { data: undefined }])(
    'persists RPC visibility retries and accepts an empty success without inventing chain confirmation: %j',
    async (success) => {
      const { service, earnOrders, post } = createRuntime();
      post.mockResolvedValue(success).mockResolvedValueOnce(retryable);
      await service.addEarnOrder(order);
      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith('/earn/v1/orders', {
        orderId: order.orderId,
        networkId: order.networkId,
        txId: order.txId,
      });
      await expect(
        earnOrders.getOrderByTxId(order.txId),
      ).resolves.toMatchObject({
        status: EDecodedTxStatus.Pending,
        serverSyncStatus: 'pending',
      });
      await service.retryPendingEarnOrders();
      await expect(
        earnOrders.getOrderByTxId(order.txId),
      ).resolves.toMatchObject({
        status: EDecodedTxStatus.Pending,
        serverSyncStatus: 'acknowledged',
      });
      await service.retryPendingEarnOrders();
      expect(post).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    { name: 'offline', error: new Error('offline') },
    {
      name: 'server 503',
      error: new OneKeyServerApiError({
        code: 50_000,
        message: 'Service unavailable',
        httpStatusCode: 503,
      }),
    },
  ])(
    'retains transport/server failures for the next background pass: $name',
    async ({ error }) => {
      const { service, earnOrders, post, storage } = createRuntime();
      post.mockRejectedValueOnce(error);
      await expect(service.addEarnOrder(order)).resolves.toBeUndefined();
      expect(await earnOrders.getOrdersPendingSync()).toHaveLength(1);
      const restarted = createRuntime(storage);
      await restarted.service.retryPendingEarnOrders();
      expect(restarted.post).toHaveBeenCalledTimes(1);
      expect(await earnOrders.getOrdersPendingSync()).toHaveLength(0);
    },
  );

  it.each([EDecodedTxStatus.Confirmed, EDecodedTxStatus.Failed])(
    'recovers terminal %s work after history stops polling and a new runtime boots',
    async (status) => {
      const first = createRuntime();
      await first.service.addEarnOrder(order);
      first.post.mockResolvedValue(retryable);
      const tx = terminalTx(status);
      await expect(
        first.service.updateEarnOrder({ txs: [tx] }),
      ).resolves.toMatchObject([
        { tx, order: { status, serverSyncStatus: 'pending' } },
      ]);
      await first.service.updateEarnOrder({ txs: [] });
      expect(first.post).toHaveBeenCalledTimes(2);

      const restarted = createRuntime(first.storage);
      restarted.post.mockResolvedValueOnce(retryable);
      const start = jest.spyOn(restarted.service, 'startEarnOrderSync');
      jest
        .spyOn(systemTimeUtils, 'startServerTimeInterval')
        .mockImplementation(() => undefined);
      const bootstrap = new ServiceBootstrap({
        backgroundApi: {
          serviceAccount: { startBackupMigrationBootRawSample: jest.fn() },
          serviceStaking: restarted.service,
        },
      });
      await bootstrap.initDeferred();
      await jest.advanceTimersByTimeAsync(0);
      expect(start).toHaveBeenCalledTimes(1);
      expect(restarted.post).toHaveBeenCalledTimes(1);
      await restarted.service.startEarnOrderSync();
      await jest.advanceTimersByTimeAsync(30_000);
      expect(restarted.post).toHaveBeenCalledTimes(2);
      await expect(
        restarted.earnOrders.getOrderByTxId(order.txId),
      ).resolves.toMatchObject({
        status,
        serverSyncStatus: 'acknowledged',
      });
    },
  );

  it.each(['accepted', 'rejected'])(
    'ignores an old hash %s response after replacement',
    async (result) => {
      const { service, earnOrders, post } = createRuntime();
      const started = deferred<void>();
      const response = deferred<typeof accepted>();
      post
        .mockImplementationOnce(() => {
          started.resolve();
          return response.promise.then((value) => {
            if (result === 'rejected') {
              throw new OneKeyServerApiError({
                code: 70_004,
                message: 'Order transaction mismatch',
              });
            }
            return value;
          });
        })
        .mockResolvedValueOnce(retryable);
      const initial = service.addEarnOrder(order);
      await started.promise;
      await service.updateOrderStatusByTxId({
        currentTxId: order.txId,
        newTxId: 'tx-2',
        status: EDecodedTxStatus.Pending,
      });
      response.resolve(accepted);
      await initial;
      expect(await earnOrders.getOrderByTxId(order.txId)).toBeUndefined();
      await expect(earnOrders.getOrderByTxId('tx-2')).resolves.toMatchObject({
        previousTxIds: [order.txId],
        serverSyncStatus: 'pending',
      });
      await service.retryPendingEarnOrders();
      await expect(earnOrders.getOrderByTxId('tx-2')).resolves.toMatchObject({
        serverSyncStatus: 'acknowledged',
      });
    },
  );

  it('does not let a pending response acknowledge a newer terminal callback', async () => {
    const { service, earnOrders, post } = createRuntime();
    const started = deferred<void>();
    const response = deferred<typeof accepted>();
    post
      .mockImplementationOnce(() => {
        started.resolve();
        return response.promise;
      })
      .mockResolvedValueOnce(retryable);
    const initial = service.addEarnOrder(order);
    await started.promise;
    await service.updateEarnOrder({
      txs: [terminalTx(EDecodedTxStatus.Confirmed)],
    });
    response.resolve(accepted);
    await initial;
    await expect(earnOrders.getOrderByTxId(order.txId)).resolves.toMatchObject({
      status: EDecodedTxStatus.Confirmed,
      serverSyncStatus: 'pending',
    });
  });

  it.each([
    { code: 70_004, message: 'Order transaction mismatch' },
    { code: 70_004, message: 'Order network mismatch' },
    { code: 70_010, message: 'Order not found' },
  ])(
    'persists permanent rejection without changing the real chain status: $message',
    async (error) => {
      const { service, earnOrders, post, storage } = createRuntime();
      post.mockRejectedValue(new OneKeyServerApiError(error));
      await service.addEarnOrder(order);
      await expect(
        earnOrders.getOrderByTxId(order.txId),
      ).resolves.toMatchObject({
        status: EDecodedTxStatus.Pending,
        serverSyncStatus: 'rejected',
      });
      await service.updateEarnOrder({
        txs: [terminalTx(EDecodedTxStatus.Confirmed)],
      });
      await expect(
        earnOrders.getOrderByTxId(order.txId),
      ).resolves.toMatchObject({
        status: EDecodedTxStatus.Confirmed,
        serverSyncStatus: 'rejected',
      });
      expect(post).toHaveBeenCalledTimes(1);
      const restarted = createRuntime(storage);
      await restarted.service.retryPendingEarnOrders();
      expect(restarted.post).not.toHaveBeenCalled();
    },
  );

  it('does not submit cancel hashes, including a later speed-up of the cancellation', async () => {
    const { service, earnOrders, post } = createRuntime();
    await service.addEarnOrder(order);
    await service.updateOrderStatusByTxId({
      currentTxId: order.txId,
      newTxId: 'cancel-1',
      status: EDecodedTxStatus.Removed,
    });
    await service.updateOrderStatusByTxId({
      currentTxId: 'cancel-1',
      newTxId: 'cancel-2',
      status: EDecodedTxStatus.Pending,
    });
    await service.updateEarnOrder({
      txs: [terminalTx(EDecodedTxStatus.Confirmed, 'cancel-2')],
    });
    await service.retryPendingEarnOrders();
    expect(post).toHaveBeenCalledTimes(1);
    await expect(earnOrders.getOrderByTxId('cancel-2')).resolves.toMatchObject({
      status: EDecodedTxStatus.Removed,
      serverSyncStatus: 'rejected',
    });
  });

  it.each([EDecodedTxStatus.Confirmed, EDecodedTxStatus.Removed])(
    'recovers legacy %s records without sending cancellation hashes',
    async (status) => {
      const { service, earnOrders, post } = createRuntime();
      await earnOrders.setRawData({
        data: {
          [order.orderId]: {
            ...order,
            status,
            createdAt: 1,
            updatedAt: 1,
            previousTxIds: [],
          },
        },
        txIdToOrderIdMap: { [order.txId]: order.orderId },
      });
      await service.retryPendingEarnOrders();
      expect(post).toHaveBeenCalledTimes(
        status === EDecodedTxStatus.Removed ? 0 : 1,
      );
      expect(await earnOrders.getOrdersPendingSync()).toHaveLength(0);
    },
  );
});
