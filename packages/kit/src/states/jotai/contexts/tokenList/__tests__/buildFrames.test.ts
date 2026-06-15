/**
 * TokenList SLC — buildFrames PURE MAPPING tests (spec §4.1, §11.5). These are
 * a MERGE GATE for the producer-wiring slice. They run in node with no React /
 * jotai / native: buildFrames is pure data in / pure data out.
 *
 * They assert:
 *  - one fetch round derives a structure frame + a valuation frame;
 *  - a pure price tick (same ids/membership/metas/scalar) emits NO structure
 *    frame — only valuation (spec §4.1);
 *  - add/remove/reorder/owner-switch/meta-change/scalar-change DO emit a
 *    structure frame;
 *  - aggregate per-network payload becomes both aggMembership (structure) and
 *    changedAggFiat (valuation) — the aggregate channel is not dropped (spec
 *    §3.1, §6);
 *  - aggregate ids never leak into changedFiatById;
 *  - generation is monotonic and survives an owner switch.
 */
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { buildFrames, metaByKeyFromTokens } from '../slc/buildFrames';

import type { IBuildFramesInput, IBuildFramesPrev } from '../slc/buildFrames';

const STORE_DATA = {
  storeName: EJotaiContextStoreNames.homeTokenList,
} as IJotaiContextStoreData;

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

function emptyPrev(): IBuildFramesPrev {
  return {
    structure: {
      orderedIds: [],
      smallBalanceIds: [],
      nonZeroIds: [],
      aggMembership: {},
      ownerKey: '',
      generation: -1,
    },
    smallBalanceFiatValue: '0',
    metaByKey: {},
  };
}

function makeInput(
  overrides: Partial<IBuildFramesInput> = {},
): IBuildFramesInput {
  return {
    orderedTokens: [],
    smallBalanceTokens: [],
    tokenListMap: {},
    aggregateTokensMap: {},
    smallBalanceFiatValue: '0',
    ownerKey: 'acc1__net1',
    storeData: STORE_DATA,
    ...overrides,
  };
}

/**
 * Build the `prev` snapshot that corresponds to a result, so the next call from
 * an identical input is a no-op (pure price-tick simulation).
 */
function prevFromResult(
  input: IBuildFramesInput,
  result: ReturnType<typeof buildFrames>,
): IBuildFramesPrev {
  if (!result.structure) {
    throw new OneKeyLocalError(
      'expected a structure frame to derive prev from',
    );
  }
  return {
    structure: {
      orderedIds: result.structure.orderedIds,
      smallBalanceIds: result.structure.smallBalanceIds,
      nonZeroIds: result.structure.nonZeroIds,
      aggMembership: result.structure.aggMembership,
      ownerKey: result.structure.ownerKey,
      generation: result.structure.generation,
    },
    smallBalanceFiatValue: result.structure.smallBalanceFiatValue,
    metaByKey: metaByKeyFromTokens([
      ...input.orderedTokens,
      ...input.smallBalanceTokens,
    ]),
  };
}

describe('buildFrames', () => {
  it('derives structure + valuation from one fetch round', () => {
    const input = makeInput({
      orderedTokens: [makeToken('a'), makeToken('b')],
      smallBalanceTokens: [makeToken('c')],
      tokenListMap: {
        a: makeFiat({ balance: '10', fiatValue: '100' }),
        b: makeFiat({ balance: '5', fiatValue: '50' }),
        c: makeFiat({ balance: '0', fiatValue: '0' }),
      },
      smallBalanceFiatValue: '0',
    });

    const { structure, valuation } = buildFrames(input, emptyPrev());

    expect(structure).toBeDefined();
    expect(structure?.orderedIds).toEqual(['a', 'b']);
    expect(structure?.smallBalanceIds).toEqual(['c']);
    expect(structure?.nonZeroIds).toEqual(['a', 'b']); // c has 0 balance
    expect(structure?.generation).toBe(0);
    expect(Object.keys(structure?.metaPatch ?? {})).toEqual(['a', 'b', 'c']);
    // meta is stored without $key
    expect((structure?.metaPatch.a as IToken & { $key?: string }).$key).toBe(
      undefined,
    );

    expect(valuation.changedFiatById.a.fiatValue).toBe('100');
    expect(valuation.changedFiatById.c.fiatValue).toBe('0');
    expect(valuation.ownerKey).toBe('acc1__net1');
    expect(valuation.storeData).toBe(STORE_DATA);
  });

  it('emits valuation only on a pure price tick (no structure frame)', () => {
    const baseTokens = [makeToken('a'), makeToken('b')];
    const input1 = makeInput({
      orderedTokens: baseTokens,
      tokenListMap: {
        a: makeFiat({ balance: '10', fiatValue: '100', price: 10 }),
        b: makeFiat({ balance: '1', fiatValue: '10', price: 10 }),
      },
    });
    const r1 = buildFrames(input1, emptyPrev());
    const prev = prevFromResult(input1, r1);

    // same ids / membership / metas / scalar, only fiat values move
    const input2 = makeInput({
      orderedTokens: baseTokens,
      tokenListMap: {
        a: makeFiat({ balance: '10', fiatValue: '120', price: 12 }),
        b: makeFiat({ balance: '1', fiatValue: '11', price: 11 }),
      },
    });
    const r2 = buildFrames(input2, prev);

    expect(r2.structure).toBeUndefined();
    expect(r2.valuation.changedFiatById.a.fiatValue).toBe('120');
    expect(r2.valuation.changedFiatById.b.price).toBe(11);
  });

  it('emits a structure frame when a token is added', () => {
    const input1 = makeInput({ orderedTokens: [makeToken('a')] });
    const r1 = buildFrames(input1, emptyPrev());
    const prev = prevFromResult(input1, r1);

    const input2 = makeInput({
      orderedTokens: [makeToken('a'), makeToken('b')],
    });
    const r2 = buildFrames(input2, prev);

    expect(r2.structure).toBeDefined();
    expect(r2.structure?.orderedIds).toEqual(['a', 'b']);
    expect(r2.structure?.generation).toBe(1);
  });

  it('emits a structure frame on reorder', () => {
    const input1 = makeInput({
      orderedTokens: [makeToken('a'), makeToken('b')],
    });
    const r1 = buildFrames(input1, emptyPrev());
    const prev = prevFromResult(input1, r1);

    const input2 = makeInput({
      orderedTokens: [makeToken('b'), makeToken('a')],
    });
    const r2 = buildFrames(input2, prev);

    expect(r2.structure).toBeDefined();
    expect(r2.structure?.orderedIds).toEqual(['b', 'a']);
  });

  it('emits a structure frame on a meta change (symbol)', () => {
    const input1 = makeInput({ orderedTokens: [makeToken('a')] });
    const r1 = buildFrames(input1, emptyPrev());
    const prev = prevFromResult(input1, r1);

    const input2 = makeInput({
      orderedTokens: [makeToken('a', { symbol: 'NEW' })],
    });
    const r2 = buildFrames(input2, prev);

    expect(r2.structure).toBeDefined();
    expect(r2.structure?.metaPatch.a.symbol).toBe('NEW');
  });

  it('emits a structure frame when smallBalanceFiatValue scalar changes', () => {
    const input1 = makeInput({
      orderedTokens: [makeToken('a')],
      smallBalanceFiatValue: '0',
    });
    const r1 = buildFrames(input1, emptyPrev());
    const prev = prevFromResult(input1, r1);

    const input2 = makeInput({
      orderedTokens: [makeToken('a')],
      smallBalanceFiatValue: '42',
    });
    const r2 = buildFrames(input2, prev);

    expect(r2.structure).toBeDefined();
    expect(r2.structure?.smallBalanceFiatValue).toBe('42');
  });

  it('resets and stays monotonic on an owner switch', () => {
    const input1 = makeInput({
      orderedTokens: [makeToken('a')],
      ownerKey: 'acc1__net1',
    });
    const r1 = buildFrames(input1, emptyPrev());
    expect(r1.structure?.generation).toBe(0);
    const prev = prevFromResult(input1, r1);

    const input2 = makeInput({
      orderedTokens: [makeToken('x')],
      ownerKey: 'acc2__net2',
    });
    const r2 = buildFrames(input2, prev);

    expect(r2.structure).toBeDefined();
    expect(r2.structure?.ownerKey).toBe('acc2__net2');
    expect(r2.structure?.generation).toBe(1); // monotonic across owners
  });

  describe('aggregate channel (spec §3.1, §6)', () => {
    it('maps per-network payload into aggMembership + changedAggFiat', () => {
      const input = makeInput({
        orderedTokens: [makeToken('aggregate_eth', { isAggregateToken: true })],
        aggregateTokensMap: {
          aggregate_eth: {
            'evm--1': makeFiat({ balance: '1', fiatValue: '3000' }),
            'evm--10': makeFiat({ balance: '2', fiatValue: '6000' }),
          },
        },
      });

      const { structure, valuation } = buildFrames(input, emptyPrev());

      expect(structure?.aggMembership.aggregate_eth).toEqual([
        'evm--1',
        'evm--10',
      ]);
      expect(valuation.changedAggFiat.aggregate_eth['evm--1'].fiatValue).toBe(
        '3000',
      );
      expect(valuation.changedAggFiat.aggregate_eth['evm--10'].fiatValue).toBe(
        '6000',
      );
    });

    it('never leaks aggregate ids into changedFiatById', () => {
      const input = makeInput({
        orderedTokens: [
          makeToken('normal', {}),
          makeToken('aggregate_eth', { isAggregateToken: true }),
        ],
        tokenListMap: {
          normal: makeFiat({ balance: '1', fiatValue: '1' }),
          // even if a flattened agg value sneaks into the map, isAgg gates it
          aggregate_eth: makeFiat({ balance: '9', fiatValue: '9' }),
        },
        aggregateTokensMap: {
          aggregate_eth: { 'evm--1': makeFiat({ balance: '9' }) },
        },
      });

      const { valuation } = buildFrames(input, emptyPrev());

      expect(valuation.changedFiatById.normal).toBeDefined();
      expect(valuation.changedFiatById.aggregate_eth).toBeUndefined();
    });

    it('emits a structure frame when aggregate membership changes', () => {
      const input1 = makeInput({
        orderedTokens: [makeToken('aggregate_eth', { isAggregateToken: true })],
        aggregateTokensMap: {
          aggregate_eth: { 'evm--1': makeFiat({ balance: '1' }) },
        },
      });
      const r1 = buildFrames(input1, emptyPrev());
      const prev = prevFromResult(input1, r1);

      // a new derived network joins the aggregate -> membership changed
      const input2 = makeInput({
        orderedTokens: [makeToken('aggregate_eth', { isAggregateToken: true })],
        aggregateTokensMap: {
          aggregate_eth: {
            'evm--1': makeFiat({ balance: '1' }),
            'evm--10': makeFiat({ balance: '2' }),
          },
        },
      });
      const r2 = buildFrames(input2, prev);

      expect(r2.structure).toBeDefined();
      expect(r2.structure?.aggMembership.aggregate_eth).toEqual([
        'evm--1',
        'evm--10',
      ]);
    });

    it('does NOT emit a structure frame when only an aggregate value moves', () => {
      const input1 = makeInput({
        orderedTokens: [makeToken('aggregate_eth', { isAggregateToken: true })],
        aggregateTokensMap: {
          aggregate_eth: { 'evm--1': makeFiat({ balance: '1', price: 10 }) },
        },
      });
      const r1 = buildFrames(input1, emptyPrev());
      const prev = prevFromResult(input1, r1);

      const input2 = makeInput({
        orderedTokens: [makeToken('aggregate_eth', { isAggregateToken: true })],
        aggregateTokensMap: {
          aggregate_eth: { 'evm--1': makeFiat({ balance: '1', price: 12 }) },
        },
      });
      const r2 = buildFrames(input2, prev);

      expect(r2.structure).toBeUndefined();
      expect(r2.valuation.changedAggFiat.aggregate_eth['evm--1'].price).toBe(
        12,
      );
    });
  });
});
