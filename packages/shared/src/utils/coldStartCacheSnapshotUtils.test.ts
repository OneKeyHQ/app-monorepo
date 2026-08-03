import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';

import {
  SWAP_PRO_POSITIONS_CACHE_VERSION,
  parseColdStartSnapshotRaw,
  prepareColdStartSnapshotForWrite,
} from './coldStartCacheSnapshotUtils';

const perpsScope = 'store:perps';
const positionKey = `${perpsScope}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom}`;
const openOrdersKey = `${perpsScope}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveOpenOrdersAtom}`;
const activeInstrumentKey = `${perpsScope}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveTradeInstrumentAtom}`;
const swapPositionsKey = `store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProPositionsCacheAtom}`;

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

  it('bounds persisted Swap positions by recent owner, per-owner, and total token counts', () => {
    const result = prepareColdStartSnapshotForWrite(
      {
        [swapPositionsKey]: {
          version: SWAP_PRO_POSITIONS_CACHE_VERSION,
          byOwner: {
            old: {
              ownerKey: 'old',
              updatedAt: 1,
              tokens: [{ id: 'old-1' }, { id: 'old-2' }],
            },
            current: {
              ownerKey: 'current',
              updatedAt: 3,
              tokens: [
                { id: 'current-1' },
                { id: 'current-2' },
                { id: 'current-3' },
              ],
            },
            recent: {
              ownerKey: 'recent',
              updatedAt: 2,
              tokens: [{ id: 'recent-1' }, { id: 'recent-2' }],
            },
          },
        },
      },
      {
        maxSnapshotChars: 10_000,
        maxSwapPositionsBytes: 10_000,
        maxSwapPositionsOwners: 3,
        maxSwapPositionsTokensPerOwner: 2,
        maxSwapPositionsTotalTokens: 3,
      },
    );
    const byOwner = (
      result.snapshot[swapPositionsKey] as {
        byOwner: Record<string, { tokens: Array<{ id: string }> }>;
      }
    ).byOwner;

    expect(byOwner.current.tokens.map((token) => token.id)).toEqual([
      'current-1',
      'current-2',
    ]);
    expect(byOwner.recent.tokens.map((token) => token.id)).toEqual([
      'recent-1',
    ]);
    expect(byOwner.old).toBeUndefined();
  });

  it('drops only the volatile Swap positions key before it can evict other cold-start data', () => {
    const result = prepareColdStartSnapshotForWrite(
      {
        'store:home::ctx:lastConfirmedOverviewBalanceAtom': {
          byOwner: { a: '1' },
        },
        [positionKey]: {
          accountAddress: '0xabc',
          activePositions: [{ coin: 'BTC' }],
        },
        [swapPositionsKey]: {
          version: SWAP_PRO_POSITIONS_CACHE_VERSION,
          byOwner: {
            current: {
              ownerKey: 'current',
              updatedAt: 3,
              tokens: Array.from({ length: 4 }, (_, index) => ({
                id: `token-${index}`,
                payload: 'x'.repeat(100),
              })),
            },
          },
        },
      },
      {
        maxSnapshotChars: 300,
        maxSwapPositionsBytes: 10_000,
      },
    );

    expect(result.snapshot[swapPositionsKey]).toBeUndefined();
    expect(result.snapshot[positionKey]).toEqual({
      accountAddress: '0xabc',
      activePositions: [{ coin: 'BTC' }],
    });
    expect(
      result.snapshot['store:home::ctx:lastConfirmedOverviewBalanceAtom'],
    ).toEqual({ byOwner: { a: '1' } });
    expect(result.droppedKeys).toEqual([swapPositionsKey]);
    expect(result.serialized.length).toBeLessThanOrEqual(300);
  });

  it('fails closed when a persisted Swap positions schema is unsupported', () => {
    const result = prepareColdStartSnapshotForWrite({
      [swapPositionsKey]: {
        version: SWAP_PRO_POSITIONS_CACHE_VERSION + 1,
        byOwner: {
          stale: {
            ownerKey: 'stale',
            updatedAt: 1,
            tokens: [{ id: 'stale-token' }],
          },
        },
      },
    });

    expect(result.snapshot[swapPositionsKey]).toEqual({
      version: SWAP_PRO_POSITIONS_CACHE_VERSION,
      byOwner: {},
    });
  });

  it('applies the Swap positions budget in UTF-8 bytes', () => {
    const maxSwapPositionsBytes = 240;
    const result = prepareColdStartSnapshotForWrite(
      {
        [swapPositionsKey]: {
          version: SWAP_PRO_POSITIONS_CACHE_VERSION,
          byOwner: {
            current: {
              ownerKey: 'current',
              updatedAt: 1,
              tokens: [
                {
                  id: 'multibyte-token',
                  symbol: '界'.repeat(maxSwapPositionsBytes),
                },
              ],
            },
          },
        },
      },
      {
        maxSnapshotChars: 10_000,
        maxSwapPositionsBytes,
      },
    );
    const swapPositions = result.snapshot[swapPositionsKey] as {
      byOwner: Record<string, unknown>;
    };

    expect(swapPositions.byOwner).toEqual({});
    expect(
      new TextEncoder().encode(
        JSON.stringify(result.snapshot[swapPositionsKey]),
      ).byteLength,
    ).toBeLessThanOrEqual(maxSwapPositionsBytes);
  });
});
