import { SimpleDbEntityAccountValue } from './SimpleDbEntityAccountValue';
import { SimpleDbEntityLocalTokens } from './SimpleDbEntityLocalTokens';

import type { IAccountValueDb } from './SimpleDbEntityAccountValue';
import type { ISimpleDBLocalTokens } from './SimpleDbEntityLocalTokens';

/*
yarn jest packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityAssetSnapshot.test.ts
*/

const meta = (localSeq: number, serverDateMs?: number) => ({
  localSeq,
  ...(serverDateMs === undefined ? {} : { serverDateMs }),
});

const token = (key: string) => ({
  $key: key,
  name: key,
  symbol: key,
  address: key,
  decimals: 18,
  isNative: false,
});

const fiat = (value: string) => ({
  balance: value,
  balanceParsed: value,
  fiatValue: value,
  price: 1,
});

function mockEntityStorage<T extends object>(entity: object, initial: T) {
  type ITestEntity = {
    getRawData: () => Promise<T | null | undefined>;
    setRawData: (
      builder: (rawData: T | null | undefined) => T | Promise<T>,
    ) => Promise<T>;
  };
  const target = entity as ITestEntity;
  let state: T | null | undefined = initial;
  jest.spyOn(target, 'getRawData').mockImplementation(async () => state);
  jest.spyOn(target, 'setRawData').mockImplementation(async (builder) => {
    state = await builder(state);
    return state;
  });
  return () => state as T;
}

describe('SimpleDbEntityLocalTokens snapshot admission', () => {
  it('keeps all token slices from the newest response atomically', async () => {
    const entity = new SimpleDbEntityLocalTokens();
    const read = mockEntityStorage<ISimpleDBLocalTokens>(entity, {
      data: {},
      tokenList: {},
      smallBalanceTokenList: {},
      riskyTokenList: {},
      tokenListMap: {},
      tokenListValue: {},
      tokenListCurrency: {},
    });
    const write = async (value: string, localSeq: number) =>
      entity.updateAccountTokenList({
        networkId: 'evm--1',
        accountAddress: '0xalice',
        tokenList: [token(value)],
        smallBalanceTokenList: [token(`${value}-small`)],
        riskyTokenList: [token(`${value}-risk`)],
        tokenListMap: { [value]: fiat(value) },
        tokenListValue: value,
        currency: 'usd',
        assetSnapshotMeta: meta(localSeq),
      });

    await write('new', 2);
    await write('old', 1);

    const result = read();
    const key = 'evm--1_0xalice';
    expect(result.tokenList[key]?.[0]?.$key).toBe('new');
    expect(result.smallBalanceTokenList[key]?.[0]?.$key).toBe('new-small');
    expect(result.riskyTokenList[key]?.[0]?.$key).toBe('new-risk');
    expect(result.tokenListValue[key]).toBe('new');
    expect(result.assetSnapshotMetaByKey?.[key]).toEqual(meta(2));
  });

  it('preserves an omitted account key when hydrating a partial cache', async () => {
    const entity = new SimpleDbEntityLocalTokens();
    const read = mockEntityStorage<ISimpleDBLocalTokens>(entity, {
      data: {},
      tokenList: {},
      smallBalanceTokenList: {},
      riskyTokenList: {},
      tokenListMap: {},
      tokenListValue: {},
      tokenListCurrency: {},
    });
    const write = async (networkId: string, value: string, localSeq: number) =>
      entity.updateAccountTokenList({
        networkId,
        accountAddress: '0xalice',
        tokenList: [token(value)],
        smallBalanceTokenList: [],
        riskyTokenList: [],
        tokenListMap: { [value]: fiat(value) },
        tokenListValue: value,
        currency: 'usd',
        assetSnapshotMeta: meta(localSeq),
      });

    await write('evm--1', 'one', 1);
    await write('evm--56', 'two', 1);

    await entity.updateAccountTokenListByCache({
      tokenList: { 'evm--1_0xalice': [token('one-new')] },
      smallBalanceTokenList: {},
      riskyTokenList: {},
      tokenListMap: { 'evm--1_0xalice': { 'one-new': fiat('one-new') } },
      tokenListValue: { 'evm--1_0xalice': 'one-new' },
      tokenListCurrency: { 'evm--1_0xalice': 'usd' },
      assetSnapshotMetaByKey: { 'evm--1_0xalice': meta(2) },
    });

    const result = read();
    expect(result.tokenList['evm--1_0xalice']?.[0]?.$key).toBe('one-new');
    expect(result.tokenList['evm--56_0xalice']?.[0]?.$key).toBe('two');
  });
});

describe('SimpleDbEntityAccountValue snapshot admission', () => {
  it('accepts a newer lower balance and rejects an older response', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const read = mockEntityStorage<IAccountValueDb>(entity, {
      byAddress: {},
      allByAddress: {},
    });

    await entity.updateAccountValue({
      networkId: 'evm--1',
      accountAddress: '0xalice',
      value: '10',
      currency: 'usd',
      assetSnapshotMeta: meta(1),
    });
    await entity.updateAccountValue({
      networkId: 'evm--1',
      accountAddress: '0xalice',
      value: '3',
      currency: 'usd',
      assetSnapshotMeta: meta(2),
    });
    await entity.updateAccountValue({
      networkId: 'evm--1',
      accountAddress: '0xalice',
      value: '99',
      currency: 'usd',
      assetSnapshotMeta: meta(1),
    });

    expect(read().byAddress['evm--1_0xalice']).toEqual({
      value: '3',
      currency: 'usd',
      assetSnapshotMeta: meta(2),
    });
  });

  it('does not let an older full snapshot delete a newer network value', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const read = mockEntityStorage<IAccountValueDb>(entity, {
      byAddress: {},
      allByAddress: {},
    });
    const address = '0xalice';

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '10',
          assetSnapshotMeta: meta(2),
        },
        {
          networkId: 'evm--56',
          accountAddress: address,
          value: '20',
          assetSnapshotMeta: meta(3),
        },
      ],
      currency: 'usd',
      updateAll: false,
    });

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '1',
          assetSnapshotMeta: meta(1),
        },
      ],
      currency: 'usd',
      updateAll: true,
      snapshotMeta: meta(1),
    });

    expect(read().allByAddress[address]).toMatchObject({
      value: { 'evm--1': '10', 'evm--56': '20' },
    });
  });

  it('keeps a newer sibling when a full snapshot contains a mixed old item', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const read = mockEntityStorage<IAccountValueDb>(entity, {
      byAddress: {},
      allByAddress: {},
    });
    const address = '0xalice';

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '10',
          assetSnapshotMeta: meta(10),
        },
        {
          networkId: 'evm--56',
          accountAddress: address,
          value: '20',
          assetSnapshotMeta: meta(5),
        },
      ],
      currency: 'usd',
      updateAll: false,
    });

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '1',
          assetSnapshotMeta: meta(11),
        },
        {
          networkId: 'evm--56',
          accountAddress: address,
          value: '2',
          assetSnapshotMeta: meta(6),
        },
      ],
      currency: 'usd',
      updateAll: true,
      snapshotMeta: meta(11),
    });

    expect(read().allByAddress[address]?.value).toEqual({
      'evm--1': '1',
      'evm--56': '2',
    });

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '0',
          assetSnapshotMeta: meta(12),
        },
        {
          networkId: 'evm--56',
          accountAddress: address,
          value: '99',
          assetSnapshotMeta: meta(4),
        },
      ],
      currency: 'usd',
      updateAll: true,
      snapshotMeta: meta(12),
    });

    // The aggregate marker is newer, but the second network item is older than
    // the stored value. Full replacement must degrade to a per-network merge.
    expect(read().allByAddress[address]?.value).toEqual({
      'evm--1': '0',
      'evm--56': '2',
    });
  });

  it('treats an unversioned full snapshot as a partial merge', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const read = mockEntityStorage<IAccountValueDb>(entity, {
      byAddress: {},
      allByAddress: {},
    });
    const address = '0xalice';

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '10',
          assetSnapshotMeta: meta(2),
        },
        {
          networkId: 'evm--56',
          accountAddress: address,
          value: '20',
          assetSnapshotMeta: meta(2),
        },
      ],
      currency: 'usd',
      updateAll: false,
    });

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '1',
        },
      ],
      currency: 'usd',
      updateAll: true,
    });

    expect(read().allByAddress[address]?.value).toEqual({
      'evm--1': '10',
      'evm--56': '20',
    });
  });

  it('uses the newest aggregate or network marker for partial admission', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const read = mockEntityStorage<IAccountValueDb>(entity, {
      byAddress: {},
      allByAddress: {},
    });
    const address = '0xalice';

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '10',
          // Deliberately keep a stale per-network marker alongside a newer
          // complete marker to exercise the fallback admission path.
          assetSnapshotMeta: meta(5),
        },
      ],
      currency: 'usd',
      updateAll: true,
      snapshotMeta: meta(10),
    });

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '3',
          assetSnapshotMeta: meta(6),
        },
      ],
      currency: 'usd',
      updateAll: false,
    });

    expect(read().allByAddress[address]?.value).toEqual({ 'evm--1': '10' });
  });

  it('lets a full snapshot drop an omitted network after partial writes admitted the same responses', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const read = mockEntityStorage<IAccountValueDb>(entity, {
      byAddress: {},
      allByAddress: {},
    });
    const address = '0xalice';

    // Older complete snapshot that still covers evm--10.
    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '1',
          assetSnapshotMeta: meta(1),
        },
        {
          networkId: 'evm--56',
          accountAddress: address,
          value: '2',
          assetSnapshotMeta: meta(1),
        },
        {
          networkId: 'evm--10',
          accountAddress: address,
          value: '3',
          assetSnapshotMeta: meta(1),
        },
      ],
      currency: 'usd',
      updateAll: true,
      snapshotMeta: meta(1),
    });

    // Progressive per-network writes of the next round (evm--10 disabled).
    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '10',
          assetSnapshotMeta: meta(2),
        },
      ],
      currency: 'usd',
      updateAll: false,
    });
    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--56',
          accountAddress: address,
          value: '20',
          assetSnapshotMeta: meta(3),
        },
      ],
      currency: 'usd',
      updateAll: false,
    });

    // Full snapshot of that round with EQUAL per-network markers.
    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '10',
          assetSnapshotMeta: meta(2),
        },
        {
          networkId: 'evm--56',
          accountAddress: address,
          value: '20',
          assetSnapshotMeta: meta(3),
        },
      ],
      currency: 'usd',
      updateAll: true,
      snapshotMeta: meta(2),
    });

    expect(read().allByAddress[address]).toEqual({
      value: { 'evm--1': '10', 'evm--56': '20' },
      currency: 'usd',
      assetSnapshotMeta: meta(2),
      assetSnapshotMetaByNetwork: { 'evm--1': meta(2), 'evm--56': meta(3) },
    });
  });

  it('still keeps an omitted network whose marker is newer than the full snapshot', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const read = mockEntityStorage<IAccountValueDb>(entity, {
      byAddress: {},
      allByAddress: {},
    });
    const address = '0xalice';

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '10',
          assetSnapshotMeta: meta(2),
        },
        {
          networkId: 'evm--56',
          accountAddress: address,
          value: '20',
          assetSnapshotMeta: meta(9),
        },
      ],
      currency: 'usd',
      updateAll: false,
    });

    await entity.updateAllNetworkAccountValue({
      items: [
        {
          networkId: 'evm--1',
          accountAddress: address,
          value: '10',
          assetSnapshotMeta: meta(2),
        },
      ],
      currency: 'usd',
      updateAll: true,
      snapshotMeta: meta(2),
    });

    expect(read().allByAddress[address]).toMatchObject({
      value: { 'evm--1': '10', 'evm--56': '20' },
    });
    expect(read().allByAddress[address]?.assetSnapshotMeta).toBeUndefined();
  });

  it('skips the storage write when a refresh repeats persisted values and markers', async () => {
    const entity = new SimpleDbEntityAccountValue();
    const read = mockEntityStorage<IAccountValueDb>(entity, {
      byAddress: {},
      allByAddress: {},
    });
    const address = '0xalice';
    const setRawDataSpy = jest.spyOn(entity, 'setRawData');
    const items = [
      {
        networkId: 'evm--1',
        accountAddress: address,
        value: '10',
        assetSnapshotMeta: meta(2),
      },
      {
        networkId: 'evm--56',
        accountAddress: address,
        value: '20',
        assetSnapshotMeta: meta(3),
      },
    ];

    await entity.updateAllNetworkAccountValue({
      items,
      currency: 'usd',
      updateAll: true,
      snapshotMeta: meta(2),
    });
    expect(setRawDataSpy).toHaveBeenCalledTimes(1);

    // Same full snapshot again, and the same values as a partial merge:
    // nothing changes, so the entity must not be re-serialized.
    await entity.updateAllNetworkAccountValue({
      items,
      currency: 'usd',
      updateAll: true,
      snapshotMeta: meta(2),
    });
    await entity.updateAllNetworkAccountValue({
      items: [items[0]],
      currency: 'usd',
      updateAll: false,
    });
    // A rejected stale response is a no-op as well.
    await entity.updateAllNetworkAccountValue({
      items: [{ ...items[0], value: '1', assetSnapshotMeta: meta(1) }],
      currency: 'usd',
      updateAll: false,
    });
    expect(setRawDataSpy).toHaveBeenCalledTimes(1);

    // A newer marker with an unchanged value must still persist the marker,
    // otherwise a later stale response would be admitted against the old one.
    await entity.updateAllNetworkAccountValue({
      items: [{ ...items[0], assetSnapshotMeta: meta(4) }],
      currency: 'usd',
      updateAll: false,
    });
    expect(setRawDataSpy).toHaveBeenCalledTimes(2);
    expect(read().allByAddress[address]?.assetSnapshotMetaByNetwork).toEqual({
      'evm--1': meta(4),
      'evm--56': meta(3),
    });
  });

  it('skips the single-network storage write when value and marker are unchanged', async () => {
    const entity = new SimpleDbEntityAccountValue();
    mockEntityStorage<IAccountValueDb>(entity, {
      byAddress: {},
      allByAddress: {},
    });
    const setRawDataSpy = jest.spyOn(entity, 'setRawData');
    const write = (value: string, localSeq: number) =>
      entity.updateAccountValue({
        networkId: 'evm--1',
        accountAddress: '0xalice',
        value,
        currency: 'usd',
        assetSnapshotMeta: meta(localSeq),
      });

    await write('10', 2);
    await write('10', 2);
    await write('99', 1);
    expect(setRawDataSpy).toHaveBeenCalledTimes(1);

    await write('10', 3);
    expect(setRawDataSpy).toHaveBeenCalledTimes(2);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});
