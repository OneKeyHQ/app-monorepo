/**
 * TokenList cells — Phase-2 BG ServiceTokenViewModel tests (design §5 step 2).
 *
 * BG node tests, no React/jotai/native. They assert the service:
 *   - builds + PUSHES a structure frame on the first ingest and on a structural
 *     change, and a valuation-only frame on a pure price tick (structure
 *     undefined on the wire);
 *   - keeps structureVersion / valuationVersion monotonic;
 *   - serves a coherent full frame via the `getTokenListFrames` PULL backstop;
 *   - emits over the two NEW event names; and
 *   - is SYNCHRONOUS (no pending promises in the ingest → emit path).
 *
 * `appEventBus.emit` is mocked to capture payloads.
 */
import type { IAllNetworkSnapshotRound } from '@onekeyhq/shared/src/utils/buildMergedAllNetworkSnapshot';
import type {
  IAccountToken,
  IHomeTokenRequest,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { settingsPersistAtom } from '../states/jotai/atoms';

import ServiceTokenViewModel, { OWNER_VM_CAP } from './ServiceTokenViewModel';

import type { IIngestRoundParams } from './ServiceTokenViewModel';
import type { IJotaiContextStoreData } from '../states/jotai/atoms/jotaiContextStoreMap';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '../states/jotai/contexts/tokenList/cellsPure/types';

interface IStructureFramePayload {
  ownerKey: string;
  slotId?: string;
  baseVersion?: number;
  isDelta?: boolean;
  structureVersion: number;
  structure: IStructureSnapshot;
}
interface IValuationFramePayload {
  ownerKey: string;
  slotId?: string;
  baseVersion?: number;
  isDelta?: boolean;
  valuationVersion: number;
  valuation: IValuationFrame;
}
interface IRiskyFramePayload {
  ownerKey: string;
  riskyVersion: number;
  riskyTokens: IAccountToken[];
  riskyMap: Record<string, ITokenFiat>;
  storeData: IJotaiContextStoreData;
}

// --- mocks ----------------------------------------------------------------
// Strip the background decorators (they otherwise pull in the whole bg infra).
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod: () => (_t: unknown, _k: string, desc: unknown) => desc,
  backgroundMethodForDev: () => (_t: unknown, _k: string, desc: unknown) =>
    desc,
  checkDevOnlyPassword: jest.fn(),
}));

// Prefixed with `mock` so jest allows referencing it inside the hoisted
// `jest.mock` factory.
const mockEmit = jest.fn<void, [string, unknown]>();
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    TokenListStructureFrame: 'TokenListStructureFrame',
    TokenListValuationFrame: 'TokenListValuationFrame',
    TokenListRiskyFrame: 'TokenListRiskyFrame',
  },
  appEventBus: {
    emit: (name: string, payload: unknown): void => {
      mockEmit(name, payload);
    },
    on: jest.fn(),
    off: jest.fn(),
  },
}));

// Stub ServiceBase so the subclass instantiates in node without pulling the
// endpoints / jotai-storage module graph the real base reaches into.
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

// Use the raw `homeTokenList` value (the enum's own value) rather than
// importing the enum: the enum lives in `jotaiContextStoreMap`, which pulls the
// jotai/storage module graph at load time and would need a WebStorage mock in
// this node test. The frames route `storeData` through opaquely (identity-check
// only), so the literal is sufficient.
const STORE_DATA = {
  storeName: 'homeTokenList',
} as unknown as IJotaiContextStoreData;

function makeFiat(overrides: Partial<ITokenFiat> = {}): ITokenFiat {
  return {
    balance: '0',
    balanceParsed: '0',
    fiatValue: '0',
    price: 0,
    ...overrides,
  };
}

function makeToken(
  key: string,
  overrides: Partial<IAccountToken> = {},
): IAccountToken {
  return {
    $key: key,
    name: 'Token',
    symbol: 'TKN',
    decimals: 18,
    address: `0x${key}`,
    isNative: false,
    ...overrides,
  };
}

function makeService(): ServiceTokenViewModel {
  return new ServiceTokenViewModel({ backgroundApi: {} });
}

function makeRound(
  overrides: Partial<IIngestRoundParams> = {},
): IIngestRoundParams {
  return {
    ownerKey: 'acc1__net1',
    orderedTokens: [],
    smallBalanceTokens: [],
    tokenListMap: {},
    aggregateTokensMap: {},
    smallBalanceFiatValue: '0',
    storeData: STORE_DATA,
    ...overrides,
  };
}

function structureEmits(): IStructureFramePayload[] {
  return mockEmit.mock.calls
    .filter((c) => c[0] === 'TokenListStructureFrame')
    .map((c) => c[1] as IStructureFramePayload);
}
function valuationEmits(): IValuationFramePayload[] {
  return mockEmit.mock.calls
    .filter((c) => c[0] === 'TokenListValuationFrame')
    .map((c) => c[1] as IValuationFramePayload);
}
function riskyEmits(): IRiskyFramePayload[] {
  return mockEmit.mock.calls
    .filter((c) => c[0] === 'TokenListRiskyFrame')
    .map((c) => c[1] as IRiskyFramePayload);
}

describe('Home token round references', () => {
  const request = (generation: number, ownerKey = 'owner') => ({
    mainRuntimeId: 'fixture-main',
    generation,
    ownerKey,
  });
  const round = (
    key: string,
    networkId = 'evm--1',
  ): IAllNetworkSnapshotRound => ({
    accountId: 'account',
    networkId,
    mergeDeriveAssets: false,
    tokens: {
      data: [makeToken(key)],
      keys: key,
      map: { [key]: makeFiat({ balance: '1', fiatValue: '10' }) },
    },
    smallBalanceTokens: { data: [], keys: '', map: {} },
    riskTokens: { data: [], keys: '', map: {} },
  });
  const inputs = (homeRequest = request(1), homePublication = 1) => ({
    homeRequest,
    homePublication,
    ownerKey: homeRequest.ownerKey,
    accountId: 'account',
    networkId: 'onekeyall--0',
    storeData: STORE_DATA,
  });

  it('keeps exact old cache/live versions for a same-owner successor without aliasing a new response', async () => {
    const svc = makeService();
    const original = round('old');
    Object.freeze(original.tokens.data[0]);
    Object.freeze(original.tokens.map.old);
    Object.freeze(original.tokens.map);
    Object.freeze(original.tokens.data);
    const old = svc.retainHomeTokenRound({
      homeRequest: request(1),
      round: original,
      origin: 'live',
    });
    const cache = svc.retainHomeTokenRound({
      homeRequest: request(1),
      round: round('cache', 'evm--56'),
      origin: 'cache',
    });
    svc.retainHomeTokenRound({
      homeRequest: request(2),
      round: round('new'),
      origin: 'live',
    });
    await expect(
      svc.ingestHomeTokenRounds({
        ...inputs(request(2)),
        roundRefs: [old, cache],
      }),
    ).resolves.toBe(true);
    const raw = await svc.getRawTokenList({ ownerKey: 'owner' });
    expect(raw.tokens.map((token) => token.$key)).toEqual(['old', 'cache']);
    expect(original.tokens.map.old.fiatValue).toBe('10');
  });

  it('releases the previous owner and exact retirement while preserving a newer owner against old cleanup', async () => {
    const svc = makeService();
    const old = svc.retainHomeTokenRound({
      homeRequest: request(1),
      round: round('old'),
      origin: 'live',
    });
    const current = request(2, 'new-owner');
    const next = svc.retainHomeTokenRound({
      homeRequest: current,
      round: round('new'),
      origin: 'live',
    });
    await expect(
      svc.ingestHomeTokenRounds({ ...inputs(current), roundRefs: [old] }),
    ).resolves.toBe(false);
    svc.retireHomeTokenRounds(request(1));
    await expect(
      svc.ingestHomeTokenRounds({ ...inputs(current, 2), roundRefs: [next] }),
    ).resolves.toBe(true);
    svc.retireHomeTokenRounds(current);
    await expect(
      svc.ingestHomeTokenRounds({ ...inputs(current, 3), roundRefs: [next] }),
    ).resolves.toBe(false);
  });

  it('bounds each source to two versions and the active-owner directory to 128 references', async () => {
    const svc = makeService();
    const first = svc.retainHomeTokenRound({
      homeRequest: request(1),
      round: round('v1'),
      origin: 'live',
    });
    const second = svc.retainHomeTokenRound({
      homeRequest: request(1),
      round: round('v2'),
      origin: 'live',
    });
    svc.retainHomeTokenRound({
      homeRequest: request(1),
      round: round('v3'),
      origin: 'live',
    });
    await expect(
      svc.ingestHomeTokenRounds({ ...inputs(), roundRefs: [first] }),
    ).resolves.toBe(false);
    await expect(
      svc.ingestHomeTokenRounds({
        ...inputs(request(1), 2),
        roundRefs: [second],
      }),
    ).resolves.toBe(true);
    let last = '';
    for (let index = 0; index < 129; index += 1) {
      last = svc.retainHomeTokenRound({
        homeRequest: request(1),
        round: round(`v${index}`, `network-${index}`),
        origin: 'cache',
      });
    }
    await expect(
      svc.ingestHomeTokenRounds({
        ...inputs(request(1), 3),
        roundRefs: [second],
      }),
    ).resolves.toBe(false);
    await expect(
      svc.ingestHomeTokenRounds({
        ...inputs(request(1), 4),
        roundRefs: [last],
      }),
    ).resolves.toBe(true);
  });

  it('releases a previous runtime on accepted claim even when no new result is retained', async () => {
    const svc = makeService();
    const old = svc.retainHomeTokenRound({
      homeRequest: request(1),
      round: round('old'),
      origin: 'live',
    });
    const restarted = { ...request(1), mainRuntimeId: 'restarted-main' };
    await expect(
      svc.ingestHomeTokenRounds({ ...inputs(restarted), roundRefs: [old] }),
    ).resolves.toBe(false);
    svc.alignHomeTokenRequest(restarted);
    await expect(
      svc.ingestHomeTokenRounds({ ...inputs(request(1), 2), roundRefs: [old] }),
    ).resolves.toBe(false);
  });

  it('never lets an older full fallback or reference publication replace a newer authoritative snapshot', async () => {
    const svc = makeService();
    const ref = svc.retainHomeTokenRound({
      homeRequest: request(1),
      round: round('current'),
      origin: 'live',
    });
    await expect(
      svc.ingestHomeTokenRounds({ ...inputs(), roundRefs: ['missing'] }),
    ).resolves.toBe(false);
    await svc.ingestHomeTokenRounds({
      ...inputs(request(1), 2),
      roundRefs: [ref],
      source: 'authoritative',
    });
    await svc.ingestRound(
      makeRound({ ...inputs(), orderedTokens: [makeToken('stale')] }),
    );
    await svc.ingestHomeTokenRounds({ ...inputs(), roundRefs: ['missing'] });
    expect(
      (await svc.getRawTokenList({ ownerKey: 'owner' })).tokens.map(
        (token) => token.$key,
      ),
    ).toEqual(['current']);
  });

  it('publishes a referenced legitimate empty round and rejects incomplete reference sets without partial frames', async () => {
    const svc = makeService();
    const empty = round('unused');
    empty.tokens = { data: [], keys: '', map: {} };
    const ref = svc.retainHomeTokenRound({
      homeRequest: request(1),
      round: empty,
      origin: 'live',
    });
    mockEmit.mockClear();
    await expect(
      svc.ingestHomeTokenRounds({ ...inputs(), roundRefs: [ref, 'missing'] }),
    ).resolves.toBe(false);
    expect(mockEmit).not.toHaveBeenCalled();
    await expect(
      svc.ingestHomeTokenRounds({ ...inputs(request(1), 2), roundRefs: [ref] }),
    ).resolves.toBe(true);
    expect((await svc.getRawTokenList({ ownerKey: 'owner' })).tokens).toEqual(
      [],
    );
  });
});

describe('ServiceTokenViewModel', () => {
  beforeEach(() => {
    mockEmit.mockClear();
  });

  it('emits a structure + valuation frame on the first ingest of a multi-token + aggregate owner', () => {
    const svc = makeService();
    void svc.ingestRound(
      makeRound({
        orderedTokens: [
          makeToken('a'),
          makeToken('b'),
          makeToken('aggregate_eth', { isAggregateToken: true }),
        ],
        smallBalanceTokens: [makeToken('c')],
        tokenListMap: {
          a: makeFiat({ balance: '10', fiatValue: '100' }),
          b: makeFiat({ balance: '5', fiatValue: '50' }),
          c: makeFiat({ balance: '0', fiatValue: '0' }),
        },
        aggregateTokensMap: {
          aggregate_eth: {
            'evm--1': makeFiat({ balance: '1', fiatValue: '3000' }),
            'evm--10': makeFiat({ balance: '2', fiatValue: '6000' }),
          },
        },
        smallBalanceFiatValue: '0',
      }),
    );

    expect(structureEmits()).toHaveLength(1);
    expect(valuationEmits()).toHaveLength(1);

    // both events fired (asserted via lengths above); verify the two event
    // names were used.
    expect(mockEmit.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining([
        'TokenListStructureFrame',
        'TokenListValuationFrame',
      ]),
    );
    const structPayload = structureEmits()[0];
    expect(structPayload.ownerKey).toBe('acc1__net1');
    expect(structPayload.structureVersion).toBe(0);
    expect(structPayload.structure.orderedIds).toEqual([
      'a',
      'b',
      'aggregate_eth',
    ]);
    expect(structPayload.structure.smallBalanceIds).toEqual(['c']);
    expect(structPayload.structure.aggMembership.aggregate_eth).toEqual([
      'evm--1',
      'evm--10',
    ]);

    const valPayload = valuationEmits()[0];
    expect(valPayload.valuationVersion).toBe(0);
    expect(valPayload.valuation.changedFiatById.a.fiatValue).toBe('100');
    // aggregate fiat flows only through the dedicated agg channel
    expect(valPayload.valuation.changedFiatById.aggregate_eth).toBeUndefined();
    expect(
      valPayload.valuation.changedAggFiat.aggregate_eth['evm--1'].fiatValue,
    ).toBe('3000');
  });

  it('emits valuation-only (structure undefined on the wire) on a pure price tick', () => {
    const svc = makeService();
    const round1 = makeRound({
      orderedTokens: [makeToken('a'), makeToken('b')],
      tokenListMap: {
        a: makeFiat({ balance: '10', fiatValue: '100', price: 10 }),
        b: makeFiat({ balance: '1', fiatValue: '10', price: 10 }),
      },
    });
    void svc.ingestRound(round1);
    mockEmit.mockClear();

    // same ids / membership / metas / scalar — only fiat values move
    void svc.ingestRound(
      makeRound({
        orderedTokens: [makeToken('a'), makeToken('b')],
        tokenListMap: {
          a: makeFiat({ balance: '10', fiatValue: '120', price: 12 }),
          b: makeFiat({ balance: '1', fiatValue: '11', price: 11 }),
        },
      }),
    );

    expect(structureEmits()).toHaveLength(0);
    expect(valuationEmits()).toHaveLength(1);
    const valPayload = valuationEmits()[0];
    expect(valPayload.valuation.changedFiatById.a.fiatValue).toBe('120');
    // valuation version advanced even with no structure frame
    expect(valPayload.valuationVersion).toBe(1);
  });

  it('emits a new structure frame on a structural change with monotonic versions', () => {
    const svc = makeService();
    void svc.ingestRound(makeRound({ orderedTokens: [makeToken('a')] }));
    mockEmit.mockClear();

    void svc.ingestRound(
      makeRound({ orderedTokens: [makeToken('a'), makeToken('b')] }),
    );

    expect(structureEmits()).toHaveLength(1);
    const structPayload = structureEmits()[0];
    expect(structPayload.structure.orderedIds).toEqual(['a', 'b']);
    expect(structPayload.structureVersion).toBe(1); // monotonic
    const valPayload = valuationEmits()[0];
    expect(valPayload.valuationVersion).toBe(1); // monotonic
  });

  it('getTokenListFrames returns a coherent full frame and is empty for unknown owners', async () => {
    const svc = makeService();
    void svc.ingestRound(
      makeRound({
        ownerKey: 'accX__netX',
        orderedTokens: [makeToken('a')],
        tokenListMap: { a: makeFiat({ balance: '3', fiatValue: '30' }) },
      }),
    );

    const pulled = await svc.getTokenListFrames({ ownerKey: 'accX__netX' });
    expect(pulled.ownerKey).toBe('accX__netX');
    expect(pulled.structureVersion).toBe(0);
    expect(pulled.valuationVersion).toBe(0);
    expect(pulled.structure?.orderedIds).toEqual(['a']);
    expect(pulled.valuation?.changedFiatById.a.fiatValue).toBe('30');

    const unknown = await svc.getTokenListFrames({ ownerKey: 'nope' });
    expect(unknown.structure).toBeUndefined();
    expect(unknown.valuation).toBeUndefined();
    expect(unknown.structureVersion).toBe(-1);
    expect(unknown.valuationVersion).toBe(-1);
  });

  it('omits unchanged structure/valuation/risky payloads on conditional getTokenListFrames pull and returns full frames after eviction', async () => {
    const svc = makeService();
    void svc.ingestRound(
      makeRound({
        ownerKey: 'acc0__net',
        orderedTokens: [makeToken('a')],
        tokenListMap: { a: makeFiat({ balance: '3', fiatValue: '30' }) },
        riskyTokens: [makeToken('risk1')],
        riskyMap: { risk1: makeFiat({ balance: '1', fiatValue: '5' }) },
      }),
    );

    const initial = await svc.getTokenListFrames({ ownerKey: 'acc0__net' });
    expect(initial.slotId).toBeDefined();
    expect(initial.structure?.orderedIds).toEqual(['a']);
    expect(initial.valuation?.changedFiatById.a.fiatValue).toBe('30');
    expect(initial.riskyTokens.map((t) => t.$key)).toEqual(['risk1']);

    // Conditional pull with matching slotId and versions omits all three frame payloads.
    const unchanged = await svc.getTokenListFrames({
      ownerKey: 'acc0__net',
      knownVersions: {
        slotId: initial.slotId,
        structureVersion: initial.structureVersion,
        structureGeneration: initial.structure?.generation,
        valuationVersion: initial.valuationVersion,
        riskyVersion: initial.riskyVersion,
      },
    });
    expect(unchanged.structureUnchanged).toBe(true);
    expect(unchanged.structure).toBeUndefined();
    expect(unchanged.valuationUnchanged).toBe(true);
    expect(unchanged.valuation).toBeUndefined();
    expect(unchanged.riskyUnchanged).toBe(true);
    expect(unchanged.riskyTokens).toEqual([]);
    expect(unchanged.riskyMap).toEqual({});

    // Pure price tick advances valuationVersion only; conditional pull returns only valuation.
    void svc.ingestRound(
      makeRound({
        ownerKey: 'acc0__net',
        orderedTokens: [makeToken('a')],
        tokenListMap: { a: makeFiat({ balance: '3', fiatValue: '36' }) },
        riskyTokens: [makeToken('risk1')],
        riskyMap: { risk1: makeFiat({ balance: '1', fiatValue: '5' }) },
      }),
    );
    const valuationOnly = await svc.getTokenListFrames({
      ownerKey: 'acc0__net',
      knownVersions: {
        slotId: initial.slotId,
        structureVersion: initial.structureVersion,
        structureGeneration: initial.structure?.generation,
        valuationVersion: initial.valuationVersion,
        riskyVersion: initial.riskyVersion,
      },
    });
    expect(valuationOnly.structureUnchanged).toBe(true);
    expect(valuationOnly.structure).toBeUndefined();
    expect(valuationOnly.valuationUnchanged).toBeUndefined();
    expect(valuationOnly.valuation?.changedFiatById.a.fiatValue).toBe('36');
    expect(valuationOnly.riskyUnchanged).toBe(true);

    // Evict acc0__net and recreate it at version 0; old slotId must NOT match.
    for (let i = 1; i <= OWNER_VM_CAP; i += 1) {
      void svc.ingestRound(
        makeRound({
          ownerKey: `acc${i}__net`,
          orderedTokens: [makeToken('x')],
          tokenListMap: { x: makeFiat({ fiatValue: '1' }) },
        }),
      );
    }
    void svc.ingestRound(
      makeRound({
        ownerKey: 'acc0__net',
        orderedTokens: [makeToken('b')],
        tokenListMap: { b: makeFiat({ balance: '9', fiatValue: '90' }) },
      }),
    );
    const recreated = await svc.getTokenListFrames({
      ownerKey: 'acc0__net',
      knownVersions: {
        slotId: initial.slotId,
        structureVersion: 0,
        structureGeneration: 0,
        valuationVersion: 0,
      },
    });
    expect(recreated.slotId).not.toBe(initial.slotId);
    expect(recreated.structureUnchanged).toBeUndefined();
    expect(recreated.structure?.orderedIds).toEqual(['b']);
    expect(recreated.valuation?.changedFiatById.b.fiatValue).toBe('90');
  });

  it('pushes full frames on v0 and base-versioned delta patches on v1+ while retaining full snapshots in BG for PULLs', async () => {
    const svc = makeService();
    // Round 1 (v0): full snapshot
    void svc.ingestRound(
      makeRound({
        ownerKey: 'accDelta__net',
        orderedTokens: [makeToken('a'), makeToken('b')],
        tokenListMap: {
          a: makeFiat({ balance: '10', fiatValue: '100', price: 10 }),
          b: makeFiat({ balance: '5', fiatValue: '50', price: 10 }),
        },
      }),
    );
    expect(structureEmits()[0].isDelta).toBeUndefined();
    expect(Object.keys(structureEmits()[0].structure.metaPatch)).toEqual([
      'a',
      'b',
    ]);
    expect(valuationEmits()[0].isDelta).toBeUndefined();
    expect(Object.keys(valuationEmits()[0].valuation.changedFiatById)).toEqual([
      'a',
      'b',
    ]);
    mockEmit.mockClear();

    // Round 2 (v1): only `a` balance changes (10 -> 8, fiat 100 -> 80), `b` is unchanged
    void svc.ingestRound(
      makeRound({
        ownerKey: 'accDelta__net',
        orderedTokens: [makeToken('a'), makeToken('b')],
        tokenListMap: {
          a: makeFiat({ balance: '8', fiatValue: '80', price: 10 }),
          b: makeFiat({ balance: '5', fiatValue: '50', price: 10 }),
        },
      }),
    );
    const structDelta = structureEmits()[0];
    expect(structDelta.isDelta).toBe(true);
    expect(structDelta.baseVersion).toBe(0);
    expect(structDelta.structureVersion).toBe(1);
    // Neither `a` nor `b` changed metadata, so delta metaPatch is empty!
    expect(structDelta.structure.metaPatch).toEqual({});

    const valDelta = valuationEmits()[0];
    expect(valDelta.isDelta).toBe(true);
    expect(valDelta.baseVersion).toBe(0);
    expect(valDelta.valuationVersion).toBe(1);
    // Only `a` fiat changed; `b` is omitted from the wire delta!
    expect(Object.keys(valDelta.valuation.changedFiatById)).toEqual(['a']);
    expect(valDelta.valuation.changedFiatById.a.fiatValue).toBe('80');

    // Meanwhile BG's stored PULL snapshot still holds both `a` and `b` in full!
    const pulled = await svc.getTokenListFrames({ ownerKey: 'accDelta__net' });
    expect(Object.keys(pulled.structure?.metaPatch ?? {})).toEqual(['a', 'b']);
    expect(pulled.valuation?.changedFiatById.a.fiatValue).toBe('80');
    expect(pulled.valuation?.changedFiatById.b.fiatValue).toBe('50');

    // Round 3 (v2): `b` remains listed in `orderedTokens`, but its fiat entry is omitted from `tokenListMap`
    mockEmit.mockClear();
    void svc.ingestRound(
      makeRound({
        ownerKey: 'accDelta__net',
        orderedTokens: [makeToken('a'), makeToken('b')],
        tokenListMap: {
          a: makeFiat({ balance: '8', fiatValue: '80', price: 10 }),
        },
      }),
    );
    const valDeltaRemoved = valuationEmits()[0];
    expect(valDeltaRemoved.isDelta).toBe(true);
    expect(valDeltaRemoved.valuation.removedFiatIds).toEqual(['b']);
  });

  it('REPLACES (does not concat) the owner slices each round — a shorter list shrinks orderedIds', () => {
    const svc = makeService();
    // round 1: a, b, c
    void svc.ingestRound(
      makeRound({
        orderedTokens: [makeToken('a'), makeToken('b'), makeToken('c')],
        tokenListMap: {
          a: makeFiat({ fiatValue: '3' }),
          b: makeFiat({ fiatValue: '2' }),
          c: makeFiat({ fiatValue: '1' }),
        },
      }),
    );
    // round 2: only a (b, c gone). A concat would keep b/c; a replace drops them.
    void svc.ingestRound(
      makeRound({
        orderedTokens: [makeToken('a')],
        tokenListMap: { a: makeFiat({ fiatValue: '3' }) },
      }),
    );
    const last = structureEmits().pop();
    expect(last?.structure.orderedIds).toEqual(['a']);
  });

  it('evicts the LRU owner past the cap while keeping the MRU owners + re-ingest re-creates an evicted owner', async () => {
    const svc = makeService();
    // Ingest cap + 1 distinct owners, so the FIRST (owner0) is evicted.
    for (let i = 0; i < OWNER_VM_CAP + 1; i += 1) {
      void svc.ingestRound(
        makeRound({
          ownerKey: `acc${i}__net`,
          orderedTokens: [makeToken('a')],
          tokenListMap: { a: makeFiat({ fiatValue: '1' }) },
        }),
      );
    }
    // owner0 was evicted: PULL is the empty (-1) result.
    const evicted = await svc.getTokenListFrames({ ownerKey: 'acc0__net' });
    expect(evicted.structureVersion).toBe(-1);
    expect(evicted.structure).toBeUndefined();
    // The MRU owner (the last one ingested) is retained.
    const retained = await svc.getTokenListFrames({
      ownerKey: `acc${OWNER_VM_CAP}__net`,
    });
    expect(retained.structureVersion).toBe(0);
    expect(retained.structure?.orderedIds).toEqual(['a']);

    // Re-ingesting the evicted owner re-creates its VM (fresh generation 0).
    void svc.ingestRound(
      makeRound({
        ownerKey: 'acc0__net',
        orderedTokens: [makeToken('a')],
        tokenListMap: { a: makeFiat({ fiatValue: '1' }) },
      }),
    );
    const recreated = await svc.getTokenListFrames({ ownerKey: 'acc0__net' });
    expect(recreated.structureVersion).toBe(0);
    expect(recreated.structure?.orderedIds).toEqual(['a']);
  });

  it('touching an owner refreshes its MRU position so it survives a later eviction wave', async () => {
    const svc = makeService();
    // Seed owners 0..cap-1 (fills the cap exactly).
    for (let i = 0; i < OWNER_VM_CAP; i += 1) {
      void svc.ingestRound(
        makeRound({
          ownerKey: `acc${i}__net`,
          orderedTokens: [makeToken('a')],
        }),
      );
    }
    // Re-touch owner0 -> it becomes MRU (moves to the Map tail).
    void svc.ingestRound(
      makeRound({ ownerKey: 'acc0__net', orderedTokens: [makeToken('a')] }),
    );
    // Ingest a NEW owner. The LRU is now owner1 (owner0 was refreshed).
    void svc.ingestRound(
      makeRound({
        ownerKey: `acc${OWNER_VM_CAP}__net`,
        orderedTokens: [makeToken('a')],
      }),
    );
    // owner0 survived (it was refreshed); owner1 was evicted.
    const survived = await svc.getTokenListFrames({ ownerKey: 'acc0__net' });
    expect(survived.structure?.orderedIds).toEqual(['a']);
    const evicted = await svc.getTokenListFrames({ ownerKey: 'acc1__net' });
    expect(evicted.structureVersion).toBe(-1);
  });

  it('frame production body is fully synchronous (emits before any microtask)', () => {
    const svc = makeService();
    // ingestRound is an @backgroundMethod (UI feeds the BG VM across the runtime
    // boundary) so it returns a Promise, but its BODY is synchronous: the two
    // appEventBus emits fire SYNCHRONOUSLY (before any microtask), proving no
    // await/nextTick in the frame-production path.
    void svc.ingestRound(makeRound({ orderedTokens: [makeToken('a')] }));
    expect(mockEmit).toHaveBeenCalledTimes(2);
  });

  // --- §R0 #3 getRawTokenList ---------------------------------------------

  describe('getRawTokenList', () => {
    it('returns the merged-with-risky raw list + SETTLED owner identity', async () => {
      const svc = makeService();
      void svc.ingestRound(
        makeRound({
          ownerKey: 'accSettled__net',
          orderedTokens: [makeToken('a'), makeToken('b')],
          smallBalanceTokens: [makeToken('c')],
          tokenListMap: {
            a: makeFiat({ fiatValue: '3' }),
            b: makeFiat({ fiatValue: '2' }),
            c: makeFiat({ fiatValue: '0' }),
          },
          riskyTokens: [makeToken('risk1'), makeToken('risk2')],
          riskyMap: {
            risk1: makeFiat({ balance: '1', fiatValue: '5' }),
            risk2: makeFiat({ balance: '2', fiatValue: '6' }),
          },
          // The SETTLED owner identity LAGS the scoped current owner (C-F1): it
          // is the identity of the round that just settled, not the live owner.
          accountId: 'settledAccount',
          networkId: 'settledNetwork',
          rawKeys: 'keys_a_b_c_risk',
        }),
      );

      const raw = await svc.getRawTokenList({ ownerKey: 'accSettled__net' });
      // merged-with-risky = [...ordered, ...small, ...risky]
      expect(raw.tokens.map((t) => t.$key)).toEqual([
        'a',
        'b',
        'c',
        'risk1',
        'risk2',
      ]);
      expect(raw.keys).toBe('keys_a_b_c_risk');
      // SETTLED owner identity for the switch skeleton (C-F1).
      expect(raw.accountId).toBe('settledAccount');
      expect(raw.networkId).toBe('settledNetwork');
    });

    it('returns an empty list + undefined identity for an evicted / unknown owner', async () => {
      const svc = makeService();
      // Fill past the cap so owner0 is evicted.
      for (let i = 0; i < OWNER_VM_CAP + 1; i += 1) {
        void svc.ingestRound(
          makeRound({
            ownerKey: `acc${i}__net`,
            orderedTokens: [makeToken('a')],
            accountId: `account${i}`,
            networkId: 'net',
            rawKeys: `keys${i}`,
          }),
        );
      }
      const evicted = await svc.getRawTokenList({ ownerKey: 'acc0__net' });
      expect(evicted.tokens).toEqual([]);
      expect(evicted.keys).toBe('');
      expect(evicted.accountId).toBeUndefined();
      expect(evicted.networkId).toBeUndefined();

      const unknown = await svc.getRawTokenList({ ownerKey: 'nope' });
      expect(unknown.tokens).toEqual([]);
      expect(unknown.accountId).toBeUndefined();
    });

    it('REPLACES (does not concat) the raw list each round', async () => {
      const svc = makeService();
      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('a'), makeToken('b'), makeToken('c')],
          tokenListMap: {
            a: makeFiat({ fiatValue: '3' }),
            b: makeFiat({ fiatValue: '2' }),
            c: makeFiat({ fiatValue: '1' }),
          },
          riskyTokens: [makeToken('risk1')],
          riskyMap: { risk1: makeFiat({ balance: '1', fiatValue: '5' }) },
          rawKeys: 'round1',
        }),
      );
      // round 2: shorter list + no risky — a concat would keep b/c/risk1.
      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('a')],
          tokenListMap: { a: makeFiat({ fiatValue: '3' }) },
          riskyTokens: [],
          riskyMap: {},
          rawKeys: 'round2',
        }),
      );
      const raw = await svc.getRawTokenList({ ownerKey: 'acc1__net1' });
      expect(raw.tokens.map((t) => t.$key)).toEqual(['a']);
      expect(raw.keys).toBe('round2');
    });
  });

  // --- §R0 #4 getAllTokenListMap ------------------------------------------

  describe('getAllTokenListMap', () => {
    it('composes {...tokenListMap, ...riskyMap, ...flatten(agg)} and exposes the PER-NETWORK sub-token fiat (NOT just the summed agg)', async () => {
      const svc = makeService();
      // The aggregate sub-tokens live in `tokenListMap` under their per-network
      // `$key` (the home merge path) AND the aggregate `$key` lives in the nested
      // aggregateTokensMap. checkIsOnlyOneTokenHasBalance reads the per-network
      // sub-token `$key` (C-F2 / completeness-#9): assert that value is present + correct,
      // not just the summed aggregate.
      void svc.ingestRound(
        makeRound({
          orderedTokens: [
            makeToken('a'),
            makeToken('aggregate_eth', { isAggregateToken: true }),
          ],
          tokenListMap: {
            a: makeFiat({ balance: '10', fiatValue: '100' }),
            // per-network sub-token $keys (these are what the badge reads)
            'eth_sub_evm--1': makeFiat({ balance: '1', fiatValue: '3000' }),
            'eth_sub_evm--10': makeFiat({ balance: '0', fiatValue: '0' }),
          },
          aggregateTokensMap: {
            aggregate_eth: {
              'evm--1': makeFiat({ balance: '1', fiatValue: '3000' }),
              'evm--10': makeFiat({ balance: '0', fiatValue: '0' }),
            },
          },
          riskyTokens: [makeToken('risk1')],
          riskyMap: { risk1: makeFiat({ balance: '2', fiatValue: '7' }) },
        }),
      );

      const map = await svc.getAllTokenListMap({ ownerKey: 'acc1__net1' });
      // normal token fiat
      expect(map.a.fiatValue).toBe('100');
      // risky fiat present
      expect(map.risk1.fiatValue).toBe('7');
      // PER-NETWORK sub-token $key fiat == the per-network value (NOT the sum):
      // this is the C-F2 assertion that the F2-shape bug would fail.
      expect(map['eth_sub_evm--1'].fiatValue).toBe('3000');
      expect(map['eth_sub_evm--10'].fiatValue).toBe('0');
      // the flattened aggregate $key carries the SUMMED value (3000 + 0).
      expect(map.aggregate_eth.fiatValue).toBe('3000');
    });

    it('reflects the latest round after a price tick + is empty for an evicted owner', async () => {
      const svc = makeService();
      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('a')],
          tokenListMap: { a: makeFiat({ balance: '1', fiatValue: '100' }) },
        }),
      );
      // price tick: same id, only fiat moves (valuation-only frame).
      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('a')],
          tokenListMap: { a: makeFiat({ balance: '1', fiatValue: '120' }) },
        }),
      );
      const map = await svc.getAllTokenListMap({ ownerKey: 'acc1__net1' });
      expect(map.a.fiatValue).toBe('120');

      const empty = await svc.getAllTokenListMap({ ownerKey: 'nope' });
      expect(empty).toEqual({});
    });
  });

  // --- §R0 #2 risky frame --------------------------------------------------

  describe('risky frame', () => {
    it('emits a FULL risky snapshot on the first ingest with a risky set, with its own version + the two NEW event name', () => {
      const svc = makeService();
      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('a')],
          tokenListMap: { a: makeFiat({ fiatValue: '1' }) },
          riskyTokens: [makeToken('risk1'), makeToken('risk2')],
          riskyMap: {
            risk1: makeFiat({ balance: '1', fiatValue: '5' }),
            risk2: makeFiat({ balance: '2', fiatValue: '6' }),
          },
        }),
      );
      expect(riskyEmits()).toHaveLength(1);
      const payload = riskyEmits()[0];
      expect(payload.ownerKey).toBe('acc1__net1');
      // INDEPENDENT monotonic version, starts at 0 (NOT coupled to structure 0).
      expect(payload.riskyVersion).toBe(0);
      expect(payload.riskyTokens.map((t) => t.$key)).toEqual([
        'risk1',
        'risk2',
      ]);
      expect(payload.riskyMap.risk1.fiatValue).toBe('5');
      expect(mockEmit.mock.calls.map((c) => c[0])).toEqual(
        expect.arrayContaining(['TokenListRiskyFrame']),
      );
    });

    it('does NOT emit a risky frame when the owner has no risky tokens (stays at version -1)', async () => {
      const svc = makeService();
      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('a')],
          tokenListMap: { a: makeFiat({ fiatValue: '1' }) },
          riskyTokens: [],
          riskyMap: {},
        }),
      );
      expect(riskyEmits()).toHaveLength(0);
      const pulled = await svc.getTokenListFrames({ ownerKey: 'acc1__net1' });
      expect(pulled.riskyVersion).toBe(-1);
      expect(pulled.riskyTokens).toEqual([]);
    });

    it('re-emits on a MEMBERSHIP change (a risky token added)', () => {
      const svc = makeService();
      void svc.ingestRound(
        makeRound({
          riskyTokens: [makeToken('risk1')],
          riskyMap: { risk1: makeFiat({ balance: '1', fiatValue: '5' }) },
        }),
      );
      mockEmit.mockClear();
      void svc.ingestRound(
        makeRound({
          riskyTokens: [makeToken('risk1'), makeToken('risk2')],
          riskyMap: {
            risk1: makeFiat({ balance: '1', fiatValue: '5' }),
            risk2: makeFiat({ balance: '2', fiatValue: '6' }),
          },
        }),
      );
      expect(riskyEmits()).toHaveLength(1);
      expect(riskyEmits()[0].riskyVersion).toBe(1);
    });

    it('re-emits on a per-$key BALANCE change with UNCHANGED membership (C-F4)', () => {
      const svc = makeService();
      void svc.ingestRound(
        makeRound({
          riskyTokens: [makeToken('risk1')],
          riskyMap: { risk1: makeFiat({ balance: '1', fiatValue: '5' }) },
        }),
      );
      mockEmit.mockClear();
      // same $key membership, balance moved 1 -> 0 (footer hideZero would go
      // stale if the gate were membership-only).
      void svc.ingestRound(
        makeRound({
          riskyTokens: [makeToken('risk1')],
          riskyMap: { risk1: makeFiat({ balance: '0', fiatValue: '0' }) },
        }),
      );
      expect(riskyEmits()).toHaveLength(1);
      expect(riskyEmits()[0].riskyMap.risk1.balance).toBe('0');
    });

    it('does NOT re-emit on a pure price tick (same membership + same balance)', () => {
      const svc = makeService();
      void svc.ingestRound(
        makeRound({
          riskyTokens: [makeToken('risk1')],
          riskyMap: {
            risk1: makeFiat({ balance: '1', fiatValue: '5', price: 5 }),
          },
        }),
      );
      mockEmit.mockClear();
      // same balance, only price/fiatValue move -> no risky re-emit.
      void svc.ingestRound(
        makeRound({
          riskyTokens: [makeToken('risk1')],
          riskyMap: {
            risk1: makeFiat({ balance: '1', fiatValue: '7', price: 7 }),
          },
        }),
      );
      expect(riskyEmits()).toHaveLength(0);
    });

    it('keeps the risky version monotonic + INDEPENDENT of structure/valuation', async () => {
      const svc = makeService();
      // round 1: structure + risky both at 0.
      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('a')],
          tokenListMap: { a: makeFiat({ fiatValue: '1' }) },
          riskyTokens: [makeToken('risk1')],
          riskyMap: { risk1: makeFiat({ balance: '1', fiatValue: '5' }) },
        }),
      );
      // round 2: a structural change (token added) BUT the risky set is unchanged
      // -> structureVersion advances, riskyVersion does NOT.
      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('a'), makeToken('b')],
          tokenListMap: {
            a: makeFiat({ fiatValue: '1' }),
            b: makeFiat({ fiatValue: '2' }),
          },
          riskyTokens: [makeToken('risk1')],
          riskyMap: { risk1: makeFiat({ balance: '1', fiatValue: '5' }) },
        }),
      );
      const pulled = await svc.getTokenListFrames({ ownerKey: 'acc1__net1' });
      expect(pulled.structureVersion).toBe(1); // advanced
      expect(pulled.riskyVersion).toBe(0); // independent — did NOT advance
    });

    it('serves the risky snapshot through getTokenListFrames PULL + is empty for an evicted owner', async () => {
      const svc = makeService();
      void svc.ingestRound(
        makeRound({
          ownerKey: 'accR__net',
          riskyTokens: [makeToken('risk1')],
          riskyMap: { risk1: makeFiat({ balance: '1', fiatValue: '5' }) },
        }),
      );
      const pulled = await svc.getTokenListFrames({ ownerKey: 'accR__net' });
      expect(pulled.riskyVersion).toBe(0);
      expect(pulled.riskyTokens.map((t) => t.$key)).toEqual(['risk1']);
      expect(pulled.riskyMap.risk1.fiatValue).toBe('5');
      expect(pulled.storeData).toBeDefined();

      const unknown = await svc.getTokenListFrames({ ownerKey: 'nope' });
      expect(unknown.riskyVersion).toBe(-1);
      expect(unknown.riskyTokens).toEqual([]);
      expect(unknown.riskyMap).toEqual({});
      expect(unknown.storeData).toBeUndefined();
    });

    it('risky push is SYNCHRONOUS (emits before any microtask)', () => {
      const svc = makeService();
      // ingestRound returns a Promise (the @backgroundMethod RPC contract) but
      // its BODY is synchronous: the risky emit fires before any microtask,
      // proving no await/nextTick on the risky path (R-#1).
      void svc.ingestRound(
        makeRound({
          riskyTokens: [makeToken('risk1')],
          riskyMap: { risk1: makeFiat({ balance: '1', fiatValue: '5' }) },
        }),
      );
      // 1 structure (empty ordered still emits a first structure) + 1 valuation
      // + 1 risky, all SYNCHRONOUS.
      expect(riskyEmits()).toHaveLength(1);
    });
  });

  describe('prewarmHomeTokenListFrames', () => {
    // PR #13695 review: the selector prewarm reads the local cache for an
    // owner the background has no frames for. The home page's own rounds for
    // that owner can land during the read (it was just switched to, or is
    // still seeding after a cold start); the prewarm's provisional cache seed
    // must not replace them with the older cached list.
    it('keeps a round for the owner that lands while the local cache is read', async () => {
      jest
        .spyOn(settingsPersistAtom, 'get')
        .mockResolvedValue({ currencyInfo: { id: 'usd' } } as Awaited<
          ReturnType<typeof settingsPersistAtom.get>
        >);
      let resolveLocalTokens: (value: unknown) => void = () => {};
      const svc = new ServiceTokenViewModel({
        backgroundApi: {
          serviceToken: {
            getAccountLocalTokens: () =>
              new Promise((resolve) => {
                resolveLocalTokens = resolve;
              }),
            getHomeDefaultTokenMap: async () => ({}),
          },
          serviceCustomToken: { getCustomTokensBatch: async () => [] },
        },
      } as unknown as ConstructorParameters<typeof ServiceTokenViewModel>[0]);

      const prewarm = svc.prewarmHomeTokenListFrames({
        networkId: 'net1',
        deriveType: undefined,
        othersWalletAccountId: 'acc1',
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('live')],
          tokenListMap: { live: makeFiat({ balance: '2', fiatValue: '20' }) },
          source: 'single',
        }),
      );
      resolveLocalTokens({
        hasCache: true,
        tokenList: [makeToken('cached')],
        smallBalanceTokenList: [],
        riskyTokenList: [],
        tokenListMap: { cached: makeFiat({ balance: '1', fiatValue: '10' }) },
        tokenListValue: '10',
        currency: 'usd',
      });
      const result = await prewarm;

      expect(result?.frames.structure?.orderedIds).toEqual(['live']);
      expect(result?.worth).toBeUndefined();
      expect(structureEmits().map((e) => e.structure.orderedIds)).toEqual([
        ['live'],
      ]);
    });

    // Same race with nothing in the local cache: the round that landed is
    // still the owner's frames, so the prewarm hands them over rather than
    // reporting an empty cache (which made the selector paint a switch
    // skeleton for an owner the background already held).
    it('returns the frames of an owner whose round lands while an empty local cache is read', async () => {
      jest
        .spyOn(settingsPersistAtom, 'get')
        .mockResolvedValue({ currencyInfo: { id: 'usd' } } as Awaited<
          ReturnType<typeof settingsPersistAtom.get>
        >);
      let resolveLocalTokens: (value: unknown) => void = () => {};
      const svc = new ServiceTokenViewModel({
        backgroundApi: {
          serviceToken: {
            getAccountLocalTokens: () =>
              new Promise((resolve) => {
                resolveLocalTokens = resolve;
              }),
            getHomeDefaultTokenMap: async () => ({}),
          },
          serviceCustomToken: { getCustomTokensBatch: async () => [] },
        },
      } as unknown as ConstructorParameters<typeof ServiceTokenViewModel>[0]);

      const prewarm = svc.prewarmHomeTokenListFrames({
        networkId: 'net1',
        deriveType: undefined,
        othersWalletAccountId: 'acc1',
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      void svc.ingestRound(
        makeRound({
          orderedTokens: [makeToken('live')],
          tokenListMap: { live: makeFiat({ balance: '2', fiatValue: '20' }) },
          source: 'single',
        }),
      );
      resolveLocalTokens({
        hasCache: false,
        tokenList: [],
        smallBalanceTokenList: [],
        riskyTokenList: [],
        tokenListMap: {},
        tokenListValue: '0',
        currency: 'usd',
      });
      const result = await prewarm;

      expect(result?.frames.structure?.orderedIds).toEqual(['live']);
      expect(result?.worth).toBeUndefined();
    });

    it('persists aggregate maps in BG and inherits nonZeroInputs on ingestHomeTokenRounds', async () => {
      const updateLocalAggregateTokenMap = jest
        .fn()
        .mockResolvedValue(undefined);
      const updateLocalAggregateTokenListMap = jest
        .fn()
        .mockResolvedValue(undefined);
      const svc = new ServiceTokenViewModel({
        backgroundApi: {
          serviceToken: {
            updateLocalAggregateTokenMap,
            updateLocalAggregateTokenListMap,
          },
        },
      } as unknown as ConstructorParameters<typeof ServiceTokenViewModel>[0]);
      const homeRequest: IHomeTokenRequest = {
        mainRuntimeId: 'main-1',
        generation: 1,
        ownerKey: 'acc1__onekeyall',
      };
      const ref = svc.retainHomeTokenRound({
        homeRequest,
        origin: 'live',
        round: {
          accountId: 'acc1',
          networkId: 'evm--1',
          tokens: {
            data: [makeToken('eth', { isNative: true })],
            keys: 'eth',
            map: {
              eth: makeFiat({ balance: '1', fiatValue: '2000', price: 2000 }),
            },
          },
          smallBalanceTokens: { data: [], keys: '', map: {} },
          riskTokens: { data: [], keys: '', map: {} },
          aggregateTokenListMap: {
            agg_eth: { tokens: [makeToken('eth', { networkId: 'evm--1' })] },
          },
          aggregateTokenMap: {
            agg_eth: makeFiat({ balance: '1', fiatValue: '2000', price: 2000 }),
          },
        },
      });
      await svc.ingestHomeTokenRounds({
        homeRequest,
        ownerKey: 'acc1__onekeyall',
        accountId: 'acc1',
        networkId: 'onekeyall',
        storeData: STORE_DATA,
        keepDefault: true,
        homeDefaultTokenMap: {
          eth: { networkId: 'evm--1', logoURI: '', symbol: 'ETH', order: 0 },
        },
        roundRefs: [ref],
        source: 'progPaint',
        homePublication: 1,
      });
      expect(updateLocalAggregateTokenMap).not.toHaveBeenCalled();

      await svc.ingestHomeTokenRounds({
        homeRequest,
        ownerKey: 'acc1__onekeyall',
        accountId: 'acc1',
        networkId: 'onekeyall',
        storeData: STORE_DATA,
        keepDefault: true,
        roundRefs: [ref],
        source: 'authoritative',
        homePublication: 2,
        persistAggregateMaps: true,
      });
      expect(updateLocalAggregateTokenMap).toHaveBeenCalledTimes(1);
      expect(updateLocalAggregateTokenListMap).toHaveBeenCalledTimes(1);
    });
  });
});
