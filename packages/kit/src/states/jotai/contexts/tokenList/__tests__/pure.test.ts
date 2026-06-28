import {
  computeFundedIds,
  computeNonZeroIds,
  fiatEqual,
  isAgg,
  metaEqual,
  sumAggregateEntry,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

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

describe('sumAggregateEntry', () => {
  it('sums balance/balanceParsed/fiatValue across entries', () => {
    const result = sumAggregateEntry([
      makeFiat({ balance: '1', balanceParsed: '1', fiatValue: '10' }),
      makeFiat({ balance: '2', balanceParsed: '2', fiatValue: '20' }),
    ]);
    expect(result?.balance).toBe('3');
    expect(result?.balanceParsed).toBe('3');
    expect(result?.fiatValue).toBe('30');
  });

  it('takes price/price24h/currency from the first entry', () => {
    const result = sumAggregateEntry([
      makeFiat({ price: 100, price24h: 5, currency: 'usd' }),
      makeFiat({ price: 999, price24h: 99, currency: 'eur' }),
    ]);
    expect(result?.price).toBe(100);
    expect(result?.price24h).toBe(5);
    expect(result?.currency).toBe('usd');
  });

  it('tolerates undefined entries (skips them)', () => {
    const result = sumAggregateEntry([
      undefined,
      makeFiat({ balance: '5', fiatValue: '50' }),
      undefined,
    ]);
    expect(result?.balance).toBe('5');
    expect(result?.fiatValue).toBe('50');
  });

  it('returns undefined for an empty set', () => {
    expect(sumAggregateEntry([])).toBeUndefined();
    expect(sumAggregateEntry([undefined, undefined])).toBeUndefined();
  });

  it('sums frozen* and total* when present', () => {
    const result = sumAggregateEntry([
      makeFiat({ frozenBalance: '1', totalBalance: '10' }),
      makeFiat({ frozenBalance: '2', totalBalance: '20' }),
    ]);
    expect(result?.frozenBalance).toBe('3');
    expect(result?.totalBalance).toBe('30');
  });
});

describe('fiatEqual', () => {
  it('treats two undefineds as equal', () => {
    expect(fiatEqual(undefined, undefined)).toBe(true);
  });

  it('treats undefined vs value as different', () => {
    expect(fiatEqual(undefined, makeFiat())).toBe(false);
    expect(fiatEqual(makeFiat(), undefined)).toBe(false);
  });

  it('only balance/fiatValue/price/price24h/currency changes count as different', () => {
    const a = makeFiat({ balance: '1', fiatValue: '10', price: 1 });
    expect(fiatEqual(a, { ...a })).toBe(true);
    expect(fiatEqual(a, { ...a, balance: '2' })).toBe(false);
    expect(fiatEqual(a, { ...a, fiatValue: '11' })).toBe(false);
    expect(fiatEqual(a, { ...a, price: 2 })).toBe(false);
    expect(fiatEqual(a, { ...a, price24h: 1.5 })).toBe(false);
    expect(fiatEqual(a, { ...a, currency: 'eur' })).toBe(false);
    // unrelated field does not count
    expect(fiatEqual(a, { ...a, balanceParsed: '999' })).toBe(true);
  });
});

describe('metaEqual', () => {
  it('two undefineds equal, undefined vs value different', () => {
    expect(metaEqual(undefined, undefined)).toBe(true);
    expect(metaEqual(undefined, makeToken())).toBe(false);
  });

  it('unrelated field changes do not count as different', () => {
    const a = makeToken();
    expect(metaEqual(a, { ...a, decimals: 6 })).toBe(true);
  });

  it('render-affecting field changes count as different', () => {
    const a = makeToken();
    expect(metaEqual(a, { ...a, symbol: 'NEW' })).toBe(false);
    expect(metaEqual(a, { ...a, name: 'New' })).toBe(false);
    expect(metaEqual(a, { ...a, logoURI: 'x' })).toBe(false);
    expect(metaEqual(a, { ...a, isAggregateToken: true })).toBe(false);
  });
});

describe('isAgg', () => {
  it('prefers the stamped isAggregateToken meta field', () => {
    expect(isAgg('not_prefixed', makeToken({ isAggregateToken: true }))).toBe(
      true,
    );
    expect(isAgg('aggregate_eth', makeToken({ isAggregateToken: false }))).toBe(
      false,
    );
  });

  it('falls back to prefix when meta missing', () => {
    expect(isAgg('aggregate_eth')).toBe(true);
    expect(isAgg('normal')).toBe(false);
  });
});

describe('computeNonZeroIds', () => {
  const homeDefaultTokenMap = {
    // buildHomeDefaultTokenMapKey({ networkId: 'evm--1', symbol: 'ETH' })
    'evm--1_ETH': true,
  } as Record<string, unknown>;

  it('keeps balance>0, default native, and custom hits; drops the rest', () => {
    const fiats: Record<string, ITokenFiat> = {
      hasBalance: makeFiat({ balance: '5' }),
      defaultNative: makeFiat({ balance: '0' }),
      customHit: makeFiat({ balance: '0' }),
      dropped: makeFiat({ balance: '0' }),
    };
    const metas: Record<string, IToken> = {
      hasBalance: makeToken({ networkId: 'evm--1', symbol: 'USDC' }),
      defaultNative: makeToken({
        networkId: 'evm--1',
        symbol: 'ETH',
        isNative: true,
      }),
      customHit: makeToken({
        networkId: 'evm--1',
        symbol: 'CUS',
        address: '0xcustom',
      }),
      dropped: makeToken({ networkId: 'evm--1', symbol: 'ZZZ' }),
    };
    const result = computeNonZeroIds({
      ids: ['hasBalance', 'defaultNative', 'customHit', 'dropped'],
      getFiat: (k) => fiats[k],
      getMeta: (k) => metas[k],
      keepDefault: true,
      homeDefaultTokenMap,
      customTokens: [
        {
          address: '0xcustom',
          networkId: 'evm--1',
        } as never,
      ],
    });
    expect(result).toEqual(['hasBalance', 'defaultNative', 'customHit']);
  });

  it('custom hit by $key match also keeps', () => {
    const result = computeNonZeroIds({
      ids: ['byKey'],
      getFiat: () => makeFiat({ balance: '0' }),
      getMeta: () => makeToken({ networkId: 'evm--1', address: '0xother' }),
      keepDefault: true,
      homeDefaultTokenMap,
      customTokens: [
        {
          $key: 'byKey',
          address: '0xirrelevant',
          networkId: 'evm--99',
        } as never,
      ],
    });
    expect(result).toEqual(['byKey']);
  });

  it('keepDefault=false drops zero-balance defaults and customs', () => {
    const result = computeNonZeroIds({
      ids: ['defaultNative'],
      getFiat: () => makeFiat({ balance: '0' }),
      getMeta: () =>
        makeToken({ networkId: 'evm--1', symbol: 'ETH', isNative: true }),
      keepDefault: false,
      homeDefaultTokenMap,
      customTokens: [],
    });
    expect(result).toEqual([]);
  });
});

describe('computeFundedIds (STRICT balance>0, PR-0 enabler)', () => {
  const homeDefaultTokenMap = {
    'evm--1_ETH': true,
  } as Record<string, unknown>;

  it('parity vs computeNonZeroIds: funded = ONLY balance>0; funded ⊊ nonZero when a 0-balance default token is kept', () => {
    // Same fixture as computeNonZeroIds "keeps balance>0, default native, and
    // custom hits" — proving the two sets DIFFER over identical inputs:
    //   nonZero (hideZero VIEW) = [hasBalance, defaultNative, customHit]
    //   funded  (STRICT)        = [hasBalance]            (balance>0 only)
    const fiats: Record<string, ITokenFiat> = {
      hasBalance: makeFiat({ balance: '5' }),
      defaultNative: makeFiat({ balance: '0' }),
      customHit: makeFiat({ balance: '0' }),
      dropped: makeFiat({ balance: '0' }),
    };
    const metas: Record<string, IToken> = {
      hasBalance: makeToken({ networkId: 'evm--1', symbol: 'USDC' }),
      defaultNative: makeToken({
        networkId: 'evm--1',
        symbol: 'ETH',
        isNative: true,
      }),
      customHit: makeToken({
        networkId: 'evm--1',
        symbol: 'CUS',
        address: '0xcustom',
      }),
      dropped: makeToken({ networkId: 'evm--1', symbol: 'ZZZ' }),
    };
    const ids = ['hasBalance', 'defaultNative', 'customHit', 'dropped'];
    const getFiat = (k: string) => fiats[k];
    const getMeta = (k: string) => metas[k];

    const nonZero = computeNonZeroIds({
      ids,
      getFiat,
      getMeta,
      keepDefault: true,
      homeDefaultTokenMap,
      customTokens: [{ address: '0xcustom', networkId: 'evm--1' } as never],
    });
    const funded = computeFundedIds({ ids, getFiat });

    expect(nonZero).toEqual(['hasBalance', 'defaultNative', 'customHit']);
    expect(funded).toEqual(['hasBalance']);

    // funded is a PROPER subset of nonZero (the keepDefault zero-balance tokens
    // are present in nonZero but absent from funded).
    const nonZeroSet = new Set(nonZero);
    for (const id of funded) {
      expect(nonZeroSet.has(id)).toBe(true);
    }
    expect(funded.length).toBeLessThan(nonZero.length);
  });

  it('is nonempty iff at least one funded token (== legacy hasHoldingsNow)', () => {
    // all zero -> empty (hasHoldingsNow=false)
    expect(
      computeFundedIds({
        ids: ['a', 'b'],
        getFiat: () => makeFiat({ balance: '0' }),
      }),
    ).toEqual([]);

    // one positive -> nonempty (hasHoldingsNow=true)
    const fiats: Record<string, ITokenFiat> = {
      a: makeFiat({ balance: '0' }),
      b: makeFiat({ balance: '1' }),
    };
    expect(
      computeFundedIds({
        ids: ['a', 'b'],
        getFiat: (k) => fiats[k],
      }),
    ).toEqual(['b']);
  });

  it('ignores keepDefault retention entirely (a fresh 0-balance native is NOT funded)', () => {
    const funded = computeFundedIds({
      ids: ['defaultNative'],
      getFiat: () => makeFiat({ balance: '0' }),
    });
    expect(funded).toEqual([]);
  });
});
