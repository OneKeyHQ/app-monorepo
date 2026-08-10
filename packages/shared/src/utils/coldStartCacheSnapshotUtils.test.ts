import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';

import {
  isPerpsColdStartSnapshotKey,
  parseColdStartSnapshotRaw,
  prepareColdStartSnapshotForWrite,
  removePerpsColdStartSnapshotEntries,
} from './coldStartCacheSnapshotUtils';

const perpsScope = 'store:perps';
const positionKey = `${perpsScope}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom}`;
const openOrdersKey = `${perpsScope}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveOpenOrdersAtom}`;
const activeInstrumentKey = `${perpsScope}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveTradeInstrumentAtom}`;

describe('coldStartCacheSnapshotUtils', () => {
  it('parses object snapshots and rejects oversized raw payloads before JSON parsing', () => {
    expect(
      parseColdStartSnapshotRaw('{"a":1}', { maxSnapshotChars: 20 }),
    ).toEqual({ a: 1 });

    expect(
      parseColdStartSnapshotRaw('{"a":1}', { maxSnapshotChars: 3 }),
    ).toBeUndefined();
    expect(
      parseColdStartSnapshotRaw('[1,2,3]', { maxSnapshotChars: 20 }),
    ).toBeUndefined();
    expect(
      parseColdStartSnapshotRaw('{bad json', { maxSnapshotChars: 20 }),
    ).toBeUndefined();
  });

  it('trims Perps position and open-order list payloads before writing', () => {
    const result = prepareColdStartSnapshotForWrite(
      {
        [positionKey]: {
          accountAddress: '0xabc',
          activePositions: [{ coin: 'BTC' }, { coin: 'ETH' }, { coin: 'SOL' }],
        },
        [openOrdersKey]: {
          accountAddress: '0xabc',
          openOrders: [
            { coin: 'BTC', oid: 1 },
            { coin: 'ETH', oid: 2 },
            { coin: 'SOL', oid: 3 },
          ],
          openOrdersByCoin: {
            BTC: [{ coin: 'BTC', oid: 1 }],
            ETH: [{ coin: 'ETH', oid: 2 }],
            SOL: [{ coin: 'SOL', oid: 3 }],
            DOGE: [{ coin: 'DOGE', oid: 4 }],
          },
        },
      },
      { maxPerpsListItems: 2, maxSnapshotChars: 10_000 },
    );

    expect(
      (
        result.snapshot[positionKey] as {
          activePositions: Array<{ coin: string }>;
        }
      ).activePositions,
    ).toEqual([{ coin: 'BTC' }, { coin: 'ETH' }]);
    expect(
      (
        result.snapshot[openOrdersKey] as {
          openOrders: Array<{ coin: string; oid: number }>;
          openOrdersByCoin: Record<string, unknown>;
        }
      ).openOrders,
    ).toEqual([
      { coin: 'BTC', oid: 1 },
      { coin: 'ETH', oid: 2 },
    ]);
    expect(
      Object.keys(
        (
          result.snapshot[openOrdersKey] as {
            openOrdersByCoin: Record<string, unknown>;
          }
        ).openOrdersByCoin,
      ).toSorted(),
    ).toEqual(['BTC', 'ETH']);
  });

  it('drops only volatile Perps list snapshots when they push the snapshot over the soft cap', () => {
    const result = prepareColdStartSnapshotForWrite(
      {
        'store:home::ctx:lastConfirmedOverviewBalanceAtom': {
          byOwner: { a: '1' },
        },
        [activeInstrumentKey]: { mode: 'perp', coin: 'BTC' },
        [positionKey]: {
          accountAddress: '0xabc',
          activePositions: Array.from({ length: 20 }, (_, index) => ({
            coin: `COIN${index}`,
            payload: 'x'.repeat(40),
          })),
        },
        [openOrdersKey]: {
          accountAddress: '0xabc',
          openOrders: Array.from({ length: 20 }, (_, index) => ({
            coin: `COIN${index}`,
            oid: index,
            payload: 'x'.repeat(40),
          })),
          openOrdersByCoin: {},
        },
      },
      { maxPerpsListItems: 20, maxSnapshotChars: 300 },
    );

    expect(result.snapshot[positionKey]).toBeUndefined();
    expect(result.snapshot[openOrdersKey]).toBeUndefined();
    expect(result.snapshot[activeInstrumentKey]).toEqual({
      mode: 'perp',
      coin: 'BTC',
    });
    expect(
      result.snapshot['store:home::ctx:lastConfirmedOverviewBalanceAtom'],
    ).toEqual({ byOwner: { a: '1' } });
    expect(result.droppedKeys.toSorted()).toEqual([openOrdersKey, positionKey]);
  });

  it('removes every Perps scoped cold-start entry without touching other scopes', () => {
    const perpsKeys = Object.values(CONTEXT_ATOM_COLD_START_CACHE_KEYS)
      .filter((key) => key.startsWith('ctx:perps'))
      .map((key) => `${perpsScope}::${key}`);
    const homeKey = 'store:home::ctx:lastConfirmedOverviewBalanceAtom';
    const snapshot = Object.fromEntries([
      ...perpsKeys.map((key) => [key, { cached: true }]),
      [homeKey, { value: '100' }],
    ]);

    expect(perpsKeys.every(isPerpsColdStartSnapshotKey)).toBe(true);
    expect(isPerpsColdStartSnapshotKey(homeKey)).toBe(false);
    expect(removePerpsColdStartSnapshotEntries(snapshot)).toEqual({
      [homeKey]: { value: '100' },
    });
  });
});
