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
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import ServiceTokenViewModel from './ServiceTokenViewModel';

import type { IIngestRoundParams } from './ServiceTokenViewModel';
import type { IJotaiContextStoreData } from '../states/jotai/atoms/jotaiContextStoreMap';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '../states/jotai/contexts/tokenList/cellsPure/types';

interface IStructureFramePayload {
  ownerKey: string;
  structureVersion: number;
  structure: IStructureSnapshot;
}
interface IValuationFramePayload {
  ownerKey: string;
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

  it('evicts the LRU owner past the cap (8) while keeping the MRU owners + re-ingest re-creates an evicted owner', async () => {
    const svc = makeService();
    // Ingest 9 distinct owners; cap is 8, so the FIRST (owner0) is evicted.
    for (let i = 0; i < 9; i += 1) {
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
    // The MRU owner (owner8) is retained.
    const retained = await svc.getTokenListFrames({ ownerKey: 'acc8__net' });
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
    // Seed owners 0..7 (fills the cap exactly).
    for (let i = 0; i < 8; i += 1) {
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
    // Ingest a NEW owner (owner8). The LRU is now owner1 (owner0 was refreshed).
    void svc.ingestRound(
      makeRound({ ownerKey: 'acc8__net', orderedTokens: [makeToken('a')] }),
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
      // Fill past the cap (8) so owner0 is evicted.
      for (let i = 0; i < 9; i += 1) {
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
});
