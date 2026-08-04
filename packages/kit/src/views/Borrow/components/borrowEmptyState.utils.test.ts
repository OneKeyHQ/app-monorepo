import {
  BORROW_EMPTY_STATE_ASSET_COUNT,
  pickTopSupplyAssetsByApy,
} from './borrowEmptyState.utils';

const asset = (symbol: string, apy?: string, disabled?: boolean) => ({
  symbol,
  apyDetail: apy === undefined ? undefined : { apy },
  supplyButton: disabled === undefined ? undefined : { disabled },
});

describe('pickTopSupplyAssetsByApy', () => {
  it('orders numerically and excludes disabled assets', () => {
    const picked = pickTopSupplyAssetsByApy([
      asset('BLOCKED', '99', true),
      asset('NINE', '9'),
      asset('TEN', '10'),
      asset('NO_APY'),
    ]);
    expect(picked.map((item) => item.symbol)).toEqual([
      'TEN',
      'NINE',
      'NO_APY',
    ]);
  });

  it('caps the result without mutating the source', () => {
    const assets = Array.from({ length: 9 }, (_, i) =>
      asset(`T${i}`, String(i)),
    );
    const originalOrder = assets.map((item) => item.symbol);
    const picked = pickTopSupplyAssetsByApy(assets);

    expect(picked).toHaveLength(BORROW_EMPTY_STATE_ASSET_COUNT);
    expect(picked[0].symbol).toBe('T8');
    expect(assets.map((item) => item.symbol)).toEqual(originalOrder);
  });

  it('returns an empty list when there is nothing to recommend', () => {
    expect(pickTopSupplyAssetsByApy(undefined)).toEqual([]);
    expect(pickTopSupplyAssetsByApy([])).toEqual([]);
  });
});
