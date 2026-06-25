import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

import {
  type IAddressRiskCheckDBStruct,
  SimpleDbEntityAddressRiskCheck,
} from './SimpleDbEntityAddressRiskCheck';

function setupEntity(
  initial: IAddressRiskCheckDBStruct = { recentChecks: {} },
) {
  const entity = new SimpleDbEntityAddressRiskCheck();
  let store: IAddressRiskCheckDBStruct = initial;
  jest.spyOn(entity, 'getRawData').mockImplementation(async () => store);
  jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
    store = typeof builder === 'function' ? await builder(store) : builder;
    return store;
  });
  return { entity, getStore: () => store };
}

function recentItem(overrides: {
  networkId: string;
  address: string;
  level?: EKytRiskLevel;
  checkedAt?: number;
}) {
  return {
    networkId: overrides.networkId,
    address: overrides.address,
    level: overrides.level ?? EKytRiskLevel.None,
    checkedAt: overrides.checkedAt ?? 1,
  };
}

describe('SimpleDbEntityAddressRiskCheck.getRecentChecks', () => {
  test('orders by server check time (checkedAt) desc and honors the limit', async () => {
    const { entity } = setupEntity({
      recentChecks: {
        a: {
          ...recentItem({
            networkId: 'evm--1',
            address: '0xa',
            checkedAt: 100,
          }),
          updatedAt: 100,
        },
        b: {
          ...recentItem({
            networkId: 'evm--1',
            address: '0xb',
            checkedAt: 300,
          }),
          updatedAt: 100,
        },
        c: {
          ...recentItem({
            networkId: 'evm--1',
            address: '0xc',
            checkedAt: 200,
          }),
          updatedAt: 200,
        },
      },
    });

    const all = await entity.getRecentChecks();
    expect(all.map((i) => i.address)).toEqual(['0xb', '0xc', '0xa']);

    const limited = await entity.getRecentChecks({ limit: 2 });
    expect(limited.map((i) => i.address)).toEqual(['0xb', '0xc']);
  });
});

describe('SimpleDbEntityAddressRiskCheck.addCheck', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('stamps updatedAt without bumping a cached older check above newer checks', async () => {
    const { entity, getStore } = setupEntity({
      recentChecks: {
        'evm--1_0xold': {
          ...recentItem({
            networkId: 'evm--1',
            address: '0xold',
            checkedAt: 100,
          }),
          updatedAt: 1,
        },
        'evm--1_0xnewer': {
          ...recentItem({
            networkId: 'evm--1',
            address: '0xnewer',
            checkedAt: 300,
          }),
          updatedAt: 2,
        },
      },
    });

    jest.spyOn(Date, 'now').mockReturnValue(5000);
    await entity.addCheck(
      recentItem({ networkId: 'evm--1', address: '0xold', checkedAt: 100 }),
    );

    const items = await entity.getRecentChecks();
    expect(items.map((i) => i.address)).toEqual(['0xnewer', '0xold']);
    expect(items[1].updatedAt).toBe(5000);
    expect(Object.keys(getStore().recentChecks)).toHaveLength(2);
  });

  test('dedupes EVM addresses case-insensitively (checksum casing is cosmetic)', async () => {
    const { entity, getStore } = setupEntity();

    jest.spyOn(Date, 'now').mockReturnValue(1);
    await entity.addCheck(
      recentItem({ networkId: 'evm--1', address: '0xAbCdEf' }),
    );
    jest.spyOn(Date, 'now').mockReturnValue(2);
    await entity.addCheck(
      recentItem({ networkId: 'evm--1', address: '0xabcdef' }),
    );

    expect(Object.keys(getStore().recentChecks)).toHaveLength(1);
  });

  test('keeps case-sensitive (non-EVM) addresses as distinct records', async () => {
    const { entity, getStore } = setupEntity();

    jest.spyOn(Date, 'now').mockReturnValue(1);
    await entity.addCheck(
      recentItem({ networkId: 'sol--101', address: 'AbCdEf' }),
    );
    jest.spyOn(Date, 'now').mockReturnValue(2);
    await entity.addCheck(
      recentItem({ networkId: 'sol--101', address: 'abcdef' }),
    );

    expect(Object.keys(getStore().recentChecks)).toHaveLength(2);
  });

  test('trims to the 50 most recent records by server check time', async () => {
    const { entity, getStore } = setupEntity();

    for (let i = 0; i < 60; i += 1) {
      jest.spyOn(Date, 'now').mockReturnValue(i + 1);
      // eslint-disable-next-line no-await-in-loop
      await entity.addCheck(
        recentItem({
          networkId: 'evm--1',
          address: `0x${i}`,
          checkedAt: i + 1,
        }),
      );
    }

    const store = getStore();
    expect(Object.keys(store.recentChecks)).toHaveLength(50);
    const items = await entity.getRecentChecks({ limit: 100 });
    // Most recent first; the 10 oldest (0x0..0x9) must have been dropped.
    expect(items[0].address).toBe('0x59');
    expect(items.some((i) => i.address === '0x0')).toBe(false);
  });
});

describe('SimpleDbEntityAddressRiskCheck.deleteCheck / clearChecks', () => {
  test('deleteCheck removes the matching EVM record regardless of casing', async () => {
    const { entity, getStore } = setupEntity({
      recentChecks: {
        'evm--1_0xabc': {
          ...recentItem({ networkId: 'evm--1', address: '0xABC' }),
          updatedAt: 1,
        },
      },
    });

    await entity.deleteCheck({ networkId: 'evm--1', address: '0xAbC' });
    expect(Object.keys(getStore().recentChecks)).toHaveLength(0);
  });

  test('clearChecks empties the store', async () => {
    const { entity, getStore } = setupEntity({
      recentChecks: {
        'evm--1_0xabc': {
          ...recentItem({ networkId: 'evm--1', address: '0xabc' }),
          updatedAt: 1,
        },
      },
    });

    await entity.clearChecks();
    expect(getStore().recentChecks).toEqual({});
  });
});
