import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityEarnOrders } from './SimpleDbEntityEarnOrders';

function createEntity() {
  const entity = new SimpleDbEntityEarnOrders();
  Reflect.set(entity, 'appStorage', createMemoryStorage(null));
  return entity;
}

const order = {
  orderId: 'order-1',
  networkId: 'evm--1',
  txId: 'tx-1',
  status: EDecodedTxStatus.Pending,
};

describe('late EtherFi order registration', () => {
  it('does not replace a confirmed order or its transaction when an older result arrives', async () => {
    const entity = createEntity();
    await entity.addOrder(order);
    await entity.updateOrderStatusByTxId({
      currentTxId: order.txId,
      status: EDecodedTxStatus.Confirmed,
    });
    await expect(
      entity.addOrderIfAbsent({ ...order, txId: 'tx-old' }, 'account-1'),
    ).resolves.toBe('conflict');
    expect(await entity.getOrderByTxId(order.txId)).toMatchObject({
      status: EDecodedTxStatus.Confirmed,
    });
    expect(await entity.getOrderByTxId('tx-old')).toBeUndefined();
  });

  it('registers at most one of two concurrent late callbacks', async () => {
    const entity = createEntity();
    const outcomes = await Promise.all([
      entity.addOrderIfAbsent(order, 'account-1'),
      entity.addOrderIfAbsent(order, 'account-1'),
    ]);
    expect(outcomes.toSorted()).toEqual(['existing', 'inserted']);
    expect(await entity.getOrderByTxId(order.txId)).toMatchObject(order);
  });

  it('does not assign a transaction already mapped to a different order', async () => {
    const entity = createEntity();
    await entity.addOrder(order);
    await expect(
      entity.addOrderIfAbsent(
        { ...order, orderId: 'different-order' },
        'account-1',
      ),
    ).resolves.toBe('conflict');
    expect(await entity.getOrderByTxId(order.txId)).toMatchObject(order);
  });

  it('reports a blocked persistence write instead of claiming registration', async () => {
    const entity = createEntity();
    jest.spyOn(entity, 'setRawData').mockResolvedValueOnce(undefined);
    await expect(entity.addOrderIfAbsent(order, 'account-1')).resolves.toBe(
      'unavailable',
    );
  });

  it('preserves the synchronization state across entity recreation', async () => {
    const storage = createMemoryStorage(null);
    const first = new SimpleDbEntityEarnOrders();
    Reflect.set(first, 'appStorage', storage);
    await expect(first.addOrderIfAbsent(order, 'account-1')).resolves.toBe(
      'inserted',
    );
    const second = new SimpleDbEntityEarnOrders();
    Reflect.set(second, 'appStorage', storage);
    expect(await second.getOrderByTxId(order.txId)).toMatchObject({
      etherFiSyncStatus: 'notSent',
    });
    await expect(
      second.updateEtherFiSyncStatus({
        orderId: order.orderId,
        networkId: order.networkId,
        txId: order.txId,
        status: 'unknown',
      }),
    ).resolves.toBe(true);
    expect(await first.getOrderByTxId(order.txId)).toMatchObject({
      etherFiSyncStatus: 'unknown',
    });
  });

  it('lists only known-unsent orders for the requested account and network', async () => {
    const entity = createEntity();
    await entity.addOrderIfAbsent(order, 'account-1');
    await entity.addOrderIfAbsent(
      { ...order, orderId: 'order-2', txId: 'tx-2' },
      'account-2',
    );
    await entity.addOrderIfAbsent(
      { ...order, orderId: 'order-3', txId: 'tx-3' },
      'account-1',
    );
    await entity.updateEtherFiSyncStatus({
      orderId: 'order-3',
      networkId: order.networkId,
      txId: 'tx-3',
      status: 'unknown',
    });
    const result = await entity.getUnsentEtherFiOrders({
      accountId: 'account-1',
      networkId: order.networkId,
    });
    expect(result.map((item) => item.orderId)).toEqual(['order-1']);
    expect(
      await entity.getUnsentEtherFiOrders({
        accountId: 'account-1',
        networkId: 'evm--other',
      }),
    ).toEqual([]);
  });

  it('does not carry the old transaction sync result to a replacement', async () => {
    const entity = createEntity();
    await entity.addOrderIfAbsent(order, 'account-1');
    await entity.updateEtherFiSyncStatus({
      orderId: order.orderId,
      networkId: order.networkId,
      txId: order.txId,
      status: 'synced',
    });
    await entity.updateOrderStatusByTxId({
      currentTxId: order.txId,
      newTxId: 'tx-replacement',
      status: EDecodedTxStatus.Pending,
    });
    expect(await entity.getOrderByTxId('tx-replacement')).toMatchObject({
      etherFiSyncStatus: 'unknown',
      previousTxIds: [order.txId],
    });
  });

  it('claims a known unsent retry once and never downgrades a synced result', async () => {
    const entity = createEntity();
    await entity.addOrderIfAbsent(order, 'account-1');
    const identity = {
      orderId: order.orderId,
      networkId: order.networkId,
      txId: order.txId,
    };
    const claims = await Promise.all([
      entity.claimEtherFiOrderRetry(identity),
      entity.claimEtherFiOrderRetry(identity),
    ]);
    expect(claims.toSorted()).toEqual([false, true]);
    await entity.updateEtherFiSyncStatus({ ...identity, status: 'synced' });
    await expect(
      entity.updateEtherFiSyncStatus({ ...identity, status: 'unknown' }),
    ).resolves.toBe(false);
    expect(await entity.getOrderByTxId(order.txId)).toMatchObject({
      etherFiSyncStatus: 'synced',
    });
  });
});
