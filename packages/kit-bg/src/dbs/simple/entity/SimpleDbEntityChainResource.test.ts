/*
yarn jest packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityChainResource.test.ts
*/
import {
  SimpleDbEntityChainResource,
  TRON_RENTAL_ORDERS_MAX_COUNT,
} from './SimpleDbEntityChainResource';

import type { IChainResourceDBStruct } from './SimpleDbEntityChainResource';

// The entity over a plain object, standing in for the persisted raw data.
function buildEntity(initial: IChainResourceDBStruct | undefined = undefined) {
  let rawData = initial;
  const entity = new SimpleDbEntityChainResource();
  jest.spyOn(entity, 'getRawData').mockImplementation(async () => rawData);
  const setRawData = jest
    .spyOn(entity, 'setRawData')
    .mockImplementation(async (updater) => {
      rawData =
        typeof updater === 'function'
          ? (
              updater as (
                data: IChainResourceDBStruct | undefined,
              ) => IChainResourceDBStruct
            )(rawData)
          : updater;
      return rawData;
    });
  return { entity, setRawData, read: () => rawData };
}

describe('SimpleDbEntityChainResource TRON rental orders', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('knows an order only for the tx it was placed for', async () => {
    const { entity } = buildEntity();

    await entity.addTronRentalOrders({ uuids: ['u1', 'u2'] });

    await expect(entity.hasTronRentalOrder({ uuid: 'u1' })).resolves.toBe(true);
    await expect(entity.hasTronRentalOrder({ uuid: 'u2' })).resolves.toBe(true);
    await expect(entity.hasTronRentalOrder({ uuid: 'u3' })).resolves.toBe(
      false,
    );
  });

  it('writes nothing for an empty list', async () => {
    const { entity, setRawData } = buildEntity();

    await entity.addTronRentalOrders({ uuids: [] });

    expect(setRawData).not.toHaveBeenCalled();
  });

  it('keeps the newest orders once the store is full', async () => {
    const tronRentalOrders: NonNullable<
      IChainResourceDBStruct['tronRentalOrders']
    > = {};
    for (let i = 0; i < TRON_RENTAL_ORDERS_MAX_COUNT; i += 1) {
      tronRentalOrders[`old-${i}`] = { orderedAt: i + 1 };
    }
    const { entity, read } = buildEntity({ tronRentalOrders });

    await entity.addTronRentalOrders({ uuids: ['new'] });

    expect(Object.keys(read()?.tronRentalOrders ?? {})).toHaveLength(
      TRON_RENTAL_ORDERS_MAX_COUNT,
    );
    await expect(entity.hasTronRentalOrder({ uuid: 'new' })).resolves.toBe(
      true,
    );
    // the oldest one made room
    await expect(entity.hasTronRentalOrder({ uuid: 'old-0' })).resolves.toBe(
      false,
    );
    await expect(entity.hasTronRentalOrder({ uuid: 'old-1' })).resolves.toBe(
      true,
    );
  });

  it('leaves the other fields of the store alone, both ways', async () => {
    const { entity, read } = buildEntity({
      tronClaimResourceInfo: { TSender: { lastClaimTime: 1 } },
    });

    await entity.addTronRentalOrders({ uuids: ['u1'] });
    await entity.updateTronClaimResourceInfo({
      accountAddress: 'TOther',
      lastClaimTime: 2,
    });

    expect(read()?.tronClaimResourceInfo).toEqual({
      TSender: { lastClaimTime: 1 },
      TOther: { lastClaimTime: 2 },
    });
    await expect(entity.hasTronRentalOrder({ uuid: 'u1' })).resolves.toBe(true);
  });
});
