import {
  BORROW_EMPTY_STATE_ASSET_COUNT,
  pickTopSupplyAssetsByBalance,
} from './borrowEmptyState.utils';

const asset = (
  symbol: string,
  fiatValue?: string,
  disabled?: boolean,
  apy?: string,
) => ({
  symbol,
  walletBalance: fiatValue === undefined ? undefined : { fiatValue },
  supplyButton: disabled === undefined ? undefined : { disabled },
  apyDetail: apy === undefined ? undefined : { apy },
});

describe('pickTopSupplyAssetsByBalance', () => {
  it('orders by fiat value numerically and excludes disabled assets', () => {
    const picked = pickTopSupplyAssetsByBalance([
      asset('BLOCKED', '99', true),
      asset('NINE', '9'),
      asset('TEN', '10'),
      asset('NO_BALANCE'),
    ]);
    expect(picked.map((item) => item.symbol)).toEqual([
      'TEN',
      'NINE',
      'NO_BALANCE',
    ]);
  });

  // Everything the user holds none of ties at zero, and on a market they have
  // never touched that tie is the whole list. The server's own ranking is what
  // has to survive it, so this pins the tie-break rather than the sort.
  it('leaves assets the user holds none of in the order the server sent', () => {
    const picked = pickTopSupplyAssetsByBalance([
      asset('FIRST', '0'),
      asset('SECOND'),
      asset('THIRD', ''),
      asset('FOURTH', 'not-a-number'),
    ]);
    expect(picked.map((item) => item.symbol)).toEqual([
      'FIRST',
      'SECOND',
      'THIRD',
      'FOURTH',
    ]);
  });

  // APY is what this list used to rank by, so a fixture without it cannot tell
  // a server-order tie-break from an APY one. Every tie here carries an APY
  // that would reverse it if APY were still consulted.
  it('does not fall back to APY when balances tie', () => {
    const picked = pickTopSupplyAssetsByBalance([
      asset('HELD_FIRST', '5', undefined, '1'),
      asset('HELD_SECOND', '5', undefined, '99'),
      asset('ZERO_FIRST', '0', undefined, '1'),
      asset('ZERO_SECOND', '0', undefined, '99'),
    ]);
    expect(picked.map((item) => item.symbol)).toEqual([
      'HELD_FIRST',
      'HELD_SECOND',
      'ZERO_FIRST',
      'ZERO_SECOND',
    ]);
  });

  it('lifts a held asset above the ones the server ranked over it', () => {
    const picked = pickTopSupplyAssetsByBalance([
      asset('TOP_OF_SERVER_LIST'),
      asset('DUST', '0.01'),
    ]);
    expect(picked.map((item) => item.symbol)).toEqual([
      'DUST',
      'TOP_OF_SERVER_LIST',
    ]);
  });

  it('caps the result without mutating the source', () => {
    const assets = Array.from({ length: 9 }, (_, i) =>
      asset(`T${i}`, String(i)),
    );
    const originalOrder = assets.map((item) => item.symbol);
    const picked = pickTopSupplyAssetsByBalance(assets);

    expect(picked).toHaveLength(BORROW_EMPTY_STATE_ASSET_COUNT);
    expect(picked[0].symbol).toBe('T8');
    expect(assets.map((item) => item.symbol)).toEqual(originalOrder);
  });

  it('returns an empty list when there is nothing to recommend', () => {
    expect(pickTopSupplyAssetsByBalance(undefined)).toEqual([]);
    expect(pickTopSupplyAssetsByBalance([])).toEqual([]);
  });
});
