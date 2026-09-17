import {
  BORROW_EMPTY_STATE_ASSET_COUNT,
  pickTopSupplyAssetsByBalance,
} from './borrowEmptyState.utils';

const asset = (symbol: string, fiatValue?: string, disabled?: boolean) => ({
  symbol,
  walletBalance: fiatValue === undefined ? undefined : { fiatValue },
  supplyButton: disabled === undefined ? undefined : { disabled },
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
