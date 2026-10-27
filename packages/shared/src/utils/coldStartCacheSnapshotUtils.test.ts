import { ESwapTabSwitchType } from '../../types/swap/types';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';
import platformEnvLite from '../platformEnvLite';

import {
  COLD_START_SNAPSHOT_MAX_CHARS,
  SWAP_PRO_POSITIONS_CACHE_VERSION,
  parseColdStartSnapshotRaw,
  prepareColdStartSnapshotForWrite,
} from './coldStartCacheSnapshotUtils';
import { sanitizeSwapTokenListSnapshot } from './swapTokenSelectorSnapshotUtils';

import type {
  ISwapToken,
  ISwapTokenListSnapshotMap,
} from '../../types/swap/types';

const perpsScope = 'store:perps';
const positionKey = `${perpsScope}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom}`;
const openOrdersKey = `${perpsScope}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveOpenOrdersAtom}`;
const activeInstrumentKey = `${perpsScope}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveTradeInstrumentAtom}`;
const swapPositionsKey = `store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProPositionsCacheAtom}`;
const selectorKey = `store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`;
const modalSelectorKey = `store:swapModal::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`;
const aggregateKey = `store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom}`;
const modalAggregateKey = `store:swapModal::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom}`;

function createAggregateTokens(count: number, logoLength = 20): ISwapToken[] {
  return Array.from({ length: count }, (_, index) => ({
    networkId: index === count - 1 ? 'evm--56' : 'evm--1',
    contractAddress: `0x${index}`,
    symbol: 'TOKEN',
    decimals: 18,
    balanceParsed: '1',
    fiatValue: '2',
    logoURI: `https://example.com/${'a'.repeat(logoLength)}.png`,
  }));
}

function createSelectorSnapshot(updatedAt: number, chainCount = 1) {
  return {
    version: 1,
    updatedAt,
    tokenCatch: Object.fromEntries(
      Array.from({ length: chainCount }, (_, index) => {
        const networkId = `evm--${index + 1}`;
        return [
          JSON.stringify({ networkId, keywords: '' }),
          {
            updatedAt: updatedAt + index,
            data: Array.from({ length: 15 }, (_token, tokenIndex) => ({
              networkId,
              contractAddress: `0x${tokenIndex}`,
              symbol: 'TOKEN',
              decimals: 18,
              logoURI: `https://example.com/${'a'.repeat(1000)}.png`,
            })),
          },
        ];
      }),
    ),
  };
}

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

  it('shares spare capacity across selector scopes without evicting other modules', () => {
    const baseline = {
      [activeInstrumentKey]: { mode: 'perp', coin: 'BTC' },
      [positionKey]: { activePositions: [{ coin: 'BTC' }] },
      [openOrdersKey]: {
        openOrders: [{ coin: 'BTC', oid: 1 }],
        openOrdersByCoin: { BTC: [{ coin: 'BTC', oid: 1 }] },
      },
      [swapPositionsKey]: {
        version: SWAP_PRO_POSITIONS_CACHE_VERSION,
        byOwner: {
          current: { updatedAt: 1, tokens: [{ id: 'ETH' }] },
        },
      },
    };
    const original = prepareColdStartSnapshotForWrite(baseline);
    const first = createSelectorSnapshot(1, 35);
    const second = createSelectorSnapshot(100, 35);
    const result = prepareColdStartSnapshotForWrite({
      ...baseline,
      [selectorKey]: first,
      [modalSelectorKey]: second,
    });

    expect(JSON.stringify(first).length).toBeGreaterThan(
      COLD_START_SNAPSHOT_MAX_CHARS / 2,
    );
    expect(result.serialized.length).toBeLessThanOrEqual(
      COLD_START_SNAPSHOT_MAX_CHARS,
    );
    Object.entries(original.snapshot).forEach(([key, value]) => {
      expect(result.snapshot[key]).toEqual(value);
      expect(result.droppedKeys).not.toContain(key);
    });
    let queryCount = 0;
    [selectorKey, modalSelectorKey].forEach((scopeKey) => {
      const value = result.snapshot[scopeKey] as
        | ISwapTokenListSnapshotMap
        | undefined;
      Object.values(value?.tokenCatch ?? {}).forEach((entry) => {
        expect(entry.data).toHaveLength(15);
        queryCount += 1;
      });
    });
    expect(queryCount).toBeGreaterThan(0);
    expect(queryCount).toBeLessThan(70);
    expect(
      Object.keys(
        (result.snapshot[modalSelectorKey] as ISwapTokenListSnapshotMap)
          .tokenCatch ?? {},
      ),
    ).toHaveLength(35);
  });

  it('keeps the newest complete query globally and accounts for exact scope envelopes', () => {
    const baseline = { [activeInstrumentKey]: { coin: 'BTC' } };
    const newest = sanitizeSwapTokenListSnapshot(createSelectorSnapshot(20));
    const maxSnapshotChars = JSON.stringify({
      ...baseline,
      [modalSelectorKey]: newest,
    }).length;
    const result = prepareColdStartSnapshotForWrite(
      {
        ...baseline,
        [selectorKey]: createSelectorSnapshot(10),
        [modalSelectorKey]: newest,
      },
      { maxSnapshotChars },
    );
    expect(result.snapshot[activeInstrumentKey]).toEqual(
      baseline[activeInstrumentKey],
    );
    expect(result.snapshot[modalSelectorKey]).toEqual(newest);
    expect(result.snapshot[selectorKey]).toBeUndefined();
    expect(result.droppedKeys).toEqual([selectorKey]);
    expect(result.serialized).toHaveLength(maxSnapshotChars);
  });

  it('preserves the previous baseline eviction policy before admitting selectors', () => {
    const baseline = {
      [activeInstrumentKey]: { coin: 'BTC' },
      [positionKey]: {
        activePositions: [{ coin: 'BTC', payload: 'x'.repeat(500) }],
      },
      [swapPositionsKey]: {
        version: SWAP_PRO_POSITIONS_CACHE_VERSION,
        byOwner: {
          current: {
            updatedAt: 1,
            tokens: [{ id: 'ETH', payload: 'x'.repeat(500) }],
          },
        },
      },
    };
    const options = { maxSnapshotChars: 200 };
    const original = prepareColdStartSnapshotForWrite(baseline, options);
    const result = prepareColdStartSnapshotForWrite(
      { ...baseline, [selectorKey]: createSelectorSnapshot(10) },
      options,
    );
    expect(result.snapshot).toEqual(original.snapshot);
    expect(result.droppedKeys).toEqual([...original.droppedKeys, selectorKey]);
    expect(result.serialized).toBe(original.serialized);
  });

  describe('desktop aggregate spare capacity', () => {
    const originalPlatform = {
      isDesktop: platformEnvLite.isDesktop,
      isWeb: platformEnvLite.isWeb,
      isNative: platformEnvLite.isNative,
      isExtension: platformEnvLite.isExtension,
    };
    const ownerKey = `wallet-1__${ESwapTabSwitchType.SWAP}__usd`;
    const stockOwnerKey = `wallet-1__${ESwapTabSwitchType.STOCK}__usd`;
    const baseline = {
      [positionKey]: { activePositions: [{ coin: 'BTC' }] },
      [swapPositionsKey]: {
        version: SWAP_PRO_POSITIONS_CACHE_VERSION,
        byOwner: { current: { updatedAt: 1, tokens: [{ id: 'ETH' }] } },
      },
    };

    beforeEach(() => {
      Object.assign(platformEnvLite, {
        isDesktop: true,
        isWeb: false,
        isNative: false,
        isExtension: false,
      });
    });

    afterEach(() => {
      Object.assign(platformEnvLite, originalPlatform);
    });

    it.each(['desktop', 'web'] as const)(
      'omits a large complete aggregate without evicting SwapPro or Perps on %s',
      (platform) => {
        platformEnvLite.isDesktop = platform === 'desktop';
        platformEnvLite.isWeb = platform === 'web';
        const tokens = createAggregateTokens(1000, 1200);
        const result = prepareColdStartSnapshotForWrite({
          ...baseline,
          [aggregateKey]: { [ownerKey]: tokens },
        });
        expect(tokens.length).toBeLessThanOrEqual(2000);
        expect(JSON.stringify(tokens).length).toBeGreaterThan(
          COLD_START_SNAPSHOT_MAX_CHARS,
        );
        expect(result.snapshot).toEqual(baseline);
        expect(result.droppedKeys).toEqual([aggregateKey]);
        expect(result.serialized.length).toBeLessThanOrEqual(
          COLD_START_SNAPSHOT_MAX_CHARS,
        );
        expect(parseColdStartSnapshotRaw(result.serialized)).toEqual(baseline);
      },
    );

    it.each([false, true])(
      'counts exact owner and scope envelopes while retaining whole and empty holdings (baseline=%s)',
      (withBaseline) => {
        const firstOwner = `wallet"first\\path__${ESwapTabSwitchType.SWAP}__usd`;
        const emptyOwner = `wallet-empty__${ESwapTabSwitchType.SWAP}__usd`;
        const oversizedOwner = `wallet-large__${ESwapTabSwitchType.SWAP}__usd`;
        const firstTokens = createAggregateTokens(2);
        const nextTokens = createAggregateTokens(3);
        const expected = {
          ...(withBaseline ? baseline : {}),
          [aggregateKey]: { [firstOwner]: firstTokens, [emptyOwner]: [] },
          [modalAggregateKey]: { [ownerKey]: nextTokens },
        };
        const maxSnapshotChars = JSON.stringify(expected).length;
        const result = prepareColdStartSnapshotForWrite(
          {
            ...(withBaseline ? baseline : {}),
            [aggregateKey]: {
              [firstOwner]: firstTokens,
              [oversizedOwner]: createAggregateTokens(20, 2000),
              [emptyOwner]: [],
            },
            [modalAggregateKey]: { [ownerKey]: nextTokens },
          },
          { maxSnapshotChars },
        );
        expect(result.snapshot).toEqual(expected);
        expect(result.serialized).toHaveLength(maxSnapshotChars);
        expect(parseColdStartSnapshotRaw(result.serialized)).toEqual(expected);
        expect(result.droppedKeys).toEqual([]);
      },
    );

    it('admits complete aggregates before sharing the remainder among newest chain queries', () => {
      const aggregate = { [ownerKey]: createAggregateTokens(3) };
      const newest = sanitizeSwapTokenListSnapshot(createSelectorSnapshot(20));
      const expected = {
        ...baseline,
        [aggregateKey]: aggregate,
        [modalSelectorKey]: newest,
      };
      const maxSnapshotChars = JSON.stringify(expected).length;
      const result = prepareColdStartSnapshotForWrite(
        {
          ...baseline,
          [selectorKey]: createSelectorSnapshot(10),
          [modalSelectorKey]: newest,
          [aggregateKey]: aggregate,
        },
        { maxSnapshotChars },
      );
      expect(result.snapshot).toEqual(expected);
      expect(result.serialized).toHaveLength(maxSnapshotChars);
      expect(result.droppedKeys).toEqual([selectorKey]);
    });

    it('keeps Stock in the baseline and merges only complete Swap owners into the same scope', () => {
      const stockTokens = createAggregateTokens(1);
      const tokens = createAggregateTokens(2);
      const oversizedOwner = `wallet-large__${ESwapTabSwitchType.SWAP}__usd`;
      const source = {
        [stockOwnerKey]: stockTokens,
        [ownerKey]: tokens,
        [oversizedOwner]: createAggregateTokens(20, 2000),
      };
      const expected = {
        ...baseline,
        [aggregateKey]: { [stockOwnerKey]: stockTokens, [ownerKey]: tokens },
      };
      const maxSnapshotChars = JSON.stringify(expected).length;
      const result = prepareColdStartSnapshotForWrite(
        { ...baseline, [aggregateKey]: source },
        { maxSnapshotChars },
      );
      expect(result.snapshot).toEqual(expected);
      expect(result.serialized).toHaveLength(maxSnapshotChars);
      expect(source[oversizedOwner]).toHaveLength(20);
    });

    it.each([
      { platform: 'native', protocol: ESwapTabSwitchType.SWAP },
      { platform: 'extension', protocol: ESwapTabSwitchType.SWAP },
      { platform: 'desktop', protocol: ESwapTabSwitchType.STOCK },
    ] as const)(
      'preserves the existing baseline eviction policy for $platform $protocol aggregates',
      ({ platform, protocol }) => {
        Object.assign(platformEnvLite, {
          isDesktop: platform === 'desktop',
          isNative: platform === 'native',
          isExtension: platform === 'extension',
        });
        const aggregate = {
          [`wallet-1__${protocol}__usd`]: createAggregateTokens(2, 2000),
        };
        const maxSnapshotChars = JSON.stringify(baseline).length;
        const result = prepareColdStartSnapshotForWrite(
          { ...baseline, [aggregateKey]: aggregate },
          { maxSnapshotChars },
        );
        expect(result.snapshot[aggregateKey]).toEqual(aggregate);
        expect(result.snapshot[swapPositionsKey]).toBeUndefined();
        expect(result.snapshot[positionKey]).toBeUndefined();
        expect(result.droppedKeys).toEqual([swapPositionsKey, positionKey]);
      },
    );

    it('reuses immutable aggregate serialization sizes when an owner cannot fit', () => {
      const token = createAggregateTokens(1, 2000)[0];
      const toJSON = jest.fn(() => token);
      const tokens = [{ ...token, toJSON }];
      const source = { ...baseline, [aggregateKey]: { [ownerKey]: tokens } };
      const maxSnapshotChars = JSON.stringify(baseline).length;
      prepareColdStartSnapshotForWrite(source, { maxSnapshotChars });
      prepareColdStartSnapshotForWrite(source, { maxSnapshotChars });
      expect(toJSON).toHaveBeenCalledTimes(1);
    });
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
