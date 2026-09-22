/**
 * TokenList cells — OWNER-SWITCH replay tests (OK-63873).
 *
 * The home list used to skeleton on every account/network switch because the
 * projection stayed stamped for the previous owner until the async BG PULL
 * landed. These tests pin the two synchronous paint sources that now cover a
 * switch, with a real jotai `createStore()` (no React), mirroring the
 * cutover / coldStart harnesses:
 *   - the main-heap per-owner REPLAY cache (`ownerFrameReplayCache` +
 *     `replayOwnerFrames`): LRU bound, currency invalidation, provisional
 *     generation (a real gen-0 frame after replay is NOT dropped), idempotence;
 *   - the PERSISTED per-owner slim slot (`persistSlimColdCache` →
 *     `tokenListOwnerSlimCache`, `hydrateCellsFromOwnerSlimCache`): written on
 *     the debounced persist, keyed per owner, currency-gated, never paints
 *     another owner's rows.
 */
import { createStore } from 'jotai';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  fiatEqual,
  isAgg,
  metaEqual,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import { buildTokenListOwnerSlimCacheKey } from '@onekeyhq/shared/src/storage/uiSnapshotCaches';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { listStructureAtom, riskyListFrameAtom } from '../atoms';
import {
  applyRiskyFrame,
  applyStructureSnapshot,
  applyValuationFrame,
  buildApplyDeps,
  shallowEqualArray,
} from '../cells/apply';
import {
  PERSIST_DEBOUNCE_MS,
  hydrateCellsFromOwnerSlimCache,
  readOwnerSlimCache,
  schedulePersistSlimColdCache,
} from '../cells/coldStart';
import {
  OWNER_REPLAY_CACHE_CAP,
  clearOwnerReplayCache,
  getOwnerReplayCacheSize,
  getOwnerReplayFrames,
  rememberOwnerReplayFrame,
} from '../cells/ownerFrameReplayCache';
import {
  replayOwnerFrames,
  resolveReplayedRiskyOwner,
} from '../cells/ownerReplay';
import {
  aggCell,
  cell,
  clearAll,
  ensureStoreProjection,
  meta,
  subcell,
} from '../cells/projection';

import type { IJotaiContextStore } from '../../../utils/createJotaiContext';
import type { IApplyDeps } from '../cells/apply';
import type {
  IRiskyPush,
  IStructurePush,
  IValuationPush,
} from '../cells/ownerFrameReplayCache';
import type { IStoreProjection } from '../cells/projection';

// The boot-blob sink is not under test here; the flush trigger attaches
// DOM/AppState listeners — stub both out in node.
jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils', () => {
  const actual = jest.requireActual(
    '@onekeyhq/kit-bg/src/states/jotai/utils',
  ) as Record<string, unknown>;
  return {
    ...actual,
    writeColdStartSnapshotKey: (): void => undefined,
  };
});
jest.mock('@onekeyhq/shared/src/storage/coldStartFlushTrigger', () => ({
  __esModule: true,
  registerColdStartFlushTrigger: () => () => undefined,
}));

// In-memory stand-in for the per-owner MMKV namespace so the test observes the
// exact records the persist writes and the hydrate reads.
const ownerSlimRecords = new Map<string, Record<string, unknown>>();
jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/storage/uiSnapshotCaches',
  ) as Record<string, unknown>;
  return {
    ...actual,
    tokenListOwnerSlimCache: {
      get: (key: string) => {
        const data = ownerSlimRecords.get(key);
        return data ? { data, updatedAt: 0 } : undefined;
      },
      set: (key: string, data: Record<string, unknown>) => {
        ownerSlimRecords.set(key, data);
      },
      setMany: () => undefined,
      remove: (key: string) => {
        ownerSlimRecords.delete(key);
      },
      keys: () => Array.from(ownerSlimRecords.keys()),
      sweep: () => undefined,
      clear: () => ownerSlimRecords.clear(),
    },
  };
});

type IStore = ReturnType<typeof createStore>;

const STORE_NAME = EJotaiContextStoreNames.homeTokenList;
const STORE_DATA = { storeName: STORE_NAME } as IJotaiContextStoreData;
const SCOPE_KEY = 'store:homeTokenList';
const OWNER_A = 'accA__net';
const OWNER_B = 'accB__net';
const CURRENCY = 'usd';

function makeFiat(overrides: Partial<ITokenFiat> = {}): ITokenFiat {
  return {
    balance: '0',
    balanceParsed: '0',
    fiatValue: '0',
    price: 0,
    ...overrides,
  };
}

function makeToken(overrides: Partial<IToken> = {}): IToken {
  return {
    name: 'Token',
    symbol: 'TKN',
    decimals: 18,
    address: '0xabc',
    isNative: false,
    ...overrides,
  };
}

function makeStructure(
  overrides: Partial<IStructureSnapshot> = {},
): IStructureSnapshot {
  return {
    orderedIds: [],
    smallBalanceIds: [],
    nonZeroIds: [],
    fundedIds: [],
    metaPatch: {},
    aggMembership: {},
    smallBalanceFiatValue: '0',
    ownedAggregateTokenListMap: {},
    storeData: STORE_DATA,
    ownerKey: OWNER_A,
    generation: 0,
    ...overrides,
  };
}

function makeValuation(
  overrides: Partial<IValuationFrame> = {},
): IValuationFrame {
  return {
    changedFiatById: {},
    changedAggFiat: {},
    storeData: STORE_DATA,
    ownerKey: OWNER_A,
    ...overrides,
  };
}

function setup(): {
  store: IStore;
  ctx: IJotaiContextStore;
  projection: IStoreProjection;
  deps: IApplyDeps;
} {
  const store = createStore();
  const ctx = store as unknown as IJotaiContextStore;
  // Stamp the cold-start scope so `resolveStoreData` names the store (what the
  // real named home store carries) — the persist path keys the owner slot on it.
  (
    store as unknown as { __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string }
  ).__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__ = SCOPE_KEY;
  const projection = ensureStoreProjection(ctx);
  const deps = buildApplyDeps({
    store: ctx,
    listStructureAtom: listStructureAtom(),
    riskyListFrameAtom: riskyListFrameAtom(),
    resolveCurrentStore: (data) =>
      (data.storeName === STORE_NAME
        ? store
        : undefined) as unknown as ReturnType<
        IApplyDeps['resolveCurrentStore']
      >,
    fiatEqual,
    metaEqual,
    isAgg,
    clearAll,
    shallowEqual: shallowEqualArray,
    meta,
    cell,
    subcell,
    aggCell,
  });
  return { store, ctx, projection, deps };
}

/** Apply a full round for `ownerKey` the way the receive shell does, and remember it. */
function applyAndRememberRound({
  ctx,
  projection,
  deps,
  ownerKey,
  tokenKey,
  fiatValue,
  generation,
  risky,
}: {
  ctx: IJotaiContextStore;
  projection: IStoreProjection;
  deps: IApplyDeps;
  ownerKey: string;
  tokenKey: string;
  fiatValue: string;
  generation: number;
  risky?: boolean;
}): void {
  const structurePush: IStructurePush = {
    ownerKey,
    structureVersion: generation,
    structure: makeStructure({
      ownerKey,
      generation,
      orderedIds: [tokenKey],
      nonZeroIds: [tokenKey],
      fundedIds: [tokenKey],
      metaPatch: { [tokenKey]: makeToken({ symbol: tokenKey }) },
    }),
  };
  applyStructureSnapshot(ctx, projection, structurePush.structure, deps);
  rememberOwnerReplayFrame({
    storeName: STORE_NAME,
    ownerKey,
    kind: 'structure',
    payload: structurePush,
    currencyId: CURRENCY,
  });
  const valuationPush: IValuationPush = {
    ownerKey,
    valuationVersion: generation,
    valuation: makeValuation({
      ownerKey,
      changedFiatById: { [tokenKey]: makeFiat({ fiatValue }) },
    }),
  };
  applyValuationFrame(ctx, projection, valuationPush.valuation, deps, (fn) =>
    fn(),
  );
  rememberOwnerReplayFrame({
    storeName: STORE_NAME,
    ownerKey,
    kind: 'valuation',
    payload: valuationPush,
    currencyId: CURRENCY,
  });
  if (risky) {
    const riskyPush: IRiskyPush = {
      ownerKey,
      riskyVersion: 0,
      riskyTokens: [
        { $key: `${tokenKey}-risky`, ...makeToken({ symbol: 'RISK' }) },
      ] as unknown as IRiskyPush['riskyTokens'],
      riskyMap: { [`${tokenKey}-risky`]: makeFiat({ fiatValue: '1' }) },
    };
    applyRiskyFrame(
      ctx,
      {
        riskyTokens: riskyPush.riskyTokens,
        riskyMap: riskyPush.riskyMap,
        storeData: STORE_DATA,
        ownerKey,
      },
      deps,
    );
    rememberOwnerReplayFrame({
      storeName: STORE_NAME,
      ownerKey,
      kind: 'risky',
      payload: riskyPush,
      currencyId: CURRENCY,
    });
  }
}

beforeEach(() => {
  clearOwnerReplayCache();
  ownerSlimRecords.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ownerFrameReplayCache — bounded per-owner LRU', () => {
  it('remembers per (storeName, ownerKey, kind) and evicts the least recently used past the cap', () => {
    for (let i = 0; i < OWNER_REPLAY_CACHE_CAP + 1; i += 1) {
      rememberOwnerReplayFrame({
        storeName: STORE_NAME,
        ownerKey: `acc${i}__net`,
        kind: 'structure',
        payload: {
          ownerKey: `acc${i}__net`,
          structureVersion: 0,
          structure: makeStructure({ ownerKey: `acc${i}__net` }),
        },
        currencyId: CURRENCY,
      });
    }
    expect(getOwnerReplayCacheSize()).toBe(OWNER_REPLAY_CACHE_CAP);
    // owner 0 was the LRU -> evicted; the newest survives.
    expect(
      getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: 'acc0__net' }),
    ).toBeUndefined();
    expect(
      getOwnerReplayFrames({
        storeName: STORE_NAME,
        ownerKey: `acc${OWNER_REPLAY_CACHE_CAP}__net`,
      })?.structure?.ownerKey,
    ).toBe(`acc${OWNER_REPLAY_CACHE_CAP}__net`);
  });

  it('a read refreshes recency so a revisited owner is not the next eviction victim', () => {
    for (let i = 0; i < OWNER_REPLAY_CACHE_CAP; i += 1) {
      rememberOwnerReplayFrame({
        storeName: STORE_NAME,
        ownerKey: `acc${i}__net`,
        kind: 'structure',
        payload: {
          ownerKey: `acc${i}__net`,
          structureVersion: 0,
          structure: makeStructure({ ownerKey: `acc${i}__net` }),
        },
        currencyId: CURRENCY,
      });
    }
    // Touch owner 0 (a switch back to it), then add one more owner.
    getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: 'acc0__net' });
    rememberOwnerReplayFrame({
      storeName: STORE_NAME,
      ownerKey: 'accNew__net',
      kind: 'structure',
      payload: {
        ownerKey: 'accNew__net',
        structureVersion: 0,
        structure: makeStructure({ ownerKey: 'accNew__net' }),
      },
      currencyId: CURRENCY,
    });
    expect(
      getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: 'acc0__net' }),
    ).toBeDefined();
    expect(
      getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: 'acc1__net' }),
    ).toBeUndefined();
  });

  it('a currency change drops the owner previously remembered frames instead of merging', () => {
    rememberOwnerReplayFrame({
      storeName: STORE_NAME,
      ownerKey: OWNER_A,
      kind: 'structure',
      payload: {
        ownerKey: OWNER_A,
        structureVersion: 0,
        structure: makeStructure(),
      },
      currencyId: 'usd',
    });
    rememberOwnerReplayFrame({
      storeName: STORE_NAME,
      ownerKey: OWNER_A,
      kind: 'valuation',
      payload: {
        ownerKey: OWNER_A,
        valuationVersion: 0,
        valuation: makeValuation(),
      },
      currencyId: 'cny',
    });
    const frames = getOwnerReplayFrames({
      storeName: STORE_NAME,
      ownerKey: OWNER_A,
    });
    expect(frames?.currencyId).toBe('cny');
    expect(frames?.structure).toBeUndefined();
    expect(frames?.valuation).toBeDefined();
  });

  it('is scoped by storeName (home vs urlAccount never share an entry)', () => {
    rememberOwnerReplayFrame({
      storeName: STORE_NAME,
      ownerKey: OWNER_A,
      kind: 'structure',
      payload: {
        ownerKey: OWNER_A,
        structureVersion: 0,
        structure: makeStructure(),
      },
      currencyId: CURRENCY,
    });
    expect(
      getOwnerReplayFrames({
        storeName: 'urlAccountTokenList',
        ownerKey: OWNER_A,
      }),
    ).toBeUndefined();
  });
});

describe('replayOwnerFrames — synchronous owner-switch paint', () => {
  it('switching back to a remembered owner paints its rows + fiat + risky before any frame arrives', () => {
    const { store, ctx, projection, deps } = setup();
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_A,
      tokenKey: 'a',
      fiatValue: '7',
      generation: 3,
      risky: true,
    });
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_B,
      tokenKey: 'b',
      fiatValue: '9',
      generation: 1,
    });
    expect(store.get(listStructureAtom()).ownerKey).toBe(OWNER_B);

    // User switches back to A: replay from the main-heap cache.
    const result = replayOwnerFrames({
      store: ctx,
      projection,
      deps,
      frames: getOwnerReplayFrames({
        storeName: STORE_NAME,
        ownerKey: OWNER_A,
      }),
      storeData: STORE_DATA,
      ownerKey: OWNER_A,
      currentCurrency: CURRENCY,
    });
    expect(result).toEqual({ structure: true, risky: true });
    const structure = store.get(listStructureAtom());
    expect(structure.ownerKey).toBe(OWNER_A);
    expect(structure.orderedIds).toEqual(['a']);
    expect(structure.generation).toBe(3);
    expect(store.get(cell(ctx, 'a'))?.fiatValue).toBe('7');
    expect(store.get(meta(ctx, 'a'))?.symbol).toBe('a');
    expect(store.get(riskyListFrameAtom()).riskyTokens).toHaveLength(1);
    // B's cell was pruned by the owner switch (never leaks into A).
    expect(projection.cells.has('b')).toBe(false);
  });

  it('is provisional: a real gen-0 frame after a BG owner eviction still supersedes the replay', () => {
    const { store, ctx, projection, deps } = setup();
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_A,
      tokenKey: 'a',
      fiatValue: '7',
      generation: 5,
    });
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_B,
      tokenKey: 'b',
      fiatValue: '9',
      generation: 1,
    });
    replayOwnerFrames({
      store: ctx,
      projection,
      deps,
      frames: getOwnerReplayFrames({
        storeName: STORE_NAME,
        ownerKey: OWNER_A,
      }),
      storeData: STORE_DATA,
      ownerKey: OWNER_A,
      currentCurrency: CURRENCY,
    });
    expect(projection.curGeneration).toBe(-1);

    // BG restarted A's counter (LRU eviction + re-ingest): gen 0 with a NEW row.
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        ownerKey: OWNER_A,
        generation: 0,
        orderedIds: ['a', 'a2'],
        metaPatch: { a2: makeToken({ symbol: 'a2' }) },
      }),
      deps,
    );
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['a', 'a2']);
    expect(projection.curGeneration).toBe(0);
  });

  it('is idempotent once the projection is stamped for the owner (cold hydrate / live frame landed first)', () => {
    const { store, ctx, projection, deps } = setup();
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_A,
      tokenKey: 'a',
      fiatValue: '7',
      generation: 2,
    });
    // A live frame for A is already applied (generation >= 0) -> no re-apply.
    const setSpy = jest.spyOn(store, 'set');
    const result = replayOwnerFrames({
      store: ctx,
      projection,
      deps,
      frames: getOwnerReplayFrames({
        storeName: STORE_NAME,
        ownerKey: OWNER_A,
      }),
      storeData: STORE_DATA,
      ownerKey: OWNER_A,
      currentCurrency: CURRENCY,
    });
    expect(result).toEqual({ structure: false, risky: false });
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });

  it('a replay the selector fast path already did is not reported as "nothing replayed" by the layout entry, so the owner reset keeps the risky list', () => {
    const { store, ctx, projection, deps } = setup();
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_A,
      tokenKey: 'a',
      fiatValue: '7',
      generation: 3,
      risky: true,
    });
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_B,
      tokenKey: 'b',
      fiatValue: '9',
      generation: 1,
    });
    const replay = () =>
      replayOwnerFrames({
        store: ctx,
        projection,
        deps,
        frames: getOwnerReplayFrames({
          storeName: STORE_NAME,
          ownerKey: OWNER_A,
        }),
        storeData: STORE_DATA,
        ownerKey: OWNER_A,
        currentCurrency: CURRENCY,
      });

    // 1. Selector publish (before React renders): the real replay.
    let bookkeeping = resolveReplayedRiskyOwner({
      replayed: replay(),
      alreadyStamped: projection.curOwnerKey === OWNER_A,
      previous: undefined,
      ownerKey: OWNER_A,
    });
    expect(bookkeeping).toEqual({ next: OWNER_A, risky: true });
    expect(store.get(riskyListFrameAtom()).riskyTokens).toHaveLength(1);

    // 2. Layout effect for the same switch: idempotence short-circuit.
    const second = replay();
    expect(second).toEqual({ structure: false, risky: false });
    bookkeeping = resolveReplayedRiskyOwner({
      replayed: second,
      alreadyStamped: projection.curOwnerKey === OWNER_A,
      previous: bookkeeping.next,
      ownerKey: OWNER_A,
    });
    // "Already painted", not "nothing replayed": the record survives...
    expect(bookkeeping).toEqual({ next: OWNER_A, risky: true });
    // ...so the owner reset (`replayedRiskyOwnerRef.current === ownerKey`)
    // skips the blank and the replayed risky rows stay on screen.
    expect(store.get(riskyListFrameAtom()).riskyTokens).toHaveLength(1);

    // A third owner replayed with no risky frame drops the record.
    bookkeeping = resolveReplayedRiskyOwner({
      replayed: { structure: true, risky: false },
      alreadyStamped: false,
      previous: bookkeeping.next,
      ownerKey: OWNER_B,
    });
    expect(bookkeeping).toEqual({ next: undefined, risky: false });
  });

  it('MISSES on a currency mismatch, an unknown owner, or frames stamped for another owner', () => {
    const { ctx, projection, deps } = setup();
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_A,
      tokenKey: 'a',
      fiatValue: '7',
      generation: 2,
    });
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_B,
      tokenKey: 'b',
      fiatValue: '9',
      generation: 1,
    });
    const framesA = getOwnerReplayFrames({
      storeName: STORE_NAME,
      ownerKey: OWNER_A,
    });
    expect(
      replayOwnerFrames({
        store: ctx,
        projection,
        deps,
        frames: framesA,
        storeData: STORE_DATA,
        ownerKey: OWNER_A,
        currentCurrency: 'cny',
      }).structure,
    ).toBe(false);
    expect(
      replayOwnerFrames({
        store: ctx,
        projection,
        deps,
        frames: undefined,
        storeData: STORE_DATA,
        ownerKey: 'accX__net',
        currentCurrency: CURRENCY,
      }).structure,
    ).toBe(false);
    // Frames for A must never paint under owner C.
    expect(
      replayOwnerFrames({
        store: ctx,
        projection,
        deps,
        frames: framesA,
        storeData: STORE_DATA,
        ownerKey: 'accC__net',
        currentCurrency: CURRENCY,
      }).structure,
    ).toBe(false);
    expect(projection.curOwnerKey).toBe(OWNER_B);
  });
});

describe('per-owner persisted slim slot — cold-start switch paint', () => {
  it('the debounced persist writes an owner-keyed slim record', () => {
    const { ctx, projection, deps } = setup();
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_A,
      tokenKey: 'a',
      fiatValue: '7',
      generation: 2,
    });
    schedulePersistSlimColdCache({
      store: ctx,
      projection,
      getCurrency: () => CURRENCY,
    });
    expect(ownerSlimRecords.size).toBe(0);
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS);
    const key = buildTokenListOwnerSlimCacheKey({
      storeName: STORE_NAME,
      ownerKey: OWNER_A,
    });
    expect(ownerSlimRecords.get(key)).toMatchObject({
      ownerKey: OWNER_A,
      currency: CURRENCY,
      orderedIds: ['a'],
    });
    expect(
      readOwnerSlimCache({ storeName: STORE_NAME, ownerKey: OWNER_A }),
    ).toBe(ownerSlimRecords.get(key));
  });

  it('a fresh process (empty replay cache) still paints the target owner from its persisted slot', () => {
    const { store, ctx, projection, deps } = setup();
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_A,
      tokenKey: 'a',
      fiatValue: '7',
      generation: 2,
    });
    schedulePersistSlimColdCache({
      store: ctx,
      projection,
      getCurrency: () => CURRENCY,
    });
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS);

    // Simulate a restart into owner B, then a switch to A with nothing in the
    // main heap for A.
    clearOwnerReplayCache();
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_B,
      tokenKey: 'b',
      fiatValue: '9',
      generation: 0,
    });
    const painted = hydrateCellsFromOwnerSlimCache({
      store: ctx,
      projection,
      deps,
      storeName: STORE_NAME,
      storeData: STORE_DATA,
      ownerKey: OWNER_A,
      currentCurrency: CURRENCY,
    });
    expect(painted).toBe(true);
    expect(store.get(listStructureAtom()).ownerKey).toBe(OWNER_A);
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['a']);
    expect(store.get(cell(ctx, 'a'))?.fiatValue).toBe('7');
    // provisional, like the boot hydrate
    expect(projection.curGeneration).toBe(-1);
  });

  it('never paints another owner slot and MISSES on a currency mismatch', () => {
    const { ctx, projection, deps } = setup();
    applyAndRememberRound({
      ctx,
      projection,
      deps,
      ownerKey: OWNER_A,
      tokenKey: 'a',
      fiatValue: '7',
      generation: 2,
    });
    schedulePersistSlimColdCache({
      store: ctx,
      projection,
      getCurrency: () => CURRENCY,
    });
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS);

    expect(
      hydrateCellsFromOwnerSlimCache({
        store: ctx,
        projection,
        deps,
        storeName: STORE_NAME,
        storeData: STORE_DATA,
        ownerKey: OWNER_B,
        currentCurrency: CURRENCY,
      }),
    ).toBe(false);
    expect(
      hydrateCellsFromOwnerSlimCache({
        store: ctx,
        projection,
        deps,
        storeName: STORE_NAME,
        storeData: STORE_DATA,
        ownerKey: OWNER_A,
        currentCurrency: 'cny',
      }),
    ).toBe(false);
  });

  it('builds a storage-safe, collision-free key for derive-path owner keys', () => {
    const pattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
    const btc = buildTokenListOwnerSlimCacheKey({
      storeName: STORE_NAME,
      ownerKey: "hd-1--m/86'/0'/0'__btc--0",
    });
    const evm = buildTokenListOwnerSlimCacheKey({
      storeName: STORE_NAME,
      ownerKey: 'hd-1--0__evm--1',
    });
    expect(btc).toMatch(pattern);
    expect(evm).toMatch(pattern);
    expect(btc).not.toBe(evm);
    expect(
      buildTokenListOwnerSlimCacheKey({
        storeName: 'urlAccountTokenList',
        ownerKey: 'hd-1--0__evm--1',
      }),
    ).not.toBe(evm);
  });
});
