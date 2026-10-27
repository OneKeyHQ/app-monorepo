import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyOrder,
} from '@onekeyhq/shared/types/fiatCrypto';

import { SimpleDbEntityHeadlessBuyOrders } from './SimpleDbEntityHeadlessBuyOrders';

function order(transactionId: string, createdAt: number): IHeadlessBuyOrder {
  return {
    transactionId,
    createdAt,
    networkId: 'evm--1',
    address: '0xabc',
    tokenSymbol: 'ETH',
    tokenAddress: '',
    fiatAmount: 100,
    fiatCurrency: 'usd',
    status: EHeadlessBuyOrderStatus.Processing,
  };
}

describe('SimpleDbEntityHeadlessBuyOrders', () => {
  test('getOrders returns newest first and tolerates empty storage', async () => {
    const entity = new SimpleDbEntityHeadlessBuyOrders();
    const getRawData = jest.spyOn(entity, 'getRawData');
    getRawData.mockResolvedValue(null);
    expect(await entity.getOrders()).toEqual([]);
    expect(await entity.getOrder({ transactionId: 'a' })).toBeUndefined();

    getRawData.mockResolvedValue({
      orders: { a: order('a', 1), b: order('b', 3), c: order('c', 2) },
    });
    expect((await entity.getOrders()).map((o) => o.transactionId)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect((await entity.getOrder({ transactionId: 'c' }))?.createdAt).toBe(2);
  });

  test('mergeOrders writes and deletes atomically through the builder', async () => {
    const entity = new SimpleDbEntityHeadlessBuyOrders();
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(undefined as never);

    await entity.mergeOrders({ updates: { a: order('a', 9), b: null } });

    expect(setRawData).toHaveBeenCalledTimes(1);
    const builder = setRawData.mock.calls[0][0] as (
      raw: { orders: Record<string, IHeadlessBuyOrder> } | null,
    ) => { orders: Record<string, IHeadlessBuyOrder> };
    expect(builder({ orders: { b: order('b', 1), c: order('c', 2) } })).toEqual(
      {
        orders: { a: order('a', 9), c: order('c', 2) },
      },
    );
    expect(builder(null)).toEqual({ orders: { a: order('a', 9) } });
  });

  test('insertOrderIfAbsent inserts once and patchOrder merges into existing records', async () => {
    const entity = new SimpleDbEntityHeadlessBuyOrders();
    let raw: { orders: Record<string, IHeadlessBuyOrder> } | null = null;
    jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
      raw = (
        builder as (current: typeof raw) => {
          orders: Record<string, IHeadlessBuyOrder>;
        }
      )(raw);
      return undefined as never;
    });

    expect(await entity.insertOrderIfAbsent({ order: order('a', 1) })).toBe(
      true,
    );
    expect(await entity.insertOrderIfAbsent({ order: order('a', 2) })).toBe(
      false,
    );
    expect(raw).toEqual({ orders: { a: order('a', 1) } });

    expect(
      await entity.patchOrder({
        transactionId: 'a',
        patch: { submittedAt: 5 },
      }),
    ).toEqual({ ...order('a', 1), submittedAt: 5 });
    expect(
      await entity.patchOrder({
        transactionId: 'zz',
        patch: { submittedAt: 5 },
      }),
    ).toBeUndefined();
    expect(raw).toEqual({
      orders: { a: { ...order('a', 1), submittedAt: 5 } },
    });
  });

  test('removeOrderIfHidden leaves submitted and payment-seen records alone', async () => {
    const entity = new SimpleDbEntityHeadlessBuyOrders();
    let raw: { orders: Record<string, IHeadlessBuyOrder> } | null = {
      orders: {
        hidden: order('hidden', 1),
        paid: { ...order('paid', 2), submittedAt: 3 },
        authorized: { ...order('authorized', 4), paymentSeen: true },
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
      raw = (
        builder as (current: typeof raw) => {
          orders: Record<string, IHeadlessBuyOrder>;
        }
      )(raw);
      return undefined as never;
    });

    expect(
      await entity.removeOrderIfHidden({ transactionId: 'hidden' }),
    ).toEqual(order('hidden', 1));
    expect(
      await entity.removeOrderIfHidden({ transactionId: 'paid' }),
    ).toBeUndefined();
    expect(
      await entity.removeOrderIfHidden({ transactionId: 'authorized' }),
    ).toBeUndefined();
    expect(
      await entity.removeOrderIfHidden({ transactionId: 'ghost' }),
    ).toBeUndefined();
    expect(Object.keys(raw?.orders ?? {}).toSorted()).toEqual([
      'authorized',
      'paid',
    ]);
  });

  test('applyTimeRules only writes when a rule fires and reports the changes', async () => {
    const entity = new SimpleDbEntityHeadlessBuyOrders();
    const dayMs = 24 * 60 * 60 * 1000;
    let raw: { orders: Record<string, IHeadlessBuyOrder> } | null = {
      orders: {
        fresh: { ...order('fresh', 100), submittedAt: 100 },
        staleHidden: order('staleHidden', 0),
        staleVisible: { ...order('staleVisible', 0), submittedAt: 1 },
      },
    };
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => raw);
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockImplementation(async (builder) => {
        raw = (
          builder as (current: typeof raw) => {
            orders: Record<string, IHeadlessBuyOrder>;
          }
        )(raw);
        return undefined as never;
      });

    const quiet = await entity.applyTimeRules({ now: 200 });
    expect(quiet.changes).toEqual([]);
    expect(quiet.orders).toHaveLength(3);
    expect(setRawData).not.toHaveBeenCalled();

    const { orders, changes } = await entity.applyTimeRules({
      now: dayMs + 1,
    });
    expect(setRawData).toHaveBeenCalledTimes(1);
    expect(orders.map((o) => o.transactionId).toSorted()).toEqual([
      'fresh',
      'staleVisible',
    ]);
    expect(changes).toEqual([
      { from: order('staleHidden', 0), to: undefined },
      {
        from: { ...order('staleVisible', 0), submittedAt: 1 },
        to: {
          ...order('staleVisible', 0),
          submittedAt: 1,
          status: EHeadlessBuyOrderStatus.Failed,
          timedOut: true,
        },
      },
    ]);
    expect(raw?.orders.staleHidden).toBeUndefined();
  });

  test('applyTransactionStatuses merges into the current record instead of a snapshot', async () => {
    const entity = new SimpleDbEntityHeadlessBuyOrders();
    // The `completed` event landed while the lookup was in flight: the
    // record is already submitted and payment-seen when the merge runs.
    let raw: { orders: Record<string, IHeadlessBuyOrder> } | null = {
      orders: {
        a: { ...order('a', 1), submittedAt: 7, paymentSeen: true },
        b: { ...order('b', 2), submittedAt: 7 },
      },
    };
    jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
      raw = (
        builder as (current: typeof raw) => {
          orders: Record<string, IHeadlessBuyOrder>;
        }
      )(raw);
      return undefined as never;
    });

    const { changes } = await entity.applyTransactionStatuses({
      statuses: {
        a: { transactionId: 'a', status: 'new' },
        b: null,
        ghost: { transactionId: 'ghost', status: 'completed' },
      },
      now: 9,
    });
    expect(raw?.orders.a).toMatchObject({
      submittedAt: 7,
      paymentSeen: true,
      rawStatus: 'new',
      lastCheckedAt: 9,
      lastCheckOk: true,
    });
    expect(raw?.orders.b).toMatchObject({
      submittedAt: 7,
      lastCheckedAt: 9,
      lastCheckOk: false,
    });
    expect(raw?.orders.ghost).toBeUndefined();
    expect(changes.map((c) => c.from.transactionId)).toEqual(['a', 'b']);
    expect(changes[0].to).toBe(raw?.orders.a);
  });
});
