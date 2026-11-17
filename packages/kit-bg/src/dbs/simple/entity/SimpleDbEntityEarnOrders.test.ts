import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityEarnOrders } from './SimpleDbEntityEarnOrders';

function createEntity() {
  const storage = createMemoryStorage(null);
  const entity = new SimpleDbEntityEarnOrders();
  Reflect.set(entity, 'appStorage', storage);
  return entity;
}

describe('Earn order registration', () => {
  it('does not reset a confirmed order when the same transaction is registered again', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: 'tx-1',
      status: EDecodedTxStatus.Pending,
    };
    const registered = await entity.addOrder(order);
    expect(registered).toBe(true);
    await entity.updateOrderStatusByTxId({
      currentTxId: order.txId,
      status: EDecodedTxStatus.Confirmed,
    });
    const confirmed = await entity.getOrderByTxId(order.txId);
    expect(confirmed?.status).toBe(EDecodedTxStatus.Confirmed);

    await entity.addOrder(order);

    expect(await entity.getOrderByTxId(order.txId)).toEqual(confirmed);
  });

  it('preserves replacement history when the current transaction is registered again', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: 'tx-1',
      status: EDecodedTxStatus.Pending,
    };
    await entity.addOrder(order);
    await entity.updateOrderStatusByTxId({
      currentTxId: order.txId,
      newTxId: 'tx-2',
      status: EDecodedTxStatus.Pending,
    });
    const replacement = await entity.getOrderByTxId('tx-2');
    expect(replacement?.previousTxIds).toEqual(['tx-1']);

    await entity.addOrder({ ...order, txId: 'tx-2' });

    expect(await entity.getOrderByTxId('tx-2')).toEqual(replacement);
  });

  it('ignores a late registration for a transaction already replaced by a confirmed one', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: 'tx-1',
      status: EDecodedTxStatus.Pending,
    };
    await entity.addOrder(order);
    await entity.updateOrderStatusByTxId({
      currentTxId: 'tx-1',
      newTxId: 'tx-2',
      status: EDecodedTxStatus.Pending,
    });
    await entity.updateOrderStatusByTxId({
      currentTxId: 'tx-2',
      status: EDecodedTxStatus.Confirmed,
    });
    const confirmed = await entity.getOrderByTxId('tx-2');
    const staleRegistration = await entity.addOrder(order);
    expect(staleRegistration).toBe(false);
    expect(await entity.getOrderByTxId('tx-2')).toEqual(confirmed);
    expect(await entity.getOrderByTxId('tx-1')).toBeUndefined();
  });

  it('does not replace a different current transaction with an unobserved late fact', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-late',
      networkId: 'evm--1',
      txId: 'tx-new',
      status: EDecodedTxStatus.Pending,
    };
    await entity.addOrder(order);
    await expect(
      entity.addOrder(
        { ...order, txId: 'tx-old' },
        { preserveExistingTx: true },
      ),
    ).resolves.toBe(false);
    expect((await entity.getOrderByTxId('tx-new'))?.txId).toBe('tx-new');
    expect(await entity.getOrderByTxId('tx-old')).toBeUndefined();
  });

  it('keeps a confirmed same-transaction order when receiving a late fact', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-late',
      networkId: 'evm--1',
      txId: 'tx-same',
      status: EDecodedTxStatus.Pending,
    };
    await entity.addOrder(order);
    await entity.updateOrderStatusByTxId({
      currentTxId: order.txId,
      status: EDecodedTxStatus.Confirmed,
    });
    await expect(
      entity.addOrder(order, { preserveExistingTx: true }),
    ).resolves.toBe(false);
    expect((await entity.getOrderByTxId(order.txId))?.status).toBe(
      EDecodedTxStatus.Confirmed,
    );
  });

  it('keeps a normal registration when it races a late conflicting fact', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-race',
      networkId: 'evm--1',
      txId: 'tx-normal',
      status: EDecodedTxStatus.Pending,
    };
    await Promise.all([
      entity.addOrder(order),
      entity.addOrder(
        { ...order, txId: 'tx-late' },
        { preserveExistingTx: true },
      ),
    ]);
    expect((await entity.getOrderByTxId('tx-normal'))?.txId).toBe('tx-normal');
  });

  it('lets a normal registration supersede a late fact recorded first', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-race',
      networkId: 'evm--1',
      txId: 'tx-late',
      status: EDecodedTxStatus.Pending,
    };
    await expect(
      entity.addOrder(order, { preserveExistingTx: true }),
    ).resolves.toBe(true);
    await entity.addOrder({ ...order, txId: 'tx-normal' });
    expect((await entity.getOrderByTxId('tx-normal'))?.txId).toBe('tx-normal');
    expect(await entity.getOrderByTxId('tx-late')).toBeUndefined();
  });

  it('does not classify an unavailable persistence result as a stale order', async () => {
    const entity = createEntity();
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);
    await expect(
      entity.addOrder({
        orderId: 'order-1',
        networkId: 'evm--1',
        txId: 'tx-1',
        status: EDecodedTxStatus.Pending,
      }),
    ).resolves.toBeUndefined();
  });

  it('keeps the confirmed status when registration and history update overlap', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: 'tx-1',
      status: EDecodedTxStatus.Pending,
    };
    await entity.addOrder(order);

    await Promise.all([
      entity.updateOrderStatusByTxId({
        currentTxId: order.txId,
        status: EDecodedTxStatus.Confirmed,
      }),
      entity.addOrder(order),
    ]);

    expect((await entity.getOrderByTxId(order.txId))?.status).toBe(
      EDecodedTxStatus.Confirmed,
    );
  });

  it('restores a missing transaction index without resetting an existing order', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: 'tx-1',
      status: EDecodedTxStatus.Pending,
    };
    await entity.addOrder(order);
    await entity.updateOrderStatusByTxId({
      currentTxId: order.txId,
      status: EDecodedTxStatus.Confirmed,
    });
    const confirmed = await entity.getOrderByTxId(order.txId);
    await entity.setRawData((raw) => ({
      data: { ...raw?.data },
      txIdToOrderIdMap: {},
    }));

    await entity.addOrder(order);

    expect(await entity.getOrderByTxId(order.txId)).toEqual(confirmed);
  });

  it('keeps existing tracking metadata while adding missing tags on a duplicate', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: 'tx-1',
      status: EDecodedTxStatus.Pending,
      stakingTags: ['existing-tag'],
    };
    await entity.addOrder(order);
    await entity.updateOrderStatusByTxId({
      currentTxId: order.txId,
      status: EDecodedTxStatus.Confirmed,
    });
    const confirmed = await entity.getOrderByTxId(order.txId);

    await entity.addOrder({
      ...order,
      stakingLabel: EEarnLabels.Withdraw,
      stakingProtocol: 'etherfi',
      stakingTags: ['existing-tag', 'new-tag'],
    });

    expect(await entity.getOrderByTxId(order.txId)).toEqual({
      ...confirmed,
      stakingLabel: EEarnLabels.Withdraw,
      stakingProtocol: 'etherfi',
      stakingTags: ['existing-tag', 'new-tag'],
    });
  });

  it('keeps the existing behavior for a different transaction', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: 'tx-1',
      status: EDecodedTxStatus.Pending,
    };
    await entity.addOrder(order);

    await entity.addOrder({ ...order, txId: 'tx-2' });

    expect(await entity.getOrderByTxId('tx-2')).toMatchObject({
      orderId: order.orderId,
      txId: 'tx-2',
      status: EDecodedTxStatus.Pending,
    });
  });

  it('does not apply an old indexed transaction status to a newer transaction', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: 'tx-1',
      status: EDecodedTxStatus.Pending,
    };
    await entity.addOrder(order);
    await entity.addOrder({ ...order, txId: 'tx-2' });
    // Existing installations may already contain the obsolete index entry.
    await entity.setRawData((raw) => ({
      data: { ...raw?.data },
      txIdToOrderIdMap: { ...raw?.txIdToOrderIdMap, 'tx-1': order.orderId },
    }));
    expect(await entity.getOrderByTxId('tx-1')).toBeUndefined();
    const outcome = await entity.updateOrderStatusByTxId({
      currentTxId: 'tx-1',
      status: EDecodedTxStatus.Confirmed,
    });
    expect(outcome.success).toBe(false);
    expect(await entity.getOrderByTxId('tx-2')).toMatchObject({
      txId: 'tx-2',
      status: EDecodedTxStatus.Pending,
    });
  });

  it('does not replace a newer registration with a late older transaction', async () => {
    const entity = createEntity();
    const order = {
      orderId: 'order-1',
      networkId: 'evm--1',
      txId: 'tx-1',
      status: EDecodedTxStatus.Pending,
    };
    await entity.addOrder(order);
    await entity.addOrder({ ...order, txId: 'tx-2' });
    await expect(entity.addOrder(order)).resolves.toBe(false);
    expect(await entity.getOrderByTxId('tx-2')).toMatchObject({
      txId: 'tx-2',
      previousTxIds: ['tx-1'],
    });
    expect(await entity.getOrderByTxId('tx-1')).toBeUndefined();
  });
});
