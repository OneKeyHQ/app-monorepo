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
});
