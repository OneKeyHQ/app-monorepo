/**
 * TokenList cells — COLD START *persist* timing tests (regression for the
 * "cold start list empty for a long time" bug).
 *
 * ROOT CAUSE this guards against: the receive shell used to call
 * `persistSlimColdCache` SYNCHRONOUSLY inside `applyStructure`. But
 * `applyStructureSnapshot` only registers META cells — the FIAT cells are
 * created/filled by `applyValuationFrame`, which runs AFTER. So the persisted
 * slim bundle froze with `compactFiat: {}` (rows + names but ZERO prices), and
 * a cold start painted a value-less list that the hideZero/holdings filters
 * then dropped to the empty placeholder until the network round arrived.
 *
 * The fix replaces the synchronous persist with a DEBOUNCED
 * `schedulePersistSlimColdCache` called from BOTH structure and valuation
 * applies, so the persist runs after the fiat cells are populated and captures
 * a complete bundle (non-empty compactFiat + the real nonZeroIds/fundedIds).
 *
 * Run with node + a real jotai `createStore()` (no React), mirroring the
 * established coldStart.test.ts / cutover.test.ts harness. The kit-bg storage
 * sink + the lifecycle flush trigger are mocked so we observe exactly what the
 * debounced persist would write.
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
import type { ITokenListSlimColdCache } from '@onekeyhq/shared/src/utils/tokenListSlimColdCacheUtils';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { listStructureAtom } from '../atoms';
import {
  applyStructureSnapshot,
  applyValuationFrame,
  buildApplyDeps,
  shallowEqualArray,
} from '../cells/apply';
import {
  PERSIST_DEBOUNCE_MS,
  schedulePersistSlimColdCache,
} from '../cells/coldStart';
import {
  aggCell,
  cell,
  clearAll,
  ensureStoreProjection,
  meta,
  subcell,
} from '../cells/projection';

import type { IApplyDeps } from '../cells/apply';
import type { IStoreProjection } from '../cells/projection';

// Capture the slim bundle the debounced persist writes, without touching real
// MMKV / IDB. Spread the REAL module (it also exports globalAtom etc. that the
// kit-bg atoms barrel needs) and override ONLY the storage sink.
const mockWriteColdStartSnapshotKey = jest.fn();
jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils', () => {
  const actual = jest.requireActual(
    '@onekeyhq/kit-bg/src/states/jotai/utils',
  ) as Record<string, unknown>;
  return {
    ...actual,
    writeColdStartSnapshotKey: (args: unknown): void => {
      mockWriteColdStartSnapshotKey(args);
    },
  };
});

// The flush trigger attaches DOM/AppState listeners — stub it out in node.
jest.mock('@onekeyhq/shared/src/storage/coldStartFlushTrigger', () => ({
  __esModule: true,
  registerColdStartFlushTrigger: () => () => undefined,
}));

type IStore = ReturnType<typeof createStore>;

const STORE_DATA = {
  storeName: EJotaiContextStoreNames.homeTokenList,
} as IJotaiContextStoreData;

const OWNER_KEY = 'acc1__net1';
const SCOPE_KEY = 'store:homeTokenList';

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

function makeDeps(store: IStore): IApplyDeps {
  const asCtx = store as unknown as Parameters<typeof cell>[0];
  return buildApplyDeps({
    store: asCtx,
    listStructureAtom: listStructureAtom(),
    resolveCurrentStore: (data) =>
      (data.storeName === STORE_DATA.storeName
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
}

function setup(): {
  ctx: Parameters<typeof cell>[0];
  projection: IStoreProjection;
  deps: IApplyDeps;
} {
  const store = createStore();
  (
    store as unknown as { __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string }
  ).__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__ = SCOPE_KEY;
  const ctx = store as unknown as Parameters<typeof cell>[0];
  const projection = ensureStoreProjection(ctx);
  const deps = makeDeps(store);
  return { ctx, projection, deps };
}

// Two normal ordered tokens; `a` is funded (balance>0), `b` is a kept default
// zero-balance token, so nonZeroIds ⊃ fundedIds and the cold paint must restore
// both correctly for hideZero/holdings to behave at T0.
function makeStructureFrame(): IStructureSnapshot {
  return {
    orderedIds: ['a', 'b'],
    smallBalanceIds: [],
    nonZeroIds: ['a', 'b'],
    fundedIds: ['a'],
    metaPatch: {
      a: makeToken({ symbol: 'A' }),
      b: makeToken({ symbol: 'B' }),
    },
    aggMembership: {},
    smallBalanceFiatValue: '0',
    ownedAggregateTokenListMap: {},
    storeData: STORE_DATA,
    ownerKey: OWNER_KEY,
    generation: 1,
  };
}

function makeValuationFrame(): IValuationFrame {
  return {
    changedFiatById: {
      a: makeFiat({
        balance: '100',
        fiatValue: '200',
        price: 2,
        currency: 'usd',
      }),
      b: makeFiat({ balance: '0', fiatValue: '0', price: 1, currency: 'usd' }),
    },
    changedAggFiat: {},
    storeData: STORE_DATA,
    ownerKey: OWNER_KEY,
  };
}

function lastWrittenSlim(): ITokenListSlimColdCache {
  expect(mockWriteColdStartSnapshotKey).toHaveBeenCalled();
  const call = mockWriteColdStartSnapshotKey.mock.calls[
    mockWriteColdStartSnapshotKey.mock.calls.length - 1
  ][0] as { scopedKey: string; value: ITokenListSlimColdCache };
  return call.value;
}

describe('schedulePersistSlimColdCache — persist timing captures fiat', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockWriteColdStartSnapshotKey.mockClear();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('does NOT persist synchronously — it waits for the debounce window', () => {
    const { ctx, projection, deps } = setup();
    applyStructureSnapshot(ctx, projection, makeStructureFrame(), deps);
    schedulePersistSlimColdCache({
      store: ctx,
      projection,
      getCurrency: () => 'usd',
    });
    expect(mockWriteColdStartSnapshotKey).not.toHaveBeenCalled();
  });

  it('persists a NON-EMPTY compactFiat once the valuation has filled the cells (regression: was compactFiat:{})', () => {
    const { ctx, projection, deps } = setup();

    // 1. structure applies first — registers META cells only, NO fiat cells.
    applyStructureSnapshot(ctx, projection, makeStructureFrame(), deps);
    schedulePersistSlimColdCache({
      store: ctx,
      projection,
      getCurrency: () => 'usd',
    });

    // 1b. leaves render — `useTokenFiat($key)` lazily creates the fiat cell
    // (applyValuationFrame is orphan-guarded and only writes EXISTING cells).
    deps.cell(ctx, 'a');
    deps.cell(ctx, 'b');

    // 2. valuation applies — fills the now-existing fiat cells.
    applyValuationFrame(ctx, projection, makeValuationFrame(), deps, (fn) =>
      fn(),
    );
    schedulePersistSlimColdCache({
      store: ctx,
      projection,
      getCurrency: () => 'usd',
    });

    // 3. fire the debounce: the two schedules coalesce into ONE write.
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS);

    expect(mockWriteColdStartSnapshotKey).toHaveBeenCalledTimes(1);
    const slim = lastWrittenSlim();
    expect(slim.orderedIds).toEqual(['a', 'b']);
    // The crux: fiat is present (would be {} under the old persist-in-structure).
    expect(Object.keys(slim.compactFiat).length).toBeGreaterThan(0);
    expect(slim.compactFiat.a?.fiatValue).toBe('200');
    expect(slim.currency).toBe('usd');
  });

  it('persists nonZeroIds + fundedIds so a hideZero cold start is not filtered to empty', () => {
    const { ctx, projection, deps } = setup();
    applyStructureSnapshot(ctx, projection, makeStructureFrame(), deps);
    applyValuationFrame(ctx, projection, makeValuationFrame(), deps, (fn) =>
      fn(),
    );
    schedulePersistSlimColdCache({
      store: ctx,
      projection,
      getCurrency: () => 'usd',
    });
    jest.advanceTimersByTime(PERSIST_DEBOUNCE_MS);

    const slim = lastWrittenSlim();
    expect(slim.nonZeroIds).toEqual(['a', 'b']);
    expect(slim.fundedIds).toEqual(['a']);
  });
});
