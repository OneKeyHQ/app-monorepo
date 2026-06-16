/**
 * TokenList SLC — Phase-2 BG ServiceTokenViewModel tests (design §5 step 2).
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
} from '../states/jotai/contexts/tokenList/slcPure/types';

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
    TokenListSlcStructureFrame: 'TokenListSlcStructureFrame',
    TokenListSlcValuationFrame: 'TokenListSlcValuationFrame',
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
    .filter((c) => c[0] === 'TokenListSlcStructureFrame')
    .map((c) => c[1] as IStructureFramePayload);
}
function valuationEmits(): IValuationFramePayload[] {
  return mockEmit.mock.calls
    .filter((c) => c[0] === 'TokenListSlcValuationFrame')
    .map((c) => c[1] as IValuationFramePayload);
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
        'TokenListSlcStructureFrame',
        'TokenListSlcValuationFrame',
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
});
